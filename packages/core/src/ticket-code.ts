import type { Client } from "@libsql/client";
import { DEFAULT_TICKET_PREFIX } from "./types.js";

const CODE_PATTERN = /^([A-Z0-9]+)-(\d+)$/;
const LEGACY_TICKET_PREFIX = "JM";

export function formatTicketCode(prefix: string, number: number): string {
  return `${prefix}-${number}`;
}

export function parseTicketCode(code: string): { prefix: string; number: number } | null {
  const match = CODE_PATTERN.exec(code.trim().toUpperCase());
  if (!match) return null;
  return { prefix: match[1], number: Number(match[2]) };
}

export async function getNextTicketNumber(
  client: Client,
  prefix = DEFAULT_TICKET_PREFIX,
): Promise<number> {
  const result = await client.execute({
    sql: "SELECT code FROM todos WHERE code IS NOT NULL",
    args: [],
  });

  let max = 0;
  for (const row of result.rows) {
    const parsed = parseTicketCode(String(row.code));
    if (!parsed) continue;
    if (parsed.prefix === prefix || parsed.prefix === LEGACY_TICKET_PREFIX) {
      max = Math.max(max, parsed.number);
    }
  }
  return max + 1;
}

export async function migrateLegacyTicketCodes(
  client: Client,
  prefix = DEFAULT_TICKET_PREFIX,
): Promise<void> {
  const legacy = await client.execute({
    sql: "SELECT id, code FROM todos WHERE UPPER(code) LIKE ?",
    args: [`${LEGACY_TICKET_PREFIX}-%`],
  });

  for (const row of legacy.rows) {
    const parsed = parseTicketCode(String(row.code));
    if (!parsed || parsed.prefix !== LEGACY_TICKET_PREFIX) continue;
    await client.execute({
      sql: "UPDATE todos SET code = ? WHERE id = ?",
      args: [formatTicketCode(prefix, parsed.number), String(row.id)],
    });
  }
}

export async function generateNextTicketCode(
  client: Client,
  prefix = DEFAULT_TICKET_PREFIX,
): Promise<string> {
  const next = await getNextTicketNumber(client, prefix);
  return formatTicketCode(prefix, next);
}

export async function backfillMissingTicketCodes(
  client: Client,
  prefix = DEFAULT_TICKET_PREFIX,
): Promise<void> {
  const missing = await client.execute({
    sql: "SELECT id FROM todos WHERE code IS NULL OR code = '' ORDER BY created_at ASC",
    args: [],
  });
  if (missing.rows.length === 0) return;

  let next = await getNextTicketNumber(client, prefix);
  for (const row of missing.rows) {
    const code = formatTicketCode(prefix, next);
    await client.execute({
      sql: "UPDATE todos SET code = ? WHERE id = ?",
      args: [code, String(row.id)],
    });
    next += 1;
  }
}
