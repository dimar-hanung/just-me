/** 1-based inclusive line range edit for todo markdown content. */

export function formatNumberedContent(content: string): string {
  const lines = content.split("\n");
  const width = String(Math.max(lines.length, 1)).length;
  return lines
    .map((line, i) => `${String(i + 1).padStart(width, " ")}|${line}`)
    .join("\n");
}

export type LineEditResult =
  | { ok: true; content: string; lineCount: number }
  | { ok: false; error: string };

/**
 * Replace lines [startLine, endLine] (1-based, inclusive) with newContent.
 * Pass endLine = startLine - 1 to insert before startLine without removing lines.
 * Pass newContent = "" to delete the range.
 */
export function applyLineRangeEdit(
  content: string,
  startLine: number,
  endLine: number,
  newContent: string,
): LineEditResult {
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) {
    return { ok: false, error: "start_line and end_line must be integers" };
  }
  if (startLine < 1) {
    return { ok: false, error: "start_line must be >= 1" };
  }
  if (endLine < startLine - 1) {
    return {
      ok: false,
      error: "end_line must be >= start_line - 1 (use end_line = start_line - 1 to insert)",
    };
  }

  const lines = content.split("\n");
  const isInsert = endLine === startLine - 1;

  if (isInsert) {
    if (startLine > lines.length + 1) {
      return {
        ok: false,
        error: `start_line ${startLine} is past end of content (${lines.length} lines; max insert is ${lines.length + 1})`,
      };
    }
  } else if (endLine > lines.length) {
    return {
      ok: false,
      error: `end_line ${endLine} exceeds content length (${lines.length} lines)`,
    };
  }

  const replacement = newContent.length === 0 ? [] : newContent.split("\n");
  const next = isInsert
    ? [...lines.slice(0, startLine - 1), ...replacement, ...lines.slice(startLine - 1)]
    : [...lines.slice(0, startLine - 1), ...replacement, ...lines.slice(endLine)];

  return { ok: true, content: next.join("\n"), lineCount: next.length };
}
