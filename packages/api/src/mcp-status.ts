import { existsSync } from "node:fs";
import { getConfigPath, loadConfig } from "@just-me/core";

export type McpStatus = "ready" | "missing" | "needs_onboarding";

export type McpSetupInfo = {
  status: McpStatus;
  stdioPath: string | null;
  configPath: string;
  available: boolean;
  cursorConfig: {
    mcpServers: {
      "just-me-todos": {
        command: "node";
        args: [string];
        env: { JUST_ME_CONFIG: string };
      };
    };
  } | null;
};

export async function resolveMcpSetup(): Promise<McpSetupInfo> {
  const configPath = getConfigPath();
  const config = await loadConfig();
  const stdioFromEnv = process.env.JUST_ME_MCP_STDIO?.trim() ?? "";
  const stdioPath =
    stdioFromEnv && existsSync(stdioFromEnv) ? stdioFromEnv : null;

  if (!stdioPath) {
    return {
      status: "missing",
      stdioPath: null,
      configPath,
      available: false,
      cursorConfig: null,
    };
  }

  if (!config.onboardingComplete || !config.storage) {
    return {
      status: "needs_onboarding",
      stdioPath,
      configPath,
      available: true,
      cursorConfig: null,
    };
  }

  return {
    status: "ready",
    stdioPath,
    configPath,
    available: true,
    cursorConfig: {
      mcpServers: {
        "just-me-todos": {
          command: "node",
          args: [stdioPath],
          env: {
            JUST_ME_CONFIG: configPath,
          },
        },
      },
    },
  };
}
