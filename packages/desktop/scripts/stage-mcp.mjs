import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = join(scriptDir, "..");
const source = join(desktopDir, "../mcp/dist/bundle");
const target = join(desktopDir, "resources/mcp");

if (!existsSync(join(source, "stdio.js"))) {
  console.error("Missing MCP bundle. Run: pnpm --filter @just-me/mcp build");
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`Staged MCP bundle to ${target}`);
