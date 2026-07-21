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
  type DbContext,
} from "@just-me/core";
import { requireOnboarding, withDb } from "./middleware.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";

type Variables = { db: DbContext };

const app = new Hono<{ Variables: Variables }>();

const GOOGLE_REDIRECT_URI = "http://127.0.0.1:7841/api/onboarding/google/callback";

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
    return c.json({
      app: "just-me",
      ok: true,
      onboardingComplete: config.onboardingComplete,
      storage: config.storage.mode,
      driveConnected: isDriveConnected(config),
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
    const url = getGoogleAuthUrl(config, GOOGLE_REDIRECT_URI);
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
    const updated = await exchangeGoogleCode(config, code, GOOGLE_REDIRECT_URI);
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
    const updated = await exchangeGoogleCode(config, body.code, GOOGLE_REDIRECT_URI);
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
  return c.json({
    onboardingComplete: config.onboardingComplete,
    storage: config.storage ?? null,
    driveConnected: isDriveConnected(config),
    googleConfigured: Boolean(config.google?.clientId || process.env.GOOGLE_CLIENT_ID),
  });
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

api.get("/todos", withDb, async (c) => {
  const { client } = c.get("db");
  const statusId = c.req.query("status_id") ?? undefined;
  const code = c.req.query("code") ?? undefined;
  return c.json(await listTodos(client, { statusId, code }));
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

export const DEFAULT_API_PORT = 7841;

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
