import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

export interface ClaudeSettings {
  env?: Record<string, string | number>;
  [key: string]: unknown;
}

export async function readSettings(): Promise<ClaudeSettings> {
  let raw: string;
  try {
    raw = await readFile(SETTINGS_FILE, "utf-8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
  return JSON.parse(raw) as ClaudeSettings;
}

export async function writeSettings(settings: ClaudeSettings): Promise<void> {
  await mkdir(dirname(SETTINGS_FILE), { recursive: true });
  await writeFile(
    SETTINGS_FILE,
    JSON.stringify(settings, null, 2) + "\n",
    "utf-8",
  );
}
