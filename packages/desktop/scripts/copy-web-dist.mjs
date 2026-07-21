import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = join(scriptDir, "..");
const source = join(desktopDir, "../web/dist");
const target = join(desktopDir, "web-dist");

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
