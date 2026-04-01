#!/usr/bin/env node

import { select, password, Separator } from "@inquirer/prompts";
import { PROVIDERS } from "./providers.js";
import { readConfig, writeConfig, getProviderApiKey, setProviderApiKey } from "./config.js";
import { detectActiveProvider, switchProvider } from "./switcher.js";

const RECONFIGURE_KEY = "__reconfigure_api_key__";

async function main(): Promise<void> {
  const config = await readConfig();
  const activeProviderId = await detectActiveProvider();

  // Phase 1: Provider selection loop
  while (true) {
    const providerId = await selectProvider(activeProviderId, config);
    if (providerId === null) {
      // ESC pressed at provider level — exit
      return;
    }

    const provider = PROVIDERS.find((p) => p.id === providerId)!;

    // Claude native: no model selection, switch directly
    if (provider.id === "claude") {
      await switchProvider(provider, "", "");
      console.log(`\n✔ Switched to ${provider.displayName}`);
      console.log("  Please restart Claude Code to apply");
      return;
    }

    // Ensure API key is configured
    let currentConfig = await readConfig();
    let apiKey: string | undefined = getProviderApiKey(currentConfig, provider.id);

    if (!apiKey) {
      console.log(`\n⚠ ${provider.displayName} API Key not configured`);
      const inputKey = await promptApiKey(provider.apiKeyUrl);
      if (inputKey === null) continue; // ESC — back to provider selection
      apiKey = inputKey;
      currentConfig = setProviderApiKey(currentConfig, provider.id, apiKey);
      await writeConfig(currentConfig);
      console.log("✔ API Key saved\n");
    }

    // MiniMax: single model, skip selection
    if (provider.models.length === 1) {
      const model = provider.models[0].name;
      await switchProvider(provider, model, apiKey!);
      console.log(`\n✔ Switched to ${provider.displayName} / ${model}`);
      console.log("  Please restart Claude Code to apply");
      return;
    }

    // Phase 2: Model selection loop
    const result = await selectModel(provider.displayName, provider.models, provider.apiKeyUrl, currentConfig, provider.id);
    if (result === null) {
      // ESC — back to provider selection
      continue;
    }

    // result is the selected model name, apiKey may have been updated
    const finalConfig = await readConfig();
    const finalApiKey = getProviderApiKey(finalConfig, provider.id)!;
    await switchProvider(provider, result, finalApiKey);
    console.log(`\n✔ Switched to ${provider.displayName} / ${result}`);
    console.log("  Please restart Claude Code to apply");
    return;
  }
}

async function selectProvider(
  activeProviderId: string,
  config: Awaited<ReturnType<typeof readConfig>>,
): Promise<string | null> {
  try {
    return await select({
      message: "Select Provider",
      choices: PROVIDERS.map((p) => {
        let hint: string;
        if (p.id === activeProviderId) {
          hint = "● active";
        } else if (p.id !== "claude" && getProviderApiKey(config, p.id)) {
          hint = "✔ configured";
        } else if (p.id === "claude") {
          hint = "";
        } else {
          hint = "○ not configured";
        }
        return {
          name: hint ? `${p.displayName}  ${hint}` : p.displayName,
          value: p.id,
        };
      }),
    });
  } catch {
    return null;
  }
}

async function promptApiKey(apiKeyUrl: string): Promise<string | null> {
  try {
    const key = await password({
      message: `Enter API Key (get it from ${apiKeyUrl})`,
      mask: "*",
    });
    return key && key.trim().length > 0 ? key.trim() : null;
  } catch {
    return null;
  }
}

async function selectModel(
  providerName: string,
  models: { name: string; displayName?: string }[],
  apiKeyUrl: string,
  config: Awaited<ReturnType<typeof readConfig>>,
  providerId: string,
): Promise<string | null> {
  while (true) {
    try {
      const result = await select({
        message: `Select model (${providerName})`,
        choices: [
          new Separator("── Actions ──"),
          { name: "🔑 Reconfigure API Key", value: RECONFIGURE_KEY },
          new Separator("── Models ──"),
          ...models.map((m) => ({
            name: m.displayName ?? m.name,
            value: m.name,
          })),
        ],
      });

      if (result === RECONFIGURE_KEY) {
        const newKey = await promptApiKey(apiKeyUrl);
        if (newKey) {
          const updated = setProviderApiKey(config, providerId, newKey);
          await writeConfig(updated);
          config = updated;
          console.log("✔ API Key updated\n");
        }
        continue;
      }

      return result;
    } catch {
      return null;
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
