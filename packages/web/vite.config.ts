import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const devApiPort = Number(env.JUST_ME_DEV_API_PORT ?? 7842);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": `http://127.0.0.1:${devApiPort}`,
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
