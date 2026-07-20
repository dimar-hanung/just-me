import { google } from "googleapis";
import type { AppConfig } from "./types.js";
import type { Client } from "@libsql/client";
import { exportTodosJson, importTodosJson } from "./todos.js";

const BACKUP_FOLDER_NAME = "just-me-todos";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

export function getGoogleClientIds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getGoogleAuthUrl(config: AppConfig, redirectUri: string): string {
  const env = getGoogleClientIds();
  const clientId = config.google?.clientId ?? env?.clientId;
  const clientSecret = config.google?.clientSecret ?? env?.clientSecret;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client ID and secret are required");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeGoogleCode(
  config: AppConfig,
  code: string,
  redirectUri: string,
): Promise<AppConfig> {
  const env = getGoogleClientIds();
  const clientId = config.google?.clientId ?? env?.clientId;
  const clientSecret = config.google?.clientSecret ?? env?.clientSecret;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client ID and secret are required");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh token returned. Revoke app access and try again with consent.");
  }

  return {
    ...config,
    google: {
      clientId,
      clientSecret,
      refreshToken: tokens.refresh_token,
    },
  };
}

function getOAuthClient(config: AppConfig) {
  const env = getGoogleClientIds();
  const clientId = config.google?.clientId ?? env?.clientId;
  const clientSecret = config.google?.clientSecret ?? env?.clientSecret;
  const refreshToken = config.google?.refreshToken;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive is not connected");
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

async function getOrCreateBackupFolder(config: AppConfig, drive: ReturnType<typeof google.drive>): Promise<string> {
  if (config.backup?.folderId) {
    return config.backup.folderId;
  }

  const search = await drive.files.list({
    q: `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1,
  });

  const existing = search.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name: BACKUP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  const folderId = created.data.id;
  if (!folderId) throw new Error("Failed to create backup folder");
  return folderId;
}

export type DriveBackup = {
  id: string;
  name: string;
  createdTime: string;
};

export async function backupToDrive(client: Client, config: AppConfig): Promise<{ fileId: string; fileName: string; folderId: string }> {
  const auth = getOAuthClient(config);
  const drive = google.drive({ version: "v3", auth });
  const folderId = await getOrCreateBackupFolder(config, drive);
  const json = await exportTodosJson(client);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `todos-${timestamp}.json`;

  const uploaded = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/json",
    },
    media: {
      mimeType: "application/json",
      body: json,
    },
    fields: "id,name",
  });

  const fileId = uploaded.data.id;
  if (!fileId) throw new Error("Upload failed");
  return { fileId, fileName, folderId };
}

export async function listBackups(config: AppConfig): Promise<DriveBackup[]> {
  const auth = getOAuthClient(config);
  const drive = google.drive({ version: "v3", auth });
  const folderId = await getOrCreateBackupFolder(config, drive);

  const result = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
    fields: "files(id,name,createdTime)",
    orderBy: "createdTime desc",
    pageSize: 50,
  });

  return (result.data.files ?? []).map((file) => ({
    id: file.id!,
    name: file.name ?? "backup.json",
    createdTime: file.createdTime ?? "",
  }));
}

export async function restoreFromDrive(client: Client, config: AppConfig, fileId: string): Promise<void> {
  const auth = getOAuthClient(config);
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
  const json = response.data as string;
  await importTodosJson(client, json);
}

export function isDriveConnected(config: AppConfig): boolean {
  return Boolean(config.google?.refreshToken);
}
