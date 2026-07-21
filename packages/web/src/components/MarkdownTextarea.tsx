import { Loader2 } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { api } from "../api";
import {
  buildUploadMarkdown,
  cursorPositionToOffset,
  focusTextareaAt,
  insertAtCursor,
  offsetToCursorPosition,
  type TextCursorPosition,
} from "../markdown-insert";

type MarkdownTextareaProps = {
  value: string;
  onChange: (next: string) => void;
  uploadEnabled: boolean;
  /** When false, skip auto-resize (panel is hidden / inactive). */
  active?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

export type MarkdownTextareaHandle = {
  getCursorPosition: () => TextCursorPosition;
  focusAtPosition: (
    position: TextCursorPosition,
    options?: { preventScroll?: boolean },
  ) => void;
  focus: (options?: { preventScroll?: boolean }) => void;
  syncHeight: () => void;
};

type UploadState = {
  kind: "uploading" | "error";
  message: string;
};

const MarkdownTextarea = forwardRef<MarkdownTextareaHandle, MarkdownTextareaProps>(
  function MarkdownTextarea(
    {
      value,
      onChange,
      uploadEnabled,
      active = true,
      placeholder,
      className,
      "aria-label": ariaLabel,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const uploadingRef = useRef(false);
    const [uploadState, setUploadState] = useState<UploadState | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const resizeToContent = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Measure with a mirror so we never collapse the live textarea (that resets page scroll).
      const style = window.getComputedStyle(textarea);
      const mirror = document.createElement("textarea");
      mirror.value = textarea.value || textarea.placeholder || "";
      mirror.setAttribute("aria-hidden", "true");
      mirror.tabIndex = -1;
      mirror.style.cssText = [
        "position:absolute",
        "visibility:hidden",
        "height:0",
        "min-height:0",
        "max-height:none",
        "overflow:hidden",
        "top:0",
        "left:0",
        "pointer-events:none",
        `width:${textarea.clientWidth}px`,
        `font:${style.font}`,
        `letter-spacing:${style.letterSpacing}`,
        `line-height:${style.lineHeight}`,
        `padding:${style.padding}`,
        `border:${style.border}`,
        `box-sizing:${style.boxSizing}`,
        `white-space:${style.whiteSpace}`,
        "word-wrap:break-word",
      ].join(";");
      document.body.appendChild(mirror);
      const contentHeight = mirror.scrollHeight;
      document.body.removeChild(mirror);

      const minHeight = Number.parseFloat(style.minHeight) || 0;
      textarea.style.height = `${Math.max(contentHeight, minHeight)}px`;
    }, []);

    useLayoutEffect(() => {
      if (!active) return;
      resizeToContent();
    }, [active, value, resizeToContent]);

    useEffect(() => {
      if (!active) return;
      window.addEventListener("resize", resizeToContent);
      return () => window.removeEventListener("resize", resizeToContent);
    }, [active, resizeToContent]);

    useImperativeHandle(
      ref,
      () => ({
        getCursorPosition: () => {
          const textarea = textareaRef.current;
          if (!textarea) return { line: 1, column: 0 };
          return offsetToCursorPosition(value, textarea.selectionStart ?? 0);
        },
        focusAtPosition: (position, options) => {
          const textarea = textareaRef.current;
          if (!textarea) return;
          const offset = cursorPositionToOffset(value, position);
          focusTextareaAt(textarea, offset, options);
          if (active) resizeToContent();
        },
        focus: (options) => {
          textareaRef.current?.focus({ preventScroll: options?.preventScroll ?? false });
        },
        syncHeight: () => {
          if (active) resizeToContent();
        },
      }),
      [active, resizeToContent, value],
    );

    const uploadFiles = useCallback(
      async (files: FileList | File[]) => {
        if (uploadingRef.current) return;

        if (!uploadEnabled) {
          setUploadState({
            kind: "error",
            message: "Configure Cloudflare R2 in Settings to attach files.",
          });
          return;
        }

        const textarea = textareaRef.current;
        if (!textarea) return;

        const fileList = Array.from(files);
        if (fileList.length === 0) return;

        uploadingRef.current = true;

        let nextValue = value;
        let nextCursor = textarea.selectionStart ?? nextValue.length;

        try {
          for (const [index, file] of fileList.entries()) {
            const progress =
              fileList.length > 1 ? ` (${index + 1} of ${fileList.length})` : "";
            setUploadState({
              kind: "uploading",
              message: `Uploading ${file.name}${progress}…`,
            });

            const result = await api.uploadFile(file);
            const snippet = buildUploadMarkdown({
              url: result.url,
              filename: result.filename,
              isImage: result.isImage,
            });

            textarea.setSelectionRange(nextCursor, nextCursor);
            const inserted = insertAtCursor(textarea, snippet, nextValue);
            nextValue = inserted.nextValue;
            nextCursor = inserted.nextCursor;
          }

          onChange(nextValue);
          focusTextareaAt(textarea, nextCursor);
          resizeToContent();
          setUploadState(null);
        } catch (error) {
          setUploadState({
            kind: "error",
            message: error instanceof Error ? error.message : "Upload failed",
          });
        } finally {
          uploadingRef.current = false;
        }
      },
      [onChange, resizeToContent, uploadEnabled, value],
    );

    const handlePaste = useCallback(
      (event: ClipboardEvent<HTMLTextAreaElement>) => {
        const files = event.clipboardData.files;
        if (files.length === 0) return;

        event.preventDefault();
        void uploadFiles(files);
      },
      [uploadFiles],
    );

    const handleDragOver = useCallback((event: DragEvent<HTMLTextAreaElement>) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    }, []);

    const handleDragLeave = useCallback((event: DragEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      setDragActive(false);
    }, []);

    const handleDrop = useCallback(
      (event: DragEvent<HTMLTextAreaElement>) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragActive(false);
        void uploadFiles(event.dataTransfer.files);
      },
      [uploadFiles],
    );

    const isUploading = uploadState?.kind === "uploading";

    return (
      <div className="markdown-textarea-wrap" aria-busy={isUploading}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          placeholder={placeholder}
          className={`${className ?? ""}${dragActive ? " markdown-textarea--drag-active" : ""}`}
          aria-label={ariaLabel}
        />
        {isUploading && (
          <div className="markdown-textarea-upload-overlay" role="status" aria-live="polite">
            <div className="markdown-textarea-upload-card">
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} aria-hidden="true" />
              <span>{uploadState.message}</span>
            </div>
          </div>
        )}
        {uploadState?.kind === "error" && (
          <p
            className="markdown-textarea-status markdown-textarea-status--error"
            role="alert"
          >
            {uploadState.message}
          </p>
        )}
      </div>
    );
  },
);

export default MarkdownTextarea;
