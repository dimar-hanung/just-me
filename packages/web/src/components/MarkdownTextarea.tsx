import { Loader2 } from "lucide-react";
import { useCallback, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { api } from "../api";
import {
  buildUploadMarkdown,
  focusTextareaAt,
  insertAtCursor,
} from "../markdown-insert";

type MarkdownTextareaProps = {
  value: string;
  onChange: (next: string) => void;
  uploadEnabled: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

type UploadState = {
  kind: "uploading" | "error";
  message: string;
};

export default function MarkdownTextarea({
  value,
  onChange,
  uploadEnabled,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: MarkdownTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadingRef = useRef(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [dragActive, setDragActive] = useState(false);

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
    [onChange, uploadEnabled, value],
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
}
