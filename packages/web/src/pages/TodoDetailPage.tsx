import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, type Field, type Todo, type TodoFieldValues } from "../api";
import { FieldValuesSection } from "../components/FieldValueEditors";
import MarkdownContent from "../components/MarkdownContent";

type Tab = "write" | "preview";
type SaveStatus = "idle" | "saving" | "saved" | "error";

type TodoDetailLocationState = {
  defaultTab?: Tab;
};

export default function TodoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as TodoDetailLocationState | null;
  const [todo, setTodo] = useState<Todo | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fieldValues, setFieldValues] = useState<TodoFieldValues>({});
  const [tab, setTab] = useState<Tab>(
    locationState?.defaultTab === "write" ? "write" : "preview",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const savedTitleRef = useRef("");
  const savedContentRef = useRef("");
  const savedFieldValuesRef = useRef<TodoFieldValues>({});
  const draftRef = useRef({ title: "", content: "", fieldValues: {} as TodoFieldValues });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  draftRef.current = { title, content, fieldValues };

  const fieldValuesEqual = useCallback((a: TodoFieldValues, b: TodoFieldValues) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const left = a[key];
      const right = b[key];
      if (Array.isArray(left) || Array.isArray(right)) {
        const leftArr = Array.isArray(left) ? left : [];
        const rightArr = Array.isArray(right) ? right : [];
        if (leftArr.length !== rightArr.length) return false;
        if (leftArr.some((value, index) => value !== rightArr[index])) return false;
        continue;
      }
      if (left !== right) return false;
    }
    return true;
  }, []);

  const saveNow = useCallback(
    async (nextTitle: string, nextContent: string, nextFieldValues?: TodoFieldValues) => {
      if (!id) return;

      const valuesToSave = nextFieldValues ?? fieldValues;
      const contentChanged =
        nextTitle !== savedTitleRef.current || nextContent !== savedContentRef.current;
      const fieldsChanged = !fieldValuesEqual(valuesToSave, savedFieldValuesRef.current);
      if (!contentChanged && !fieldsChanged) return;

      setSaveStatus("saving");
      setError("");
      try {
        const patch: {
          title?: string;
          content?: string;
          fieldValues?: TodoFieldValues;
        } = {};
        if (contentChanged) {
          patch.title = nextTitle;
          patch.content = nextContent;
        }
        if (fieldsChanged) {
          patch.fieldValues = valuesToSave;
        }

        const updated = await api.updateTodo(id, patch);
        savedTitleRef.current = updated.title;
        savedContentRef.current = updated.content;
        savedFieldValuesRef.current = updated.fieldValues ?? {};
        setTodo(updated);
        setFieldValues(updated.fieldValues ?? {});
        setSaveStatus("saved");
        if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
        savedFadeTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        setSaveStatus("error");
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    },
    [id, fieldValues, fieldValuesEqual],
  );

  useEffect(() => {
    if (!id) {
      navigate("/", { replace: true });
      return;
    }

    setLoading(true);
    setError("");
    Promise.all([api.listTodos(), api.listFields()])
      .then(([list, fieldList]) => {
        const found = list.find((t) => t.id === id);
        if (!found) {
          navigate("/", { replace: true });
          return;
        }
        setFields(fieldList);
        setTodo(found);
        setTitle(found.title);
        setContent(found.content ?? "");
        setFieldValues(found.fieldValues ?? {});
        savedTitleRef.current = found.title;
        savedContentRef.current = found.content ?? "";
        savedFieldValuesRef.current = found.fieldValues ?? {};
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load todo");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (loading || !todo) return;
    if (title === savedTitleRef.current && content === savedContentRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveNow(title, content);
    }, 600);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, loading, todo, saveNow]);

  useEffect(() => {
    if (loading || !todo) return;
    if (fieldValuesEqual(fieldValues, savedFieldValuesRef.current)) return;

    if (fieldSaveTimerRef.current) clearTimeout(fieldSaveTimerRef.current);
    fieldSaveTimerRef.current = setTimeout(() => {
      void saveNow(title, content, fieldValues);
    }, 400);

    return () => {
      if (fieldSaveTimerRef.current) clearTimeout(fieldSaveTimerRef.current);
    };
  }, [fieldValues, loading, todo, title, content, saveNow, fieldValuesEqual]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (fieldSaveTimerRef.current) clearTimeout(fieldSaveTimerRef.current);
      if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
      const { title: draftTitle, content: draftContent, fieldValues: draftFieldValues } =
        draftRef.current;
      const contentChanged =
        draftTitle !== savedTitleRef.current || draftContent !== savedContentRef.current;
      const fieldsChanged = !fieldValuesEqual(draftFieldValues, savedFieldValuesRef.current);
      if (id && (contentChanged || fieldsChanged)) {
        const patch: {
          title?: string;
          content?: string;
          fieldValues?: TodoFieldValues;
        } = {};
        if (contentChanged) {
          patch.title = draftTitle;
          patch.content = draftContent;
        }
        if (fieldsChanged) {
          patch.fieldValues = draftFieldValues;
        }
        void api.updateTodo(id, patch);
      }
    };
  }, [id, fieldValuesEqual]);

  function handleFieldChange(fieldId: string, value: string | string[]) {
    setFieldValues((current) => ({ ...current, [fieldId]: value }));
  }

  if (loading) {
    return <p className="text-muted">Loading…</p>;
  }

  if (!todo) {
    return null;
  }

  const footerClass =
    saveStatus === "saving"
      ? "todo-detail-footer todo-detail-footer--saving"
      : saveStatus === "saved"
        ? "todo-detail-footer todo-detail-footer--saved"
        : saveStatus === "error"
          ? "todo-detail-footer todo-detail-footer--error"
          : "todo-detail-footer";

  return (
    <div className="todo-detail">
      <Link to="/" className="todo-detail-back">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Back to board
      </Link>

      <header className="todo-detail-header">
        <div className="todo-detail-meta">
          {todo.code ? <span className="kanban-card-code">{todo.code}</span> : null}
          {todo.statusName ? <span className="todo-detail-status">{todo.statusName}</span> : null}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="todo-detail-title"
          aria-label="Todo title"
        />
        <FieldValuesSection fields={fields} values={fieldValues} onChange={handleFieldChange} />
      </header>

      {error && saveStatus === "error" && (
        <div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="todo-detail-tabs" role="tablist" aria-label="Content view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "write"}
          className={`todo-detail-tab ${tab === "write" ? "todo-detail-tab--active" : ""}`}
          onClick={() => setTab("write")}
        >
          Write
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "preview"}
          className={`todo-detail-tab ${tab === "preview" ? "todo-detail-tab--active" : ""}`}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>

      <div className="todo-detail-body">
        {tab === "write" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write markdown notes…"
            className="todo-detail-textarea"
            aria-label="Markdown content"
          />
        ) : (
          <MarkdownContent source={content} onSourceChange={setContent} />
        )}
      </div>

      <footer className={footerClass}>
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "saved" && "Saved"}
        {saveStatus === "error" && "Couldn't save — check your connection"}
      </footer>
    </div>
  );
}
