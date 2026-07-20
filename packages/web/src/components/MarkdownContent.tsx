import { useRef } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toggleTaskListItem } from "../markdown-task-list";

type MarkdownContentProps = {
  source: string;
  onSourceChange?: (next: string) => void;
};

export default function MarkdownContent({ source, onSourceChange }: MarkdownContentProps) {
  const taskIndexRef = useRef(0);
  taskIndexRef.current = 0;

  if (!source.trim()) {
    return <p className="text-subtle text-sm">Nothing to preview yet. Switch to Write and add markdown.</p>;
  }

  const components: Components = {
    input: ({ disabled: _disabled, ...props }) => {
      if (props.type !== "checkbox") {
        return <input {...props} />;
      }

      const itemIndex = taskIndexRef.current;
      taskIndexRef.current += 1;

      const checked = Boolean(props.checked);

      if (!onSourceChange) {
        return <input {...props} checked={checked} disabled />;
      }

      return (
        <input
          {...props}
          type="checkbox"
          checked={checked}
          className="markdown-task-checkbox"
          aria-label={checked ? "Mark task incomplete" : "Mark task complete"}
          onChange={() => {
            onSourceChange(toggleTaskListItem(source, itemIndex));
          }}
        />
      );
    },
  };

  return (
    <div className="markdown-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
