import { MANAGED_ENV_KEYS, PROVIDERS, type ProviderDefinition } from "./providers.js";
import {
  readConfig,
  writeConfig,
  type SwitchConfig,
} from "./config.js";
import { readSettings, writeSettings, type ClaudeSettings } from "./settings.js";

/**
 * Detect which provider is currently active from a settings object.
 * Returns "claude" only if no ANTHROPIC_BASE_URL is set.
 * Returns "unknown" if base URL is set but doesn't match any known provider.
 */
export function detectActiveProviderFromSettings(settings: ClaudeSettings): string {
  const env = settings.env ?? {};

  const baseUrl = env.ANTHROPIC_BASE_URL;
  if (typeof baseUrl === "string" && baseUrl.length > 0) {
    for (const provider of PROVIDERS) {
      if (provider.id !== "claude" && provider.baseUrl === baseUrl) {
        return provider.id;
      }
    }
    return "unknown";
  }

  return "claude";
}

/**
 * Detect which provider is currently active by reading settings.json.
 */
export async function detectActiveProvider(): Promise<string> {
  const settings = await readSettings();
  return detectActiveProviderFromSettings(settings);
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

  // Detect current provider from already-read settings (no double read)
  const currentProviderId = detectActiveProviderFromSettings(settings);

  // Only backup when switching FROM native (not "unknown")
  let updatedConfig = config;
  if (currentProviderId === "claude" && provider.id !== "claude") {
    updatedConfig = await backupNativeEnv(config, currentEnv);
  }

  // Clean all managed keys
  let newEnv = cleanManagedKeys(currentEnv);

  if (provider.id === "claude") {
    // Restore native backup if available
    if (updatedConfig.nativeEnvBackup) {
      newEnv = { ...newEnv, ...updatedConfig.nativeEnvBackup };
      // Clear backup after restore
      updatedConfig = { ...updatedConfig, nativeEnvBackup: undefined };
      await writeConfig(updatedConfig);
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
