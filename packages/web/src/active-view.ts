const STORAGE_KEY = "just-me-active-view-id";

export function loadActiveViewId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveViewId(id: string) {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearActiveViewId() {
  localStorage.removeItem(STORAGE_KEY);
}
