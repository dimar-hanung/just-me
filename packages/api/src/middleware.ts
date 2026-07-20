import type { Context, Next } from "hono";
import { loadConfig } from "@just-me/core";

export async function requireOnboarding(c: Context, next: Next) {
  const config = await loadConfig();
  if (!config.onboardingComplete) {
    return c.json({ needsOnboarding: true, error: "Onboarding is not complete" }, 412);
  }
  await next();
}

export async function withDb(c: Context, next: Next) {
  const config = await loadConfig();
  if (!config.storage) {
    return c.json({ error: "Storage is not configured" }, 503);
  }
  try {
    const { createDb } = await import("@just-me/core");
    const db = await createDb(config);
    c.set("db", db);
    await next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    return c.json({ error: message }, 503);
  }
}
