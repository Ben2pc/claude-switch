#!/usr/bin/env node

import { select, password, Separator } from "@inquirer/prompts";
import { ExitPromptError } from "@inquirer/core";
import { PROVIDERS, type ProviderModel } from "./providers.js";
import { readConfig, writeConfig, getProviderApiKey, setProviderApiKey, type SwitchConfig } from "./config.js";
import { detectActiveProvider, switchProvider } from "./switcher.js";

const RECONFIGURE_KEY = "__reconfigure_api_key__";

async function main(): Promise<void> {
  // Provider selection loop
  while (true) {
    // Re-read config each iteration so status hints stay fresh after ESC back
    const config = await readConfig();
    const activeProviderId = await detectActiveProvider();

    const providerId = await selectProvider(activeProviderId, config);
    if (providerId === null) return; // ESC — exit

    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;

    // Claude native: no model selection, switch directly
    if (provider.id === "claude") {
      await switchProvider(provider, "", "");
      console.log(`\n✔ Switched to ${provider.displayName}`);
      console.log("  Please restart Claude Code to apply");
      return;
    }

    // Ensure API key is configured
    let currentConfig = config;
    let apiKey = getProviderApiKey(currentConfig, provider.id);

    if (!apiKey) {
      console.log(`\n⚠ ${provider.displayName} API Key not configured`);
      const inputKey = await promptApiKey(provider.apiKeyUrl);
      if (inputKey === null) continue; // ESC — back to provider selection
      apiKey = inputKey;
      currentConfig = setProviderApiKey(currentConfig, provider.id, apiKey);
      await writeConfig(currentConfig);
      console.log("✔ API Key saved\n");
    }

    // Single model provider (e.g. MiniMax): skip model selection
    if (provider.models.length === 1) {
      const model = provider.models[0].name;
      await switchProvider(provider, model, apiKey);
      console.log(`\n✔ Switched to ${provider.displayName} / ${model}`);
      console.log("  Please restart Claude Code to apply");
      return;
    }

    // Model selection loop
    const result = await selectModel(provider.displayName, provider.models, provider.apiKeyUrl, currentConfig, provider.id);
    if (result === null) continue; // ESC — back to provider selection

    // Re-read config in case API key was reconfigured during model selection
    const finalConfig = await readConfig();
    const finalApiKey = getProviderApiKey(finalConfig, provider.id);
    if (!finalApiKey) continue;
    await switchProvider(provider, result, finalApiKey);
    console.log(`\n✔ Switched to ${provider.displayName} / ${result}`);
    console.log("  Please restart Claude Code to apply");
    return;
  }
}

async function selectProvider(
  activeProviderId: string,
  config: SwitchConfig,
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
  } catch (err) {
    if (err instanceof ExitPromptError) return null;
    throw err;
  }
}

async function promptApiKey(apiKeyUrl: string): Promise<string | null> {
  try {
    const key = await password({
      message: `Enter API Key (get it from ${apiKeyUrl})`,
      mask: "*",
    });
    return key && key.trim().length > 0 ? key.trim() : null;
  } catch (err) {
    if (err instanceof ExitPromptError) return null;
    throw err;
  }
}

async function selectModel(
  providerName: string,
  models: ProviderModel[],
  apiKeyUrl: string,
  config: SwitchConfig,
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
    } catch (err) {
      if (err instanceof ExitPromptError) return null;
      throw err;
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
