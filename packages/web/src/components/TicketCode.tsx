import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type TicketCodeProps = {
  code: string;
  className?: string;
  /** Plain code + copy icon revealed by parent row hover styles. */
  variant?: "badge" | "row";
};

export default function TicketCode({
  code,
  className = "kanban-card-code",
  variant = "badge",
}: TicketCodeProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function handleCopy(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; leave label unchanged.
    }
  }

  if (variant === "row") {
    return (
      <span className="todo-table-code-wrap">
        <span className="todo-table-code-text">{code}</span>
        <button
          type="button"
          className="todo-table-code-copy"
          onClick={handleCopy}
          title={copied ? "Copied" : "Copy ticket code"}
          aria-label={copied ? `Copied ${code}` : `Copy ticket code ${code}`}
        >
          {copied ? (
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${className} ticket-code-btn`}
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy ticket code"}
      aria-label={copied ? `Copied ${code}` : `Copy ticket code ${code}`}
    >
      {copied ? "Copied" : code}
    </button>
  );
}
