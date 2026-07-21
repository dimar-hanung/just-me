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

export function focusTextareaAt(textarea: HTMLTextAreaElement, cursor: number): void {
  textarea.focus();
  textarea.setSelectionRange(cursor, cursor);
}
