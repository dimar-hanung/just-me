import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type McpSetupResponse } from "../api";

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable.
    }
  }

  return (
    <button
      type="button"
      className="docs-code-copy btn-secondary inline-flex items-center gap-1.5"
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy"}
      aria-label={copied ? "Copied to clipboard" : "Copy code to clipboard"}
    >
      {copied ? (
        <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function statusMessage(setup: McpSetupResponse): string {
  if (setup.status === "ready") {
    return "Copy this block into ~/.cursor/mcp.json (or your project .cursor/mcp.json). Reload Cursor after saving.";
  }
  if (setup.status === "needs_onboarding") {
    return "Complete onboarding in Just Me first. MCP needs storage and config before Cursor can connect.";
  }
  return "MCP is not bundled in this environment. Use the development examples below, or install the desktop app.";
}

export default function DocsMcpSetupSection() {
  const [setup, setSetup] = useState<McpSetupResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.mcpSetup();
        if (!cancelled) setSetup(data);
      } catch (err) {
        if (!cancelled) {
          setSetup(null);
          setError(err instanceof Error ? err.message : "Failed to load MCP setup");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const liveCode =
    setup?.status === "ready" && setup.cursorConfig
      ? JSON.stringify(setup.cursorConfig, null, 2)
      : null;

  return (
    <section id="copy-cursor-mcp-config" className="space-y-3">
      <h2 className="text-lg font-medium">Copy Cursor MCP config</h2>
      <p className="text-sm leading-relaxed text-muted">
        Uses paths from this machine. You still need Node.js 20+ on PATH for Cursor to start the server.
      </p>

      {loading && <p className="text-sm text-muted">Loading MCP setup…</p>}

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {setup && (
        <>
          <p className="text-sm leading-relaxed text-muted">{statusMessage(setup)}</p>
          {liveCode ? (
            <div className="docs-code-block panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border))] px-3 py-2">
                <span className="text-xs font-medium text-muted">
                  Ready — paste into .cursor/mcp.json
                </span>
                <CopyCodeButton code={liveCode} />
              </div>
              <pre className="docs-code-pre overflow-x-auto p-3 text-xs leading-relaxed">
                <code>{liveCode}</code>
              </pre>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
