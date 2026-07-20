const DEFAULT_STATUS_HUES: Record<string, string> = {
  "Not Started": "hue-red",
  "In Progress": "hue-blue",
  Done: "hue-green",
};

const FALLBACK_HUES = [
  "hue-0",
  "hue-1",
  "hue-2",
  "hue-3",
  "hue-4",
  "hue-5",
  "hue-6",
  "hue-7",
] as const;

export function getStatusHueClass(statusName: string, fallbackIndex = 0): string {
  return DEFAULT_STATUS_HUES[statusName] ?? FALLBACK_HUES[fallbackIndex % FALLBACK_HUES.length];
}
