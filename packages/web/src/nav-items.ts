import { LayoutList, Settings, Trash2, type LucideIcon } from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Todos",
    icon: LayoutList,
    isActive: (pathname) => pathname === "/" || pathname.startsWith("/todos/"),
  },
  {
    to: "/trash",
    label: "Trash",
    icon: Trash2,
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
  },
];
