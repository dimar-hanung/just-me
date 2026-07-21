import * as esbuild from "esbuild";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mcpDir = join(scriptDir, "..");
const bundleDir = join(mcpDir, "dist/bundle");
const bundleNodeModules = join(bundleDir, "node_modules");
const rootRequire = createRequire(join(mcpDir, "../core/package.json"));

/** Packages that must stay external (native binaries + libsql driver tree). */
const EXTERNAL_PACKAGES = [
  "@libsql/client",
  "@libsql/core",
  "@libsql/hrana-client",
  "@libsql/isomorphic-fetch",
  "@libsql/isomorphic-ws",
  "@libsql/linux-x64-gnu",
  "@libsql/linux-x64-musl",
  "@libsql/win32-x64-msvc",
  "libsql",
  "js-base64",
  "promise-limit",
  "detect-libc",
  "@neon-rs/load",
  "node-fetch",
  "fetch-blob",
  "formdata-polyfill",
  "data-uri-to-buffer",
  "web-streams-polyfill",
  "node-domexception",
];

function resolvePackageDir(name, requireFrom) {
  let entry;
  try {
    entry = requireFrom.resolve(name);
  } catch {
    return null;
  }

  let dir = dirname(entry);
  while (dir !== dirname(dir)) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg.name === name) {
          return dir;
        }
      } catch {
        // keep walking
      }
    }
    dir = dirname(dir);
  }
  return null;
}

function mergeCopyNodeModules(sourceNm, targetNm) {
  if (!existsSync(sourceNm)) {
    return;
  }
  mkdirSync(targetNm, { recursive: true });
  for (const entry of readdirSync(sourceNm)) {
    const src = join(sourceNm, entry);
    const dest = join(targetNm, entry);
    if (existsSync(dest)) {
      if (statSync(src).isDirectory() && statSync(dest).isDirectory()) {
        mergeCopyNodeModules(src, dest);
      }
      continue;
    }
    cpSync(src, dest, { recursive: true, dereference: true });
  }
}

function copyPackageTree(name, requireFrom, copiedPnpmDirs) {
  const pkgDir = resolvePackageDir(name, requireFrom);
  if (!pkgDir) {
    return;
  }

  const pnpmNodeModules = join(pkgDir, "..", "..");
  if (!copiedPnpmDirs.has(pnpmNodeModules)) {
    copiedPnpmDirs.add(pnpmNodeModules);
    mergeCopyNodeModules(pnpmNodeModules, bundleNodeModules);
  }

  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  const deps = {
    ...pkg.dependencies,
    ...pkg.optionalDependencies,
  };
  const pkgRequire = createRequire(join(pkgDir, "package.json"));
  for (const dep of Object.keys(deps)) {
    if (!EXTERNAL_PACKAGES.includes(dep) && !dep.startsWith("@libsql/")) {
      continue;
    }
    copyPackageTree(dep, pkgRequire, copiedPnpmDirs);
  }
}

rmSync(bundleDir, { recursive: true, force: true });
mkdirSync(bundleDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(mcpDir, "src/stdio.ts")],
  outfile: join(bundleDir, "stdio.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: false,
  external: EXTERNAL_PACKAGES,
  banner: {
    js: "#!/usr/bin/env node",
  },
});

const copiedPnpmDirs = new Set();
copyPackageTree("@libsql/client", rootRequire, copiedPnpmDirs);

console.log(`MCP bundle written to ${bundleDir}/stdio.js`);
