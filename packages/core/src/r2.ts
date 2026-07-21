import { randomUUID } from "node:crypto";
import { R2ConfigSchema, type AppConfig } from "./types.js";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const CF_API_BASE = "https://api.cloudflare.com/client/v4";

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const FILE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-gzip",
]);

export const ALLOWED_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, ...FILE_MIME_TYPES]);

export type R2Config = NonNullable<AppConfig["r2"]>;

export type UploadResult = {
  key: string;
  mimeType: string;
  size: number;
  isImage: boolean;
  filename: string;
};

export type R2Object = {
  body: Uint8Array;
  mimeType: string;
  size: number;
};

export type R2SettingsInput = {
  accountId: string;
  bucketName: string;
  apiToken?: string;
  jurisdiction?: "eu";
  publicUrl?: string;
};

const ACCOUNT_ID_HELP =
  "Enter the 32-character Account ID from Dashboard → R2 → Overview, or paste your R2 endpoint URL (e.g. https://<account-id>.r2.cloudflarestorage.com/bucket-name).";

export function parseR2AccountInput(raw: string): {
  accountId: string;
  jurisdiction?: "eu";
  bucketName?: string;
} {
  const trimmed = raw.trim();
  const urlCandidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(urlCandidate);
    const hostMatch = url.hostname.match(/^([a-f0-9]{32})(\.eu)?\.r2\.cloudflarestorage\.com$/i);
    if (hostMatch) {
      const pathBucket = url.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
      return {
        accountId: hostMatch[1].toLowerCase(),
        jurisdiction: hostMatch[2] ? "eu" : undefined,
        bucketName: pathBucket || undefined,
      };
    }
  } catch {
    // Not a URL — fall through to plain account ID parsing.
  }

  const compact = trimmed.replace(/[\s-]/g, "");
  if (/^[a-f0-9]{32}$/i.test(compact)) {
    return { accountId: compact.toLowerCase() };
  }

  throw new Error(ACCOUNT_ID_HELP);
}

export function normalizeR2Input(input: R2SettingsInput): R2Config {
  const parsed = parseR2AccountInput(input.accountId);
  const bucketName = input.bucketName.trim() || parsed.bucketName || "";
  if (!bucketName) {
    throw new Error("Bucket name is required (enter it separately or append to the endpoint URL).");
  }

  const apiToken = input.apiToken?.trim() || undefined;
  if (!apiToken) {
    throw new Error("Cloudflare API token is required.");
  }
  if (/^[a-f0-9]{32}$/i.test(apiToken)) {
    throw new Error(
      "This looks like an R2 Access Key ID. Use the Token Value from an Admin Read & Write token.",
    );
  }
  if (/^[a-f0-9]{64}$/i.test(apiToken)) {
    throw new Error(
      "This looks like an R2 Secret Access Key. Use the Token Value from an Admin Read & Write token.",
    );
  }

  return R2ConfigSchema.parse({
    accountId: parsed.accountId,
    bucketName,
    apiToken,
    jurisdiction: input.jurisdiction ?? parsed.jurisdiction,
    publicUrl: input.publicUrl?.trim() || undefined,
  });
}

export function isR2Configured(config: AppConfig): boolean {
  const r2 = config.r2;
  return Boolean(r2?.accountId && r2.bucketName && r2.apiToken);
}

function encodeObjectKeyForUrl(key: string): string {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function buildRestHeaders(r2: R2Config, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${r2.apiToken ?? ""}`,
    ...extra,
  };
  if (r2.jurisdiction === "eu") {
    headers["cf-r2-jurisdiction"] = "eu";
  }
  return headers;
}

async function parseCfApiError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as {
    errors?: Array<{ code?: number; message?: string }>;
  } | null;
  const firstError = data?.errors?.[0];
  const message = firstError?.message;
  if (
    firstError?.code === 10000 ||
    firstError?.code === 10002 ||
    message?.toLowerCase().includes("authentication")
  ) {
    return "Cloudflare rejected the token. Use the Token Value from an R2 Admin Read & Write token—not the Access Key ID, Secret Access Key, or an Object Read & Write token.";
  }
  if (message) return message;
  return `Cloudflare API error (${res.status})`;
}

async function testR2RestConnection(r2: R2Config): Promise<void> {
  const url = `${CF_API_BASE}/accounts/${r2.accountId}/r2/buckets/${encodeURIComponent(r2.bucketName)}`;
  const res = await fetch(url, { headers: buildRestHeaders(r2) });
  if (!res.ok) {
    throw new Error(await parseCfApiError(res));
  }
}

async function uploadToR2Rest(
  r2: R2Config,
  key: string,
  buffer: Uint8Array,
  mimeType: string,
): Promise<void> {
  const url = `${CF_API_BASE}/accounts/${r2.accountId}/r2/buckets/${encodeURIComponent(r2.bucketName)}/objects/${encodeObjectKeyForUrl(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: buildRestHeaders(r2, { "Content-Type": mimeType }),
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(await parseCfApiError(res));
  }
}

async function getFromR2Rest(r2: R2Config, key: string): Promise<R2Object | null> {
  const url = `${CF_API_BASE}/accounts/${r2.accountId}/r2/buckets/${encodeURIComponent(r2.bucketName)}/objects/${encodeObjectKeyForUrl(key)}`;
  const res = await fetch(url, { headers: buildRestHeaders(r2) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await parseCfApiError(res));
  }

  const body = new Uint8Array(await res.arrayBuffer());
  return {
    body,
    mimeType: res.headers.get("content-type") ?? "application/octet-stream",
    size: body.byteLength,
  };
}

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").trim();
  return cleaned || "file";
}

export function buildObjectKey(filename: string): string {
  return `uploads/${randomUUID()}/${sanitizeFilename(filename)}`;
}

export function buildUploadUrl(key: string): string {
  const encoded = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/uploads/${encoded}`;
}

export function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

export function assertAllowedMimeType(mimeType: string): void {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`File type not allowed: ${mimeType || "unknown"}`);
  }
}

export function assertUploadSize(size: number): void {
  if (size <= 0) {
    throw new Error("File is empty");
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`);
  }
}

export async function testR2Connection(config: AppConfig): Promise<void> {
  const r2 = config.r2;
  if (!r2) {
    throw new Error("R2 is not configured");
  }

  await testR2RestConnection(r2);
}

export async function uploadToR2(
  config: AppConfig,
  input: { buffer: Uint8Array; filename: string; mimeType: string },
): Promise<UploadResult> {
  const r2 = config.r2;
  if (!r2) {
    throw new Error("R2 is not configured");
  }

  assertUploadSize(input.buffer.byteLength);
  assertAllowedMimeType(input.mimeType);

  const key = buildObjectKey(input.filename);
  await uploadToR2Rest(r2, key, input.buffer, input.mimeType);

  return {
    key,
    mimeType: input.mimeType,
    size: input.buffer.byteLength,
    isImage: isImageMimeType(input.mimeType),
    filename: sanitizeFilename(input.filename),
  };
}

export async function getFromR2(config: AppConfig, key: string): Promise<R2Object | null> {
  const r2 = config.r2;
  if (!r2) {
    throw new Error("R2 is not configured");
  }

  if (!key.startsWith("uploads/")) {
    return null;
  }

  return getFromR2Rest(r2, key);
}
