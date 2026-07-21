import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, type Field, type Todo, type TodoFieldValues } from "../api";
import { FieldValuesSection } from "../components/FieldValueEditors";
import MarkdownContent from "../components/MarkdownContent";
import MarkdownTextarea, {
  type MarkdownTextareaHandle,
} from "../components/MarkdownTextarea";
import TicketCode from "../components/TicketCode";
import type { TextCursorPosition } from "../markdown-insert";

type Tab = "write" | "preview";
type SaveStatus = "idle" | "saving" | "saved" | "error";

type TodoDetailLocationState = {
  defaultTab?: Tab;
};

function isModKey(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function getPageScrollContainer(start: HTMLElement | null): HTMLElement | null {
  return start?.closest("main") ?? null;
}

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
  const [uploadEnabled, setUploadEnabled] = useState(false);

  const savedTitleRef = useRef("");
  const savedContentRef = useRef("");
  const savedFieldValuesRef = useRef<TodoFieldValues>({});
  const draftRef = useRef({ title: "", content: "", fieldValues: {} as TodoFieldValues });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<MarkdownTextareaHandle>(null);
  const cursorPosRef = useRef<TextCursorPosition>({ line: 1, column: 0 });
  const scrollTopRef = useRef(0);
  const restoreFocusRef = useRef(false);
  const restoreScrollRef = useRef(false);
  const tabRef = useRef(tab);

  draftRef.current = { title, content, fieldValues };
  tabRef.current = tab;

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
    Promise.all([api.getTodo(id), api.listFields(), api.settings()])
      .then(([found, fieldList, settings]) => {
        if (!found) {
          navigate("/", { replace: true });
          return;
        }
        setFields(fieldList);
        setUploadEnabled(settings.r2Configured);
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

  const captureCursor = useCallback(() => {
    if (tabRef.current !== "write" || !textareaRef.current) return;
    cursorPosRef.current = textareaRef.current.getCursorPosition();
  }, []);

  const captureScroll = useCallback(() => {
    const container = getPageScrollContainer(detailRef.current);
    if (!container) return;
    scrollTopRef.current = container.scrollTop;
  }, []);

  const switchTab = useCallback(
    (next: Tab) => {
      if (next === tabRef.current) return;
      captureScroll();
      if (tabRef.current === "write") {
        captureCursor();
      }
      restoreScrollRef.current = true;
      if (next === "write") {
        restoreFocusRef.current = true;
      }
      setTab(next);
    },
    [captureCursor, captureScroll],
  );

  const toggleTab = useCallback(() => {
    switchTab(tabRef.current === "write" ? "preview" : "write");
  }, [switchTab]);

  useLayoutEffect(() => {
    const shouldRestoreFocus = restoreFocusRef.current;
    const shouldRestoreScroll = restoreScrollRef.current;
    if (!shouldRestoreFocus && !shouldRestoreScroll) return;

    restoreFocusRef.current = false;
    restoreScrollRef.current = false;

    const position = cursorPosRef.current;
    const scrollTop = scrollTopRef.current;
    const container = getPageScrollContainer(detailRef.current);

    const applyScroll = () => {
      if (!shouldRestoreScroll || !container) return;
      container.scrollTop = scrollTop;
    };

    if (tab === "write") {
      // Panels stay mounted; sync height if content changed while Write was hidden.
      textareaRef.current?.syncHeight();
      applyScroll();

      if (shouldRestoreFocus) {
        // Do not setSelectionRange here — browsers scroll the caret into view and
        // jump to the top when the saved line is 1 (default Preview entry).
        // Selection is preserved while the Write panel stays mounted; only re-apply
        // a captured position when the browser cleared it (selection at 0).
        const current = textareaRef.current?.getCursorPosition();
        const selectionLost =
          !current || (current.line === 1 && current.column === 0 && position.line > 1);
        if (selectionLost) {
          textareaRef.current?.focusAtPosition(position, { preventScroll: true });
        } else {
          textareaRef.current?.focus({ preventScroll: true });
        }
        applyScroll();
      }
    } else {
      applyScroll();
    }

    // Defeat late caret scroll-into-view from focus/setSelectionRange.
    const onScroll = () => {
      applyScroll();
    };
    if (shouldRestoreScroll && container) {
      container.addEventListener("scroll", onScroll);
    }

    let frame2 = 0;
    const unlockTimer = window.setTimeout(() => {
      container?.removeEventListener("scroll", onScroll);
    }, 100);
    const frame1 = requestAnimationFrame(() => {
      applyScroll();
      frame2 = requestAnimationFrame(applyScroll);
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      window.clearTimeout(unlockTimer);
      container?.removeEventListener("scroll", onScroll);
    };
  }, [tab]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing || event.altKey || event.shiftKey) return;
      if (!isModKey(event) || event.key.toLowerCase() !== "e") return;
      event.preventDefault();
      toggleTab();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleTab]);

  function handleFieldChange(fieldId: string, value: string | string[]) {
    setFieldValues((current) => ({ ...current, [fieldId]: value }));
  }

  const shortcutHint = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘E"
    : "Ctrl+E";

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
    <div ref={detailRef} className="todo-detail">
      <Link to="/" className="todo-detail-back">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Back to board
      </Link>

      <header className="todo-detail-header">
        <div className="todo-detail-meta">
          {todo.code ? <TicketCode code={todo.code} /> : null}
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

      <div className="todo-detail-tabs-row">
        <div className="todo-detail-tabs" role="tablist" aria-label="Content view">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            className={`todo-detail-tab ${tab === "write" ? "todo-detail-tab--active" : ""}`}
            title={`Write (${shortcutHint})`}
            onClick={() => switchTab("write")}
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={`todo-detail-tab ${tab === "preview" ? "todo-detail-tab--active" : ""}`}
            title={`Preview (${shortcutHint})`}
            onClick={() => switchTab("preview")}
          >
            Preview
          </button>
        </div>
        <p className="todo-detail-tab-tip">
          Tip: <kbd>{shortcutHint}</kbd> toggles Write / Preview
        </p>
      </div>

      <div className="todo-detail-body">
        <div className="todo-detail-panel" hidden={tab !== "write"}>
          <MarkdownTextarea
            ref={textareaRef}
            value={content}
            onChange={setContent}
            uploadEnabled={uploadEnabled}
            active={tab === "write"}
            placeholder="Write markdown notes… Paste or drop files to attach."
            className="todo-detail-textarea"
            aria-label="Markdown content"
          />
        </div>
        <div className="todo-detail-panel" hidden={tab !== "preview"}>
          <MarkdownContent source={content} onSourceChange={setContent} />
        </div>
      </div>

      <footer className={footerClass}>
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "saved" && "Saved"}
        {saveStatus === "error" && "Couldn't save — check your connection"}
      </footer>
    </div>
  );
}
