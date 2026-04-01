#!/usr/bin/env node

import { select, password, Separator } from "@inquirer/prompts";
import { CancelPromptError, ExitPromptError } from "@inquirer/core";
import { PROVIDERS, type ProviderModel } from "./providers.js";
import { readConfig, writeConfig, getProviderApiKey, setProviderApiKey, type SwitchConfig } from "./config.js";
import { detectActiveProvider, switchProvider } from "./switcher.js";
const RECONFIGURE_KEY = "__reconfigure_api_key__";

const ESC_BYTE = "\x1b";

/**
 * Wrap an inquirer prompt with ESC-to-cancel support.
 * Listens for raw ESC byte on stdin while the prompt is active.
 */
function withEsc<T>(prompt: Promise<T> & { cancel?: () => void }): Promise<T> {
  const onData = (data: Buffer) => {
    // ESC is 0x1b; ignore ESC sequences (arrow keys etc.) which have more bytes
    if (data.length === 1 && data.toString() === ESC_BYTE) {
      prompt.cancel?.();
    }
  };

  process.stdin.on("data", onData);

  return prompt.finally(() => {
    process.stdin.removeListener("data", onData);
  });
}

function isCancelled(err: unknown): boolean {
  return err instanceof CancelPromptError || err instanceof ExitPromptError;
}

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
      const warnings = await switchProvider(provider, "", "");
      printSwitchResult(provider.displayName, undefined, warnings);
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

    // Single model provider (e.g. MiniMax): show action menu
    if (provider.models.length === 1) {
      const action = await selectSingleModelAction(provider.displayName, provider.models[0].name, provider.apiKeyUrl, currentConfig, provider.id);
      if (action === null) continue; // ESC — back to provider selection
      if (action === "reconfigure") continue;
      const finalConfig = await readConfig();
      const finalApiKey = getProviderApiKey(finalConfig, provider.id);
      if (!finalApiKey) continue;
      const warnings = await switchProvider(provider, provider.models[0].name, finalApiKey);
      printSwitchResult(provider.displayName, provider.models[0].name, warnings);
      return;
    }

    // Model selection loop
    const result = await selectModel(provider.displayName, provider.models, provider.apiKeyUrl, currentConfig, provider.id);
    if (result === null) continue; // ESC — back to provider selection

    const finalConfig = await readConfig();
    const finalApiKey = getProviderApiKey(finalConfig, provider.id);
    if (!finalApiKey) continue;
    const warnings = await switchProvider(provider, result, finalApiKey);
    printSwitchResult(provider.displayName, result, warnings);
    return;
  }
}

async function selectProvider(
  activeProviderId: string,
  config: SwitchConfig,
): Promise<string | null> {
  try {
    return await withEsc(select({
      message: "Select Provider  (ESC to quit)",
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
    }));
  } catch (err) {
    if (isCancelled(err)) return null;
    throw err;
  }
}

async function promptApiKey(apiKeyUrl: string): Promise<string | null> {
  try {
    const key = await withEsc(password({
      message: `Enter API Key (get it from ${apiKeyUrl})`,
      mask: "*",
    }));
    return key && key.trim().length > 0 ? key.trim() : null;
  } catch (err) {
    if (isCancelled(err)) return null;
    throw err;
  }
}

function printSwitchResult(providerName: string, model: string | undefined, warnings: string[]): void {
  const target = model ? `${providerName} / ${model}` : providerName;
  console.log(`\n✔ Switched to ${target}`);
  for (const w of warnings) {
    console.log(w);
  }
  console.log("  Please restart Claude Code to apply");
}

async function selectSingleModelAction(
  providerName: string,
  modelName: string,
  apiKeyUrl: string,
  config: SwitchConfig,
  providerId: string,
): Promise<"switch" | "reconfigure" | null> {
  while (true) {
    try {
      const result = await withEsc(select({
        message: `${providerName} (${modelName})  (ESC to go back)`,
        choices: [
          { name: `Switch to ${modelName}`, value: "switch" as const },
          { name: "🔑 Reconfigure API Key", value: RECONFIGURE_KEY },
        ],
      }));

      if (result === RECONFIGURE_KEY) {
        const newKey = await promptApiKey(apiKeyUrl);
        if (newKey) {
          const updated = setProviderApiKey(config, providerId, newKey);
          await writeConfig(updated);
          console.log("✔ API Key updated\n");
        }
        return "reconfigure";
      }

      return "switch";
    } catch (err) {
      if (isCancelled(err)) return null;
      throw err;
    }
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
      const modelChoices = models.map((m) => ({
        name: m.displayName ?? m.name,
        value: m.name,
      }));
      const result = await withEsc(select({
        message: `Select model (${providerName})  (ESC to go back)`,
        default: modelChoices[0].value,
        choices: [
          new Separator("── Actions ──"),
          { name: "🔑 Reconfigure API Key", value: RECONFIGURE_KEY },
          new Separator("── Models ──"),
          ...modelChoices,
        ],
      }));

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
      if (isCancelled(err)) return null;
      throw err;
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
