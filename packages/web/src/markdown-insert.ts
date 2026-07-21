export function buildUploadMarkdown(input: {
  url: string;
  filename: string;
  isImage: boolean;
}): string {
  const label = input.filename.replace(/\]/g, "\\]");
  if (input.isImage) {
    return `![${label}](${input.url})`;
  }
  return `[${label}](${input.url})`;
}

export function insertAtCursor(
  textarea: HTMLTextAreaElement,
  snippet: string,
  currentValue: string,
): { nextValue: string; nextCursor: number } {
  const start = textarea.selectionStart ?? currentValue.length;
  const end = textarea.selectionEnd ?? start;

  const before = currentValue.slice(0, start);
  const after = currentValue.slice(end);

  const needsLeadingBreak = before.length > 0 && !before.endsWith("\n");
  const needsTrailingBreak = after.length > 0 && !after.startsWith("\n");

  let insert = snippet;
  if (needsLeadingBreak) insert = `\n\n${insert}`;
  if (needsTrailingBreak) insert = `${insert}\n\n`;

  const nextValue = `${before}${insert}${after}`;
  const nextCursor = before.length + insert.length;

  return { nextValue, nextCursor };
}

export function focusTextareaAt(
  textarea: HTMLTextAreaElement,
  cursor: number,
  options?: { preventScroll?: boolean },
): void {
  textarea.focus({ preventScroll: options?.preventScroll ?? false });
  textarea.setSelectionRange(cursor, cursor);
}

/** 1-based line, 0-based column within that line. */
export type TextCursorPosition = {
  line: number;
  column: number;
};

export function offsetToCursorPosition(value: string, offset: number): TextCursorPosition {
  const clamped = Math.max(0, Math.min(offset, value.length));
  const before = value.slice(0, clamped);
  const lastBreak = before.lastIndexOf("\n");
  return {
    line: before.split("\n").length,
    column: lastBreak === -1 ? clamped : clamped - lastBreak - 1,
  };
}

export function cursorPositionToOffset(value: string, position: TextCursorPosition): number {
  const lines = value.split("\n");
  if (lines.length === 0) return 0;

  const lineIndex = Math.max(0, Math.min(position.line - 1, lines.length - 1));
  let offset = 0;
  for (let i = 0; i < lineIndex; i++) {
    offset += lines[i].length + 1;
  }

  const column = Math.max(0, Math.min(position.column, lines[lineIndex].length));
  return offset + column;
}
