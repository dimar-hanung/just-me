const STORAGE_KEY = "just-me-sidebar-expanded";

export function loadSidebarExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveSidebarExpanded(expanded: boolean) {
  localStorage.setItem(STORAGE_KEY, expanded ? "true" : "false");
}
