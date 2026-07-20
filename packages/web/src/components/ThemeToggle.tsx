import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { getStoredTheme, setStoredTheme, type Theme } from "../theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    setStoredTheme(theme);
  }, [theme]);

  function toggle() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className={`theme-toggle-thumb ${isDark ? "theme-toggle-thumb--dark" : ""}`}>
          {isDark ? (
            <Sun className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Moon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          )}
        </span>
      </span>
    </button>
  );
}
