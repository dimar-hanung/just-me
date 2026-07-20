const TASK_LIST_LINE_RE = /^(\s*)[-*+]\s+\[([ xX])\]/;

/** Line indices (0-based) of GFM task list items, in document order. */
export function getTaskListLineIndices(source: string): number[] {
  const lines = source.split("\n");
  const indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (TASK_LIST_LINE_RE.test(lines[i])) {
      indices.push(i);
    }
  }
  return indices;
}

/** Toggle the nth task list checkbox in markdown source (0-based item index). */
export function toggleTaskListItem(source: string, itemIndex: number): string {
  const lineIndices = getTaskListLineIndices(source);
  if (itemIndex < 0 || itemIndex >= lineIndices.length) {
    return source;
  }

  const lineNum = lineIndices[itemIndex];
  const lines = source.split("\n");
  lines[lineNum] = lines[lineNum].replace(
    /^(\s*[-*+]\s+)\[([ xX])\]/,
    (_match, prefix: string, check: string) => {
      const next = check.toLowerCase() === "x" ? " " : "x";
      return `${prefix}[${next}]`;
    },
  );
  return lines.join("\n");
}
