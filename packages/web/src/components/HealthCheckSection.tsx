import {
  Activity,
  CheckCircle2,
  Cloud,
  Database,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, type HealthResponse } from "../api";

function StatusRow({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  ok: boolean | null;
}) {
  return (
    <li className="panel flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="inline-flex items-center gap-2 text-muted">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        {label}
      </span>
      <span
        className={`inline-flex items-center gap-1.5 font-medium ${
          ok === null
            ? "text-muted"
            : ok
              ? "text-green-600 dark:text-green-400"
              : "text-red-500 dark:text-red-400"
        }`}
      >
        {ok === true && <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
        {ok === false && <XCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
        {value}
      </span>
    </li>
  );
}

function storageLabel(storage: HealthResponse["storage"]): string {
  if (storage === "local") return "Local SQLite";
  if (storage === "turso") return "Turso";
  return "Not configured";
}

export default function HealthCheckSection() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      setHealth(await api.health());
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : "Failed to check health");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const showUnreachable = !loading && health === null && error !== "";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Health check</h2>
          <p className="text-sm text-muted">Verify API and storage connectivity.</p>
        </div>
        <button
          type="button"
          onClick={() => loadHealth(true)}
          disabled={loading || refreshing}
          className="btn-secondary inline-flex items-center gap-1.5"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            strokeWidth={2}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {loading && (
        <p className="text-sm text-muted">Checking system health…</p>
      )}

      {showUnreachable && (
        <div className="panel space-y-2 px-3 py-3 text-sm">
          <p className="inline-flex items-center gap-2 font-medium text-red-500 dark:text-red-400">
            <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            API unreachable
          </p>
          <p className="text-muted">{error}</p>
        </div>
      )}

      {health && (
        <>
          <div
            className={`panel px-3 py-3 text-sm ${
              health.ok
                ? "text-green-600 dark:text-green-400"
                : "text-red-500 dark:text-red-400"
            }`}
          >
            <p className="inline-flex items-center gap-2 font-medium">
              {health.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              )}
              {health.ok ? "All systems operational" : "Issues detected"}
            </p>
            {health.error && (
              <p className="mt-1 text-muted">{health.error}</p>
            )}
          </div>

          <ul className="space-y-2">
            <StatusRow
              icon={Server}
              label="API"
              value="Reachable"
              ok={true}
            />
            <StatusRow
              icon={Database}
              label="Storage"
              value={
                health.storage
                  ? `${storageLabel(health.storage)} — ${health.ok ? "Connected" : "Failed"}`
                  : "Not configured"
              }
              ok={health.storage ? health.ok : false}
            />
            <StatusRow
              icon={Activity}
              label="Onboarding"
              value={health.onboardingComplete ? "Complete" : "Incomplete"}
              ok={health.onboardingComplete}
            />
            {health.storage && (
              <StatusRow
                icon={Cloud}
                label="Google Drive"
                value={health.driveConnected ? "Connected" : "Not connected"}
                ok={health.driveConnected ? true : null}
              />
            )}
          </ul>
        </>
      )}
    </section>
  );
}
