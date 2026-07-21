import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  loadConfig,
  saveConfig,
  getDefaultSqlitePath,
  testStorageConnection,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  isDriveConnected,
  listStatuses,
  createStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
  listFields,
  createField,
  updateField,
  deleteField,
  reorderFields,
  createFieldOption,
  updateFieldOption,
  deleteFieldOption,
  listTodos,
  listTrash,
  getTodo,
  addTodo,
  updateTodo,
  deleteTodo,
  restoreTodo,
  purgeTodo,
  emptyTrash,
  backupToDrive,
  listBackups,
  restoreFromDrive,
  StorageSchema,
  isR2Configured,
  testR2Connection,
  uploadToR2,
  getFromR2,
  buildUploadUrl,
  MAX_UPLOAD_BYTES,
  normalizeR2Input,
  ViewFiltersSchema,
  ViewSortSchema,
  listViews,
  getView,
  createView,
  updateView,
  deleteView,
  reorderViews,
  type DbContext,
  type ViewFilters,
  type ViewSort,
} from "@just-me/core";
import { requireOnboarding, withDb } from "./middleware.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";

type Variables = { db: DbContext };

export const DEFAULT_API_PORT = 7841;
export const DEFAULT_DEV_API_PORT = 7842;

const app = new Hono<{ Variables: Variables }>();

function resolveApiPort(): number {
  const fromEnv = process.env.PORT ?? process.env.JUST_ME_DEV_API_PORT;
  if (fromEnv) {
    return Number(fromEnv);
  }
  return DEFAULT_API_PORT;
}

function getGoogleRedirectUri(): string {
  return `http://127.0.0.1:${resolveApiPort()}/api/onboarding/google/callback`;
}

app.get("/api/health", async (c) => {
  const config = await loadConfig();
  if (!config.storage) {
    return c.json({
      app: "just-me",
      ok: false,
      onboardingComplete: config.onboardingComplete,
      storage: null,
    });
  }
  try {
    await testStorageConnection(config);
    const r2Configured = isR2Configured(config);
    let r2Reachable: boolean | null = null;
    if (r2Configured) {
      try {
        await testR2Connection(config);
        r2Reachable = true;
      } catch {
        r2Reachable = false;
      }
    }
    return c.json({
      app: "just-me",
      ok: true,
      onboardingComplete: config.onboardingComplete,
      storage: config.storage.mode,
      driveConnected: isDriveConnected(config),
      r2Configured,
      r2Reachable,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage unreachable";
    return c.json({
      app: "just-me",
      ok: false,
      error: message,
      onboardingComplete: config.onboardingComplete,
    }, 503);
  }
});

app.get("/api/onboarding", async (c) => {
  const config = await loadConfig();
  return c.json({
    complete: config.onboardingComplete,
    storageMode: config.storage?.mode ?? null,
    driveConnected: isDriveConnected(config),
    defaultSqlitePath: getDefaultSqlitePath(),
  });
});

app.put("/api/onboarding/storage", async (c) => {
  const body = await c.req.json();
  const config = await loadConfig();

  let storage;
  if (body.mode === "local") {
    storage = StorageSchema.parse({ mode: "local", path: body.path });
  } else if (body.mode === "turso") {
    storage = StorageSchema.parse({
      mode: "turso",
      url: body.url,
      authToken: body.authToken,
    });
  } else {
    return c.json({ error: "Invalid storage mode" }, 400);
  }

  const draft = { ...config, storage };
  try {
    await testStorageConnection(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return c.json({ error: message }, 400);
  }

  await saveConfig(draft);
  return c.json({ ok: true, storageMode: storage.mode });
});

app.get("/api/onboarding/google/auth-url", async (c) => {
  const config = await loadConfig();
  try {
    const url = getGoogleAuthUrl(config, getGoogleRedirectUri());
    return c.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth not configured";
    return c.json({ error: message }, 400);
  }
});

app.get("/api/onboarding/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.text("Missing authorization code", 400);
  }
  const config = await loadConfig();
  try {
    const updated = await exchangeGoogleCode(config, code, getGoogleRedirectUri());
    const folderBackup = updated.backup ?? {};
    await saveConfig({ ...updated, backup: folderBackup });
    return c.redirect("/onboarding?drive=connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth exchange failed";
    return c.text(message, 400);
  }
});

app.post("/api/onboarding/google/exchange", async (c) => {
  const body = await c.req.json();
  const config = await loadConfig();
  if (!body.code) return c.json({ error: "code is required" }, 400);
  try {
    const updated = await exchangeGoogleCode(config, body.code, getGoogleRedirectUri());
    await saveConfig(updated);
    return c.json({ ok: true, driveConnected: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth exchange failed";
    return c.json({ error: message }, 400);
  }
});

app.post("/api/onboarding/complete", async (c) => {
  const config = await loadConfig();
  if (!config.storage) {
    return c.json({ error: "Configure storage first" }, 400);
  }
  await saveConfig({ ...config, onboardingComplete: true });
  return c.json({ ok: true });
});

const api = new Hono<{ Variables: Variables }>();
api.use("*", requireOnboarding);

api.get("/settings", async (c) => {
  const config = await loadConfig();
  const r2Configured = isR2Configured(config);
  return c.json({
    onboardingComplete: config.onboardingComplete,
    storage: config.storage ?? null,
    driveConnected: isDriveConnected(config),
    googleConfigured: Boolean(config.google?.clientId || process.env.GOOGLE_CLIENT_ID),
    r2Configured,
    r2: r2Configured
      ? {
          accountId: config.r2!.accountId,
          bucketName: config.r2!.bucketName,
          jurisdiction: config.r2!.jurisdiction,
        }
      : null,
  });
});

api.put("/settings/r2", async (c) => {
  const body = await c.req.json();
  const config = await loadConfig();
  const existingApiToken = config.r2?.apiToken;
  const apiToken =
    typeof body.apiToken === "string" && body.apiToken.trim()
      ? body.apiToken.trim()
      : existingApiToken;

  if (!apiToken) {
    return c.json({ error: "apiToken is required" }, 400);
  }

  let r2;
  try {
    r2 = normalizeR2Input({
      accountId: body.accountId,
      bucketName: body.bucketName,
      apiToken,
      jurisdiction: body.jurisdiction === "eu" ? "eu" : undefined,
      publicUrl: body.publicUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid R2 settings";
    return c.json({ error: message }, 400);
  }
  const draft = { ...config, r2 };
  try {
    await testR2Connection(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "R2 connection failed";
    return c.json({ error: message }, 400);
  }
  await saveConfig(draft);
  return c.json({ ok: true, r2Configured: true });
});

api.delete("/settings/r2", async (c) => {
  const config = await loadConfig();
  const { r2: _removed, ...rest } = config;
  await saveConfig(rest);
  return c.json({ ok: true, r2Configured: false });
});

api.put("/settings/storage", async (c) => {
  const body = await c.req.json();
  const config = await loadConfig();
  let storage;
  if (body.mode === "local") {
    storage = StorageSchema.parse({ mode: "local", path: body.path });
  } else {
    storage = StorageSchema.parse({
      mode: "turso",
      url: body.url,
      authToken: body.authToken,
    });
  }
  const draft = { ...config, storage };
  try {
    await testStorageConnection(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return c.json({ error: message }, 400);
  }
  await saveConfig(draft);
  return c.json({ ok: true, warning: "Storage changed. Data is not migrated automatically." });
});

api.get("/statuses", withDb, async (c) => {
  const { client } = c.get("db");
  return c.json(await listStatuses(client));
});

api.post("/statuses", withDb, async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);
  const { client } = c.get("db");
  const status = await createStatus(client, body.name, body.sortOrder);
  return c.json(status, 201);
});

api.patch("/statuses/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const body = await c.req.json();
  const { client } = c.get("db");
  const updated = await updateStatus(client, id, {
    name: body.name,
    sortOrder: body.sortOrder,
  });
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

api.delete("/statuses/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const { client } = c.get("db");
  const result = await deleteStatus(client, id);
  if (!result.ok) return c.json({ error: result.reason }, 400);
  return c.json({ ok: true });
});

api.put("/statuses/reorder", withDb, async (c) => {
  const body = await c.req.json();
  if (!Array.isArray(body.orderedIds)) {
    return c.json({ error: "orderedIds array required" }, 400);
  }
  const { client } = c.get("db");
  return c.json(await reorderStatuses(client, body.orderedIds));
});

api.get("/fields", withDb, async (c) => {
  const { client } = c.get("db");
  return c.json(await listFields(client));
});

api.post("/fields", withDb, async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: "name is required" }, 400);
  if (!body.type) return c.json({ error: "type is required" }, 400);
  const { client } = c.get("db");
  try {
    const field = await createField(client, body.name, body.type, body.sortOrder);
    return c.json(field, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create field";
    return c.json({ error: message }, 400);
  }
});

api.patch("/fields/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const body = await c.req.json();
  const { client } = c.get("db");
  const updated = await updateField(client, id, {
    name: body.name,
    sortOrder: body.sortOrder,
  });
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

api.delete("/fields/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const { client } = c.get("db");
  await deleteField(client, id);
  return c.json({ ok: true });
});

api.put("/fields/reorder", withDb, async (c) => {
  const body = await c.req.json();
  if (!Array.isArray(body.orderedIds)) {
    return c.json({ error: "orderedIds array required" }, 400);
  }
  const { client } = c.get("db");
  return c.json(await reorderFields(client, body.orderedIds));
});

api.post("/fields/:id/options", withDb, async (c) => {
  const fieldId = c.req.param("id");
  if (!fieldId) return c.json({ error: "id is required" }, 400);
  const body = await c.req.json();
  if (!body.label) return c.json({ error: "label is required" }, 400);
  const { client } = c.get("db");
  try {
    const option = await createFieldOption(client, fieldId, body.label, body.sortOrder);
    if (!option) return c.json({ error: "Field not found" }, 404);
    return c.json(option, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create option";
    return c.json({ error: message }, 400);
  }
});

api.patch("/fields/:fieldId/options/:optionId", withDb, async (c) => {
  const fieldId = c.req.param("fieldId");
  const optionId = c.req.param("optionId");
  if (!fieldId || !optionId) return c.json({ error: "fieldId and optionId are required" }, 400);
  const body = await c.req.json();
  const { client } = c.get("db");
  const updated = await updateFieldOption(client, fieldId, optionId, {
    label: body.label,
    sortOrder: body.sortOrder,
  });
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

api.delete("/fields/:fieldId/options/:optionId", withDb, async (c) => {
  const fieldId = c.req.param("fieldId");
  const optionId = c.req.param("optionId");
  if (!fieldId || !optionId) return c.json({ error: "fieldId and optionId are required" }, 400);
  const { client } = c.get("db");
  const result = await deleteFieldOption(client, fieldId, optionId);
  if (!result.ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

api.get("/views", withDb, async (c) => {
  const { client } = c.get("db");
  return c.json(await listViews(client));
});

api.post("/views", withDb, async (c) => {
  const body = await c.req.json();
  const { client } = c.get("db");

  let copyFrom;
  if (body.copyFromId) {
    copyFrom = await getView(client, body.copyFromId);
    if (!copyFrom) return c.json({ error: "copyFromId view not found" }, 404);
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "New view";
  const view = await createView(client, {
    name,
    layout: body.layout,
    filters: body.filters,
    sorts: body.sorts,
    columns: body.columns,
    pageSize: body.pageSize,
    copyFrom: copyFrom ?? undefined,
  });
  return c.json(view, 201);
});

api.put("/views/reorder", withDb, async (c) => {
  const body = await c.req.json();
  if (!Array.isArray(body.ids)) {
    return c.json({ error: "ids array is required" }, 400);
  }
  const { client } = c.get("db");
  try {
    return c.json(await reorderViews(client, body.ids));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Reorder failed" }, 400);
  }
});

api.get("/views/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const { client } = c.get("db");
  const view = await getView(client, id);
  if (!view) return c.json({ error: "Not found" }, 404);
  return c.json(view);
});

api.patch("/views/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const body = await c.req.json();
  const { client } = c.get("db");

  if (body.filters !== undefined) {
    const parsed = ViewFiltersSchema.safeParse(body.filters);
    if (!parsed.success) return c.json({ error: "Invalid filters" }, 400);
  }
  if (body.sorts !== undefined) {
    const parsed = ViewSortSchema.array().safeParse(body.sorts);
    if (!parsed.success) return c.json({ error: "Invalid sorts" }, 400);
  }

  const updated = await updateView(client, id, {
    name: body.name,
    layout: body.layout,
    filters: body.filters,
    sorts: body.sorts,
    columns: body.columns,
    pageSize: body.pageSize,
  });
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

api.delete("/views/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const { client } = c.get("db");
  const result = await deleteView(client, id);
  if (!result.ok) return c.json({ error: result.reason ?? "Delete failed" }, 400);
  return c.json({ ok: true });
});

function parseJsonQuery<T>(raw: string | undefined, label: string): T | undefined | "invalid" {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return "invalid";
  }
}

api.get("/todos", withDb, async (c) => {
  const { client } = c.get("db");
  const statusId = c.req.query("status_id") ?? undefined;
  const code = c.req.query("code") ?? undefined;
  const limitRaw = c.req.query("limit");
  const offsetRaw = c.req.query("offset");
  const filtersRaw = c.req.query("filters");
  const sortsRaw = c.req.query("sorts");

  let filters: ViewFilters | undefined;
  if (filtersRaw !== undefined) {
    const parsed = parseJsonQuery<unknown>(filtersRaw, "filters");
    if (parsed === "invalid") return c.json({ error: "Invalid filters JSON" }, 400);
    const validated = ViewFiltersSchema.safeParse(parsed);
    if (!validated.success) return c.json({ error: "Invalid filters" }, 400);
    filters = validated.data as ViewFilters;
  }

  let sorts: ViewSort[] | undefined;
  if (sortsRaw !== undefined) {
    const parsed = parseJsonQuery<unknown>(sortsRaw, "sorts");
    if (parsed === "invalid") return c.json({ error: "Invalid sorts JSON" }, 400);
    const validated = ViewSortSchema.array().safeParse(parsed);
    if (!validated.success) return c.json({ error: "Invalid sorts" }, 400);
    sorts = validated.data as ViewSort[];
  }

  const listParams = { statusId, code, filters, sorts };

  if (limitRaw !== undefined) {
    const limit = Number(limitRaw);
    const offset = offsetRaw !== undefined ? Number(offsetRaw) : 0;
    if (!Number.isInteger(limit) || limit <= 0) {
      return c.json({ error: "limit must be a positive integer" }, 400);
    }
    if (!Number.isInteger(offset) || offset < 0) {
      return c.json({ error: "offset must be a non-negative integer" }, 400);
    }
    return c.json(await listTodos(client, { ...listParams, limit, offset }));
  }

  return c.json(await listTodos(client, listParams));
});

api.get("/todos/trash", withDb, async (c) => {
  const { client } = c.get("db");
  return c.json(await listTrash(client));
});

api.delete("/todos/trash", withDb, async (c) => {
  const { client } = c.get("db");
  const deleted = await emptyTrash(client);
  return c.json({ ok: true, deleted });
});

api.get("/todos/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const { client } = c.get("db");
  const todo = await getTodo(client, id);
  if (!todo) return c.json({ error: "Not found" }, 404);
  return c.json(todo);
});

api.post("/todos", withDb, async (c) => {
  const body = await c.req.json();
  if (!body.title) return c.json({ error: "title is required" }, 400);
  const { client } = c.get("db");
  const todo = await addTodo(client, {
    title: body.title,
    content: body.content,
    statusId: body.statusId,
    dueAt: body.dueAt ?? null,
    fieldValues: body.fieldValues,
  });
  return c.json(todo, 201);
});

api.patch("/todos/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const body = await c.req.json();
  const { client } = c.get("db");
  const todo = await updateTodo(client, id, {
    title: body.title,
    content: body.content,
    statusId: body.statusId,
    dueAt: body.dueAt,
    fieldValues: body.fieldValues,
  });
  if (!todo) return c.json({ error: "Not found" }, 404);
  return c.json(todo);
});

api.delete("/todos/:id", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const { client } = c.get("db");
  const ok = await deleteTodo(client, id);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

api.post("/todos/:id/restore", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const { client } = c.get("db");
  const todo = await restoreTodo(client, id);
  if (!todo) return c.json({ error: "Not found" }, 404);
  return c.json(todo);
});

api.delete("/todos/:id/permanent", withDb, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);
  const { client } = c.get("db");
  const ok = await purgeTodo(client, id);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

api.post("/backup", withDb, async (c) => {
  const config = await loadConfig();
  const { client } = c.get("db");
  try {
    const result = await backupToDrive(client, config);
    if (!config.backup?.folderId) {
      await saveConfig({ ...config, backup: { folderId: result.folderId } });
    }
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    return c.json({ error: message }, 400);
  }
});

api.get("/backups", async (c) => {
  const config = await loadConfig();
  try {
    return c.json(await listBackups(config));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list backups";
    return c.json({ error: message }, 400);
  }
});

api.post("/restore", withDb, async (c) => {
  const body = await c.req.json();
  if (!body.fileId) return c.json({ error: "fileId is required" }, 400);
  const config = await loadConfig();
  const { client } = c.get("db");
  try {
    await restoreFromDrive(client, config, body.fileId);
    return c.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed";
    return c.json({ error: message }, 400);
  }
});

api.post("/uploads", async (c) => {
  const config = await loadConfig();
  if (!isR2Configured(config)) {
    return c.json({ error: "R2 is not configured" }, 503);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Expected multipart form data" }, 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "file is required" }, 400);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: `File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit` }, 400);
  }

  const mimeType = file.type || "application/octet-stream";
  const buffer = new Uint8Array(await file.arrayBuffer());

  try {
    const uploaded = await uploadToR2(config, {
      buffer,
      filename: file.name || "file",
      mimeType,
    });
    const url = buildUploadUrl(uploaded.key);
    return c.json({
      url,
      key: uploaded.key,
      filename: uploaded.filename,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
      isImage: uploaded.isImage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message.includes("not allowed") ? 415 : 400;
    return c.json({ error: message }, status);
  }
});

api.get("/uploads/*", async (c) => {
  const config = await loadConfig();
  if (!isR2Configured(config)) {
    return c.json({ error: "R2 is not configured" }, 503);
  }

  const uploadPathPrefix = "/api/uploads/";
  const rawKey = c.req.path.startsWith(uploadPathPrefix)
    ? c.req.path.slice(uploadPathPrefix.length)
    : "";
  if (!rawKey) {
    return c.json({ error: "Not found" }, 404);
  }

  const key = decodeURIComponent(rawKey);
  try {
    const object = await getFromR2(config, key);
    if (!object) {
      return c.json({ error: "Not found" }, 404);
    }
    return new Response(object.body, {
      headers: {
        "Content-Type": object.mimeType,
        "Content-Length": String(object.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load file";
    return c.json({ error: message }, 500);
  }
});

app.route("/api", api);

function getWebDistDir(): string {
  if (process.env.JUST_ME_WEB_DIST) {
    return process.env.JUST_ME_WEB_DIST;
  }
  return join(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
}

app.use("/assets/*", serveStatic({ root: getWebDistDir() }));
app.use("/favicon.ico", serveStatic({ root: getWebDistDir() }));
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api")) {
    return c.json({ error: "Not found" }, 404);
  }
  const indexPath = join(getWebDistDir(), "index.html");
  try {
    const html = await readFile(indexPath, "utf8");
    return c.html(html);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load UI";
    console.error(`Just Me UI missing at ${indexPath}: ${message}`);
    return c.text("Just Me UI files are missing from this install.", 500);
  }
});

export { app };

export type ApiServer = {
  port: number;
  owned: boolean;
  close: (callback?: () => void) => void;
};

export function startServer(port = DEFAULT_API_PORT): Promise<ApiServer> {
  return import("@hono/node-server").then(({ createAdaptorServer }) => {
    return new Promise((resolve, reject) => {
      const server = createAdaptorServer(app);

      server.once("error", (error: NodeJS.ErrnoException) => {
        reject(error);
      });

      server.listen(port, "127.0.0.1", () => {
        resolve({
          port,
          owned: true,
          close: (callback) => server.close(callback),
        });
      });
    });
  });
}
