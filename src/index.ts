#!/usr/bin/env node

import { select, password, confirm, Separator } from "@inquirer/prompts";
import { CancelPromptError, ExitPromptError } from "@inquirer/core";
import { PROVIDERS, type ProviderModel } from "./providers.js";
import { readConfig, writeConfig, getProviderApiKey, setProviderApiKey, type SwitchConfig } from "./config.js";
import { detectActiveProvider, detectActiveModel, getActiveBaseUrl, switchProvider } from "./switcher.js";

const RECONFIGURE_KEY = "__reconfigure_api_key__";
const ESC_BYTE = "\x1b";

/**
 * Wrap an inquirer prompt with ESC-to-cancel support.
 */
function withEsc<T>(prompt: Promise<T> & { cancel?: () => void }): Promise<T> {
  const onData = (data: Buffer) => {
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
  while (true) {
    const config = await readConfig();
    const activeProviderId = await detectActiveProvider();
    const activeModel = await detectActiveModel();

    const providerId = await selectProvider(activeProviderId, activeModel, config);
    if (providerId === null) return;

    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;

    // Fix #1: Skip if already on Claude native
    if (provider.id === "claude") {
      if (activeProviderId === "claude") {
        console.log("\n  Already on Claude (Native), no changes needed.");
        continue;
      }
      // Fix #5: Warn if switching from unknown provider
      if (activeProviderId === "unknown") {
        const baseUrl = await getActiveBaseUrl();
        console.log(`\n⚠ Current config uses an unrecognized provider (${baseUrl})`);
        const ok = await confirmAction("Switching will remove these settings. Continue?");
        if (!ok) continue;
      }
      const warnings = await switchProvider(provider, "", "");
      printSwitchResult(provider.displayName, undefined, warnings);
      return;
    }

    // Ensure API key is configured
    let currentConfig = config;
    let apiKey = getProviderApiKey(currentConfig, provider.id);

    if (!apiKey) {
      console.log(`\n⚠ ${provider.displayName} API Key not configured`);
      const inputKey = await promptApiKeyLoop(provider.apiKeyUrl);
      if (inputKey === null) continue; // ESC — back
      apiKey = inputKey;
      currentConfig = setProviderApiKey(currentConfig, provider.id, apiKey);
      await writeConfig(currentConfig);
      console.log("✔ API Key saved\n");
    }

    // Single model provider
    if (provider.models.length === 1) {
      const modelName = provider.models[0].name;
      // Fix #1: Skip if already active with same model
      if (activeProviderId === provider.id) {
        console.log(`\n  Already on ${provider.displayName} / ${modelName}, no changes needed.`);
        continue;
      }
      const action = await selectSingleModelAction(provider.displayName, modelName, provider.apiKeyUrl, currentConfig, provider.id);
      if (action === null) continue;
      const finalConfig = await readConfig();
      const finalApiKey = getProviderApiKey(finalConfig, provider.id);
      if (!finalApiKey) continue;
      const warnings = await switchProvider(provider, modelName, finalApiKey);
      printSwitchResult(provider.displayName, modelName, warnings);
      return;
    }

    // Multi-model provider
    const result = await selectModel(provider.displayName, provider.models, provider.apiKeyUrl, currentConfig, provider.id, activeProviderId === provider.id ? activeModel : undefined);
    if (result === null) continue;

    // Fix #1: Skip if same provider + same model
    if (activeProviderId === provider.id && activeModel === result) {
      console.log(`\n  Already on ${provider.displayName} / ${result}, no changes needed.`);
      continue;
    }

    const finalConfig = await readConfig();
    const finalApiKey = getProviderApiKey(finalConfig, provider.id);
    if (!finalApiKey) continue;

    // Fix #5: Warn if switching from unknown provider
    if (activeProviderId === "unknown") {
      const baseUrl = await getActiveBaseUrl();
      console.log(`\n⚠ Current config uses an unrecognized provider (${baseUrl})`);
      const ok = await confirmAction("Switching will remove these settings. Continue?");
      if (!ok) continue;
    }

    const warnings = await switchProvider(provider, result, finalApiKey);
    printSwitchResult(provider.displayName, result, warnings);
    return;
  }
}

async function selectProvider(
  activeProviderId: string,
  activeModel: string | undefined,
  config: SwitchConfig,
): Promise<string | null> {
  try {
    return await withEsc(select({
      message: "Select Provider (ESC to quit)",
      choices: PROVIDERS.map((p) => {
        let hint: string;
        if (p.id === activeProviderId) {
          hint = activeModel ? `● active (${activeModel})` : "● active";
        } else if (p.id !== "claude" && getProviderApiKey(config, p.id)) {
          hint = "✔ configured";
        } else if (p.id === "claude") {
          hint = activeProviderId === "claude" ? "● active" : "";
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

// Fix #3: Loop on empty input instead of silently returning
async function promptApiKeyLoop(apiKeyUrl: string): Promise<string | null> {
  while (true) {
    const result = await promptApiKey(apiKeyUrl);
    if (result === null) return null; // ESC
    if (result === "") {
      console.log("  API Key cannot be empty, please try again.");
      continue;
    }
    return result;
  }
}

async function promptApiKey(apiKeyUrl: string): Promise<string | null | ""> {
  try {
    const key = await withEsc(password({
      message: `Enter API Key (get it from ${apiKeyUrl})`,
      mask: "*",
    }));
    const trimmed = key?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : "";
  } catch (err) {
    if (isCancelled(err)) {
      console.log("  Cancelled.");
      return null;
    }
    throw err;
  }
}

async function confirmAction(message: string): Promise<boolean> {
  try {
    return await withEsc(confirm({ message, default: false }));
  } catch (err) {
    if (isCancelled(err)) return false;
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

// Fix #2: Stay in menu after reconfigure (continue instead of return)
async function selectSingleModelAction(
  providerName: string,
  modelName: string,
  apiKeyUrl: string,
  config: SwitchConfig,
  providerId: string,
): Promise<"switch" | null> {
  while (true) {
    try {
      const result = await withEsc(select({
        message: `${providerName} (${modelName}) (ESC to go back)`,
        choices: [
          { name: `Switch to ${modelName}`, value: "switch" as const },
          { name: "🔑 Reconfigure API Key", value: RECONFIGURE_KEY },
        ],
      }));

      if (result === RECONFIGURE_KEY) {
        const newKey = await promptApiKeyLoop(apiKeyUrl);
        if (newKey) {
          const updated = setProviderApiKey(config, providerId, newKey);
          await writeConfig(updated);
          config = updated;
          console.log("✔ API Key updated\n");
        }
        continue; // Stay in menu
      }

      return "switch";
    } catch (err) {
      if (isCancelled(err)) return null;
      throw err;
    }
  }
}

// Fix #4: Move Reconfigure below models
async function selectModel(
  providerName: string,
  models: ProviderModel[],
  apiKeyUrl: string,
  config: SwitchConfig,
  providerId: string,
  currentActiveModel: string | undefined,
): Promise<string | null> {
  while (true) {
    try {
      const modelChoices = models.map((m) => {
        const isActive = m.name === currentActiveModel;
        return {
          name: isActive ? `${m.displayName ?? m.name}  ● active` : (m.displayName ?? m.name),
          value: m.name,
        };
      });
      const result = await withEsc(select({
        message: `Select model (${providerName}) (ESC to go back)`,
        default: modelChoices[0].value,
        choices: [
          ...modelChoices,
          new Separator(""),
          { name: "🔑 Reconfigure API Key", value: RECONFIGURE_KEY },
        ],
      }));

      if (result === RECONFIGURE_KEY) {
        const newKey = await promptApiKeyLoop(apiKeyUrl);
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
