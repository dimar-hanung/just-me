import { Check, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NAV_ITEMS, type NavItem } from "../nav-items";
import { loadSidebarExpanded, saveSidebarExpanded } from "../sidebar";
import ThemeToggle from "./ThemeToggle";

function isNavItemActive(item: NavItem, pathname: string, linkActive: boolean): boolean {
  if (item.isActive) return item.isActive(pathname);
  return linkActive;
}

export default function Sidebar() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(() => loadSidebarExpanded());

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      saveSidebarExpanded(next);
      return next;
    });
  }

  return (
    <aside
      className={`sidebar ${expanded ? "sidebar--expanded" : "sidebar--collapsed"}`}
      aria-label="Application sidebar"
    >
      <div className="sidebar-header">
        <span className="logo-mark shrink-0" aria-hidden="true">
          <Check className="h-4 w-4" strokeWidth={2.5} />
        </span>
        {expanded ? (
          <h1 className="sidebar-title">Just Me</h1>
        ) : (
          <span className="sr-only">Just Me</span>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const { to, label, icon: Icon, end } = item;
          return (
            <NavLink
              key={to}
              to={to}
              end={end ?? to !== "/"}
              title={expanded ? undefined : label}
              className={({ isActive: linkActive }) => {
                const active = isNavItemActive(item, location.pathname, linkActive);
                return `sidebar-nav-item ${active ? "sidebar-nav-item--active" : ""} ${expanded ? "sidebar-nav-item--expanded" : "sidebar-nav-item--collapsed"}`;
              }}
            >
              <Icon className="sidebar-nav-icon" strokeWidth={2} aria-hidden="true" />
              {expanded ? (
                <span className="sidebar-nav-label">{label}</span>
              ) : (
                <span className="sr-only">{label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? (
            <PanelLeftClose className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
        </button>
        <ThemeToggle />
      </div>

      <button
        type="button"
        className="sidebar-edge"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        title={expanded ? "Collapse sidebar" : "Expand sidebar"}
      />
    </aside>
  );
}
