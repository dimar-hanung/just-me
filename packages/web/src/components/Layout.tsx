import { Check, LayoutList, Settings, Trash2 } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

export default function Layout() {
  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b border-default pb-4">
        <div className="flex items-center gap-2.5">
          <span className="logo-mark" aria-hidden="true">
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Just Me</h1>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex gap-4 text-sm">
            <NavLink
              to="/"
              className={({ isActive }) => `nav-link inline-flex items-center gap-1.5 ${isActive ? "nav-link--active" : ""}`}
              end
            >
              <LayoutList className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Todos
            </NavLink>
            <NavLink
              to="/trash"
              className={({ isActive }) => `nav-link inline-flex items-center gap-1.5 ${isActive ? "nav-link--active" : ""}`}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Trash
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `nav-link inline-flex items-center gap-1.5 ${isActive ? "nav-link--active" : ""}`}
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Settings
            </NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
