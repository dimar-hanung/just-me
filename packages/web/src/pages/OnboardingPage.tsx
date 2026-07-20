import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { api } from "../api";

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<"local" | "turso">("local");
  const [tursoUrl, setTursoUrl] = useState("");
  const [tursoToken, setTursoToken] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [defaultSqlitePath, setDefaultSqlitePath] = useState(
    "~/.config/just-me/todos.sqlite",
  );
  const [error, setError] = useState("");
  const [driveConnected, setDriveConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    api
      .onboarding()
      .then((state) => {
        if (state.defaultSqlitePath) {
          setDefaultSqlitePath(state.defaultSqlitePath);
        }
        if (state.driveConnected) {
          setDriveConnected(true);
        }
      })
      .catch(() => {
        // keep platform-agnostic fallback placeholder
      });
  }, []);

  useEffect(() => {
    if (searchParams.get("drive") === "connected") {
      setDriveConnected(true);
      setStep(4);
    }
  }, [searchParams]);

  async function saveStorage(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "local") {
        await api.setStorage({ mode: "local", path: localPath || undefined });
      } else {
        await api.setStorage({ mode: "turso", url: tursoUrl, authToken: tursoToken });
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Storage setup failed");
    } finally {
      setLoading(false);
    }
  }

  async function connectDrive() {
    setError("");
    try {
      const { url } = await api.googleAuthUrl();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google OAuth not configured");
    }
  }

  async function finish() {
    setLoading(true);
    setError("");
    try {
      await api.completeOnboarding();
      onComplete();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish onboarding");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="panel p-6">
        <p className="mb-1 text-xs uppercase tracking-wider text-subtle">Setup · Step {step} of 4</p>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Welcome to Just Me</h2>
            <p className="text-sm text-muted">
              Personal todos with dynamic statuses, optional cloud storage, and manual Google Drive backup.
            </p>
            <button onClick={() => setStep(2)} className="btn-primary">
              Get started
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={saveStorage} className="space-y-4">
            <h2 className="text-xl font-semibold">Choose storage</h2>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "local"} onChange={() => setMode("local")} />
                Local SQLite (offline-friendly)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "turso"} onChange={() => setMode("turso")} />
                Turso (cloud database)
              </label>
            </div>
            {mode === "local" ? (
              <input
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder={`Optional custom path (default: ${defaultSqlitePath})`}
                className="input-field"
              />
            ) : (
              <div className="space-y-2">
                <input
                  value={tursoUrl}
                  onChange={(e) => setTursoUrl(e.target.value)}
                  placeholder="Turso database URL (libsql://…)"
                  className="input-field"
                  required
                />
                <input
                  value={tursoToken}
                  onChange={(e) => setTursoToken(e.target.value)}
                  placeholder="Turso auth token"
                  className="input-field"
                  required
                />
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Testing…" : "Save & continue"}
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Google Drive backup</h2>
            <p className="text-sm text-muted">
              Optional. Connect Drive to manually back up todos later from Settings.
            </p>
            {driveConnected ? (
              <p className="text-sm text-green-600 dark:text-green-400">Drive connected.</p>
            ) : (
              <button onClick={connectDrive} className="btn-secondary">
                Connect Google Drive
              </button>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(4)} className="btn-primary">
                {driveConnected ? "Continue" : "Skip for now"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">You&apos;re all set</h2>
            <ul className="space-y-1 text-sm text-muted">
              <li>Storage configured</li>
              <li>Drive: {driveConnected ? "connected" : "skipped"}</li>
            </ul>
            <button onClick={finish} disabled={loading} className="btn-primary">
              {loading ? "Finishing…" : "Open Just Me"}
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-500 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
