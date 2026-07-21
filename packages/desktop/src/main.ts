import "./env.js";
import { app, BrowserWindow, dialog } from "electron";
import { DEFAULT_API_PORT, startServer, type ApiServer } from "@just-me/api";

const PORT = DEFAULT_API_PORT;
const APP_URL = `http://127.0.0.1:${PORT}`;

let mainWindow: BrowserWindow | null = null;
let server: ApiServer | null = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

async function isJustMeApiRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${APP_URL}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) {
      return false;
    }
    const data = (await res.json()) as { app?: string };
    return data.app === "just-me";
  } catch {
    return false;
  }
}

async function ensureApiServer(): Promise<ApiServer> {
  try {
    return await startServer(PORT);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    if (code !== "EADDRINUSE") {
      throw error;
    }

    if (await isJustMeApiRunning()) {
      return { port: PORT, owned: false, close: () => {} };
    }

    dialog.showErrorBox(
      "Just Me could not start",
      [
        `Port ${PORT} is already in use by another program.`,
        "",
        "Try this:",
        "• Close any other Just Me windows",
        "• Stop a dev API if you ran `pnpm dev:api`",
        "• Restart your computer if the problem persists",
      ].join("\n"),
    );
    app.quit();
    throw error;
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Just Me",
  });

  await mainWindow.loadURL(APP_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function focusMainWindow() {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

if (gotSingleInstanceLock) {
  app.on("second-instance", () => {
    focusMainWindow();
  });
}

app.whenReady().then(async () => {
  server = await ensureApiServer();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (server?.owned) {
    server.close();
  }
});
