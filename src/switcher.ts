import { MANAGED_ENV_KEYS, PROVIDERS, type ProviderDefinition } from "./providers.js";
import {
  readConfig,
  writeConfig,
  type SwitchConfig,
} from "./config.js";
import { readSettings, writeSettings } from "./settings.js";

/**
 * Detect which provider is currently active by inspecting settings.json env.
 * Returns the provider id, or "claude" if no third-party provider is detected.
 */
export async function detectActiveProvider(): Promise<string> {
  const settings = await readSettings();
  const env = settings.env ?? {};

  const baseUrl = env.ANTHROPIC_BASE_URL;
  if (typeof baseUrl === "string" && baseUrl.length > 0) {
    for (const provider of PROVIDERS) {
      if (provider.id !== "claude" && provider.baseUrl === baseUrl) {
        return provider.id;
      }
    }
  }

  return "claude";
}

/**
 * Backup native env keys before switching away from Claude native.
 */
async function backupNativeEnv(
  config: SwitchConfig,
  env: Record<string, string | number>,
): Promise<SwitchConfig> {
  const backup: Record<string, string | number> = {};
  for (const key of MANAGED_ENV_KEYS) {
    if (key in env) {
      backup[key] = env[key];
    }
  }

  const updated = {
    ...config,
    nativeEnvBackup: Object.keys(backup).length > 0 ? backup : undefined,
  };
  await writeConfig(updated);
  return updated;
}

/**
 * Clean all managed env keys from settings, preserving user-defined keys.
 */
function cleanManagedKeys(
  env: Record<string, string | number>,
): Record<string, string | number> {
  const cleaned = { ...env };
  for (const key of MANAGED_ENV_KEYS) {
    delete cleaned[key];
  }
  return cleaned;
}

/**
 * Switch to a specific provider and model.
 * Handles env cleanup, native backup/restore, and writing new env.
 */
export async function switchProvider(
  provider: ProviderDefinition,
  model: string,
  apiKey: string,
): Promise<void> {
  const config = await readConfig();
  const settings = await readSettings();
  const currentEnv = settings.env ?? {};

  // If currently on native, backup managed keys before switching out
  const currentProvider = await detectActiveProvider();
  let updatedConfig = config;
  if (currentProvider === "claude" && provider.id !== "claude") {
    updatedConfig = await backupNativeEnv(config, currentEnv);
  }

  // Clean all managed keys
  let newEnv = cleanManagedKeys(currentEnv);

  if (provider.id === "claude") {
    // Restore native backup if available
    if (updatedConfig.nativeEnvBackup) {
      newEnv = { ...newEnv, ...updatedConfig.nativeEnvBackup };
    }
  } else {
    // Write provider-specific env
    const providerEnv = provider.buildEnv(apiKey, model);
    newEnv = { ...newEnv, ...providerEnv };
  }

  // Write settings, preserving non-env fields
  await writeSettings({
    ...settings,
    env: Object.keys(newEnv).length > 0 ? newEnv : undefined,
  });
}
