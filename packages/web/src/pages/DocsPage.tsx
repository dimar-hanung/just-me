import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import DocsMcpSetupSection from "../components/DocsMcpSetupSection";
import { DOCS_SECTIONS } from "../docs-content";

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

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Docs</h1>
        <p className="text-sm text-muted">Setup guides for Just Me.</p>
      </header>

      {DOCS_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="space-y-3">
          <h2 className="text-lg font-medium">{section.title}</h2>

          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}

          {section.links?.length ? (
            <ul className="space-y-1 text-sm">
              {section.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {section.bullets?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          {section.id === "cursor-setup" ? <DocsMcpSetupSection /> : null}

          {section.tailParagraphs?.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}

          {section.codeBlocks?.map((block) => (
            <div key={block.label} className="docs-code-block panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border))] px-3 py-2">
                <span className="text-xs font-medium text-muted">{block.label}</span>
                <CopyCodeButton code={block.code} />
              </div>
              <pre className="docs-code-pre overflow-x-auto p-3 text-xs leading-relaxed">
                <code>{block.code}</code>
              </pre>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
