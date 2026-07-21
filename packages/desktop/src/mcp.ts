import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getConfigDir } from "@just-me/core";

function mergeCopyDir(source: string, target: string) {
  if (!existsSync(source)) {
    return;
  }
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source)) {
    const src = join(source, entry);
    const dest = join(target, entry);
    if (existsSync(dest)) {
      if (statSync(src).isDirectory() && statSync(dest).isDirectory()) {
        mergeCopyDir(src, dest);
      }
      continue;
    }
    cpSync(src, dest, { recursive: true, dereference: true });
  }
}

export function resolvePackagedMcpSource(): string | null {
  const fromEnv = process.env.JUST_ME_MCP_SOURCE;
  if (fromEnv && existsSync(join(fromEnv, "stdio.js"))) {
    return fromEnv;
  }

  const fromResources = join(process.resourcesPath, "mcp");
  if (existsSync(join(fromResources, "stdio.js"))) {
    return fromResources;
  }

  return null;
}

export function mirrorMcpToConfigDir(sourceDir: string): string {
  const targetDir = join(getConfigDir(), "mcp");
  rmSync(targetDir, { recursive: true, force: true });
  mergeCopyDir(sourceDir, targetDir);
  return join(targetDir, "stdio.js");
}

export function resolveDevMcpBundlePath(): string | null {
  const devPath = join(dirname(fileURLToPath(import.meta.url)), "../../mcp/dist/bundle/stdio.js");
  return existsSync(devPath) ? devPath : null;
}

export function configureMcpEnv(): string | null {
  const packagedSource = resolvePackagedMcpSource();
  if (packagedSource) {
    const stdioPath = mirrorMcpToConfigDir(packagedSource);
    process.env.JUST_ME_MCP_STDIO = stdioPath;
    return stdioPath;
  }

  const devPath = resolveDevMcpBundlePath();
  if (devPath) {
    process.env.JUST_ME_MCP_STDIO = devPath;
    return devPath;
  }

  return null;
}
