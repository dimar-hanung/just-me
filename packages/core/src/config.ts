import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { AppConfigSchema, type AppConfig } from "./types.js";

export function getConfigDir(): string {
  return join(homedir(), ".config", "just-me");
}

export function getConfigPath(): string {
  if (process.env.JUST_ME_CONFIG) {
    return process.env.JUST_ME_CONFIG;
  }
  return join(getConfigDir(), "config.json");
}

export function getDefaultSqlitePath(): string {
  return join(getConfigDir(), "todos.sqlite");
}

export async function loadConfig(): Promise<AppConfig> {
  const path = getConfigPath();
  try {
    const raw = await readFile(path, "utf8");
    return AppConfigSchema.parse(JSON.parse(raw));
  } catch {
    return AppConfigSchema.parse({});
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const path = getConfigPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(config, null, 2), { mode: 0o600 });
  try {
    await chmod(path, 0o600);
  } catch {
    // chmod may fail on some filesystems
  }
}

export function resolveStorageUrl(storage: NonNullable<AppConfig["storage"]>): {
  url: string;
  authToken?: string;
} {
  if (storage.mode === "local") {
    const filePath = storage.path ?? getDefaultSqlitePath();
    return { url: `file:${filePath}` };
  }
  return { url: storage.url, authToken: storage.authToken };
}
