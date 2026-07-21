import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Status } from "../api";
import { getStatusHueClass } from "../status-hue";

type StatusDropdownProps = {
  statuses: Status[];
  value: string;
  label: string;
  ariaLabel: string;
  onChange: (statusId: string) => void;
};

function stopRowClick(e: MouseEvent) {
  e.stopPropagation();
}

export default function StatusDropdown({
  statuses,
  value,
  label,
  ariaLabel,
  onChange,
}: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedIndex = statuses.findIndex((status) => status.id === value);
  const selected = selectedIndex >= 0 ? statuses[selectedIndex] : undefined;
  const selectedHue = getStatusHueClass(selected?.name ?? label, Math.max(selectedIndex, 0));

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: Event) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(undefined);
      return;
    }

    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);

    function updatePosition() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const gap = 4;
      const menuHeight = menu?.offsetHeight ?? 160;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;
      const width = Math.max(rect.width, 11 * 16);

      setMenuStyle({
        position: "fixed",
        left: Math.min(rect.left, window.innerWidth - width - 8),
        width,
        top: openUp ? undefined : rect.bottom + gap,
        bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
        right: "auto",
        zIndex: 60,
      });
    }

    updatePosition();
    menuRef.current?.focus({ preventScroll: true });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, selectedIndex, statuses.length]);

  function selectStatus(statusId: string) {
    onChange(statusId);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % statuses.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? statuses.length - 1 : index - 1));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(statuses.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const status = statuses[activeIndex];
      if (status) selectStatus(status.id);
    }
  }

  const menu = open ? (
    <div
      ref={menuRef}
      id={listboxId}
      className="status-dropdown-menu"
      style={menuStyle}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={-1}
      onClick={stopRowClick}
      onMouseDown={stopRowClick}
      onKeyDown={handleMenuKeyDown}
    >
      {statuses.map((status, index) => {
        const hueClass = getStatusHueClass(status.name, index);
        const selectedOption = status.id === value;
        const active = index === activeIndex;

        return (
          <button
            key={status.id}
            type="button"
            role="option"
            aria-selected={selectedOption}
            className={`status-dropdown-option ${hueClass}${active ? " is-active" : ""}${
              selectedOption ? " is-selected" : ""
            }`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectStatus(status.id)}
          >
            <span className="hue-dot" aria-hidden="true" />
            <span className="status-dropdown-option-label">{status.name}</span>
            {selectedOption ? (
              <Check className="status-dropdown-check" strokeWidth={2.25} aria-hidden="true" />
            ) : (
              <span className="status-dropdown-check-spacer" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`todo-table-status status-dropdown ${selectedHue}`}
      onClick={stopRowClick}
      onMouseDown={stopRowClick}
    >
      <button
        ref={triggerRef}
        type="button"
        className="status-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="hue-dot" aria-hidden="true" />
        <span className="status-dropdown-label">{selected?.name ?? label}</span>
        <ChevronDown
          className={`status-dropdown-chevron${open ? " is-open" : ""}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
