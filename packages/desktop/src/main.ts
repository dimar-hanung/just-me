import { app, BrowserWindow } from "electron";
import { startServer } from "@just-me/api";

const PORT = 7841;
const APP_URL = `http://127.0.0.1:${PORT}`;

let mainWindow: BrowserWindow | null = null;
let server: { close?: (callback?: () => void) => void } | null = null;

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

app.whenReady().then(async () => {
  server = await startServer(PORT);
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
  if (server && typeof server.close === "function") {
    server.close();
  }
});
