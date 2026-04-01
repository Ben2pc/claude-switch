import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

export interface ClaudeSettings {
  env?: Record<string, string | number>;
  [key: string]: unknown;
}

export async function readSettings(): Promise<ClaudeSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    return {};
  }
}

export async function writeSettings(settings: ClaudeSettings): Promise<void> {
  await writeFile(
    SETTINGS_FILE,
    JSON.stringify(settings, null, 2) + "\n",
    "utf-8",
  );
}
