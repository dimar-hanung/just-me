import {
  CloudUpload,
  HardDrive,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, type DriveBackup, type Field, type FieldType, type Status } from "../api";
import { fieldTypeLabel } from "../components/FieldValueEditors";
import { getStatusHueClass } from "../status-hue";

const FIELD_TYPES: FieldType[] = ["tag_multi", "tag_single", "text"];

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [backups, setBackups] = useState<DriveBackup[]>([]);
  const [newStatusName, setNewStatusName] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [mode, setMode] = useState<"local" | "turso">("local");
  const [tursoUrl, setTursoUrl] = useState("");
  const [tursoToken, setTursoToken] = useState("");
  const [driveConnected, setDriveConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [statusList, fieldList, settings] = await Promise.all([
        api.listStatuses(),
        api.listFields(),
        api.settings(),
      ]);
      setStatuses(statusList);
      setFields(fieldList);
      setDriveConnected(settings.driveConnected);
      if (settings.storage && typeof settings.storage === "object") {
        const storage = settings.storage as { mode?: string; url?: string };
        if (storage.mode === "turso") {
          setMode("turso");
          setTursoUrl(storage.url ?? "");
        } else {
          setMode("local");
        }
      }
      if (settings.driveConnected) {
        setBackups(await api.listBackups());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddStatus(e: FormEvent) {
    e.preventDefault();
    if (!newStatusName.trim()) return;
    try {
      await api.createStatus(newStatusName.trim());
      setNewStatusName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create status");
    }
  }

  async function handleRename(status: Status) {
    const name = window.prompt("Rename status", status.name);
    if (!name) return;
    try {
      await api.updateStatus(status.id, { name });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename status");
    }
  }

  async function handleDeleteStatus(id: string) {
    try {
      await api.deleteStatus(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete status");
    }
  }

  async function handleAddField(e: FormEvent) {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    try {
      await api.createField(newFieldName.trim(), newFieldType);
      setNewFieldName("");
      setNewFieldType("text");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create field");
    }
  }

  async function handleRenameField(field: Field) {
    const name = window.prompt("Rename field", field.name);
    if (!name) return;
    try {
      await api.updateField(field.id, { name });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename field");
    }
  }

  async function handleDeleteField(field: Field) {
    if (!window.confirm(`Delete field "${field.name}"? Values on todos will be removed.`)) return;
    try {
      await api.deleteField(field.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete field");
    }
  }

  async function handleAddOption(field: Field) {
    const label = window.prompt(`Add option for ${field.name}`);
    if (!label?.trim()) return;
    try {
      await api.createFieldOption(field.id, label.trim());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add option");
    }
  }

  async function handleRenameOption(field: Field, optionId: string, currentLabel: string) {
    const label = window.prompt("Rename option", currentLabel);
    if (!label?.trim()) return;
    try {
      await api.updateFieldOption(field.id, optionId, { label: label.trim() });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename option");
    }
  }

  async function handleDeleteOption(field: Field, optionId: string, label: string) {
    if (!window.confirm(`Delete option "${label}"?`)) return;
    try {
      await api.deleteFieldOption(field.id, optionId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete option");
    }
  }

  async function handleStorageSave(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const result =
        mode === "local"
          ? await api.updateStorage({ mode: "local" })
          : await api.updateStorage({ mode: "turso", url: tursoUrl, authToken: tursoToken });
      setMessage(result.warning ?? "Storage updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update storage");
    }
  }

  async function connectDrive() {
    try {
      const { url } = await api.googleAuthUrl();
      window.open(url, "_blank", "noopener,noreferrer");
      setMessage("Complete OAuth in the browser, then refresh this page.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google OAuth not configured");
    }
  }

  async function handleBackup() {
    setMessage("");
    setError("");
    try {
      const result = await api.backup();
      setMessage(`Backed up as ${result.fileName}`);
      setBackups(await api.listBackups());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed");
    }
  }

  async function handleRestore(fileId: string) {
    if (!window.confirm("Restore this backup? Current todos will be replaced.")) return;
    try {
      await api.restore(fileId);
      setMessage("Restore complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Statuses</h2>
        <form onSubmit={handleAddStatus} className="flex gap-2">
          <input
            value={newStatusName}
            onChange={(e) => setNewStatusName(e.target.value)}
            placeholder="New status name"
            className="input-field flex-1"
          />
          <button type="submit" className="btn-secondary inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Add
          </button>
        </form>
        <ul className="space-y-2">
          {statuses.map((status, index) => (
            <li
              key={status.id}
              className="panel flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className={`flex items-center gap-2 ${getStatusHueClass(status.name, index)}`}>
                <span className="hue-dot" aria-hidden="true" />
                {status.name}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRename(status)}
                  className="inline-flex items-center gap-1 text-muted hover:text-[rgb(var(--fg))]"
                  title="Rename"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  Rename
                </button>
                <button
                  onClick={() => handleDeleteStatus(status.id)}
                  className="inline-flex items-center gap-1 text-muted hover:text-red-500 dark:hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Fields</h2>
        <p className="text-sm text-muted">
          Custom fields for todos. Tag fields use predefined options you manage here.
        </p>
        <form onSubmit={handleAddField} className="flex flex-wrap gap-2">
          <input
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="New field name"
            className="input-field flex-1 min-w-[10rem]"
          />
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as FieldType)}
            className="input-field"
            aria-label="Field type"
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {fieldTypeLabel(type)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Add
          </button>
        </form>
        <ul className="space-y-2">
          {fields.map((field) => (
            <li key={field.id} className="panel px-3 py-2 text-sm space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{field.name}</span>
                  <span className="field-type-badge">{fieldTypeLabel(field.type)}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleRenameField(field)}
                    className="inline-flex items-center gap-1 text-muted hover:text-[rgb(var(--fg))]"
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeleteField(field)}
                    className="inline-flex items-center gap-1 text-muted hover:text-red-500 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
              {field.type !== "text" && (
                <div className="space-y-2 border-t border-[rgb(var(--border))] pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">Options</span>
                    <button
                      type="button"
                      onClick={() => handleAddOption(field)}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-[rgb(var(--fg))]"
                    >
                      <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                      Add option
                    </button>
                  </div>
                  {field.options.length === 0 ? (
                    <p className="text-xs text-subtle">No options yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {field.options.map((option) => (
                        <li
                          key={option.id}
                          className="flex items-center justify-between gap-2 rounded-md px-2 py-1 bg-[rgb(var(--surface-2))]"
                        >
                          <span>{option.label}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleRenameOption(field, option.id, option.label)}
                              className="text-muted hover:text-[rgb(var(--fg))]"
                              title="Rename option"
                            >
                              <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOption(field, option.id, option.label)}
                              className="text-muted hover:text-red-500 dark:hover:text-red-400"
                              title="Delete option"
                            >
                              <Trash2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Storage</h2>
        <form onSubmit={handleStorageSave} className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "local"} onChange={() => setMode("local")} />
            Local SQLite
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "turso"} onChange={() => setMode("turso")} />
            Turso
          </label>
          {mode === "turso" && (
            <div className="space-y-2">
              <input
                value={tursoUrl}
                onChange={(e) => setTursoUrl(e.target.value)}
                placeholder="Turso URL"
                className="input-field"
              />
              <input
                value={tursoToken}
                onChange={(e) => setTursoToken(e.target.value)}
                placeholder="Turso auth token"
                className="input-field"
              />
            </div>
          )}
          <button type="submit" className="btn-secondary inline-flex items-center gap-1.5">
            <HardDrive className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Save storage
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Google Drive backup</h2>
        <p className="text-sm text-muted">
          Manual backup only — click Backup now when you want a snapshot in Drive.
        </p>
        {!driveConnected ? (
          <button onClick={connectDrive} className="btn-secondary inline-flex items-center gap-1.5">
            <CloudUpload className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Connect Google Drive
          </button>
        ) : (
          <div className="space-y-3">
            <button onClick={handleBackup} className="btn-primary inline-flex items-center gap-1.5">
              <CloudUpload className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Backup now
            </button>
            {backups.length > 0 && (
              <ul className="space-y-2 text-sm">
                {backups.map((backup) => (
                  <li
                    key={backup.id}
                    className="panel flex items-center justify-between px-3 py-2"
                  >
                    <span>{backup.name}</span>
                    <button
                      onClick={() => handleRestore(backup.id)}
                      className="inline-flex items-center gap-1 text-muted hover:text-[rgb(var(--fg))]"
                      title="Restore"
                    >
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
