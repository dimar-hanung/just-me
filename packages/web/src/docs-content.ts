export type DocsSection = {
  id: string;
  title: string;
  paragraphs: string[];
  tailParagraphs?: string[];
  bullets?: string[];
  codeBlocks?: { label: string; code: string }[];
  links?: { href: string; label: string }[];
};

export const DOCS_SECTIONS: DocsSection[] = [
  {
    id: "overview",
    title: "Overview",
    paragraphs: [
      "Docs for Just Me. Use this page for setup guides that are not part of day-to-day todo work.",
      "The first topic is MCP (Model Context Protocol): connect Cursor or another MCP client to your todos from the editor.",
    ],
  },
  {
    id: "what-is-mcp",
    title: "What is MCP?",
    paragraphs: [
      "MCP lets an AI assistant call tools exposed by a server. Just Me ships a stdio MCP server: Cursor (or another client) starts a local Node process and talks to it over stdin/stdout.",
      "Some MCP servers use a remote URL (HTTP/SSE) instead. Just Me is stdio-only — there is no HTTP MCP endpoint to paste into a client.",
    ],
    links: [
      { href: "https://cursor.com/docs/mcp", label: "Cursor MCP documentation" },
      {
        href: "https://modelcontextprotocol.io/docs/develop/connect-local-servers",
        label: "MCP local servers guide",
      },
    ],
  },
  {
    id: "prerequisites",
    title: "Prerequisites",
    paragraphs: [
      "Complete Just Me onboarding in this app so storage and config are set up.",
      "Desktop installer users: use Copy Cursor MCP config below — no repo checkout required.",
      "Development (repo checkout): build MCP and point Cursor at packages/mcp/dist/bundle/stdio.js manually.",
    ],
    bullets: [
      "Node.js 20+ on PATH (Cursor runs node against the bundled stdio.js)",
      "Completed onboarding in this app",
      "Development only: pnpm install, then pnpm --filter @just-me/mcp build",
    ],
  },
  {
    id: "cursor-setup",
    title: "Cursor setup",
    paragraphs: [
      "Add a server definition in mcp.json. Cursor reads two locations and merges them; project config wins when the same server name appears in both.",
    ],
    bullets: [
      "Project (share with team): .cursor/mcp.json in the repo root",
      "Global (personal): ~/.cursor/mcp.json — on Windows, %USERPROFILE%\\.cursor\\mcp.json",
      "Open Cursor Settings → Tools & MCP to see connection status",
      "After editing mcp.json, reload the window (Developer: Reload Window) so Cursor picks up changes",
    ],
  },
  {
    id: "config-examples",
    title: "Config examples",
    paragraphs: [
      "Replace placeholder paths with your machine's absolute paths. Use forward slashes on Linux/macOS; escape backslashes in JSON on Windows.",
      "These examples are for development from a repo checkout. Installer users should prefer Copy Cursor MCP config above.",
    ],
    codeBlocks: [
      {
        label: "Development — Linux / macOS — .cursor/mcp.json",
        code: `{
  "mcpServers": {
    "just-me-todos": {
      "command": "node",
      "args": ["/absolute/path/to/just-me/packages/mcp/dist/bundle/stdio.js"],
      "env": {
        "JUST_ME_CONFIG": "/home/you/.config/just-me/config.json"
      }
    }
  }
}`,
      },
      {
        label: "Development — Windows — .cursor/mcp.json",
        code: `{
  "mcpServers": {
    "just-me-todos": {
      "command": "node",
      "args": ["C:\\\\path\\\\to\\\\just-me\\\\packages\\\\mcp\\\\dist\\\\bundle\\\\stdio.js"],
      "env": {
        "JUST_ME_CONFIG": "C:\\\\Users\\\\you\\\\AppData\\\\Roaming\\\\just-me\\\\config.json"
      }
    }
  }
}`,
      },
    ],
  },
  {
    id: "verify",
    title: "Verify",
    paragraphs: ["After reload, confirm the server is connected:"],
    bullets: [
      "Cursor Settings → Tools & MCP shows just-me-todos as connected (green)",
      "In Agent or chat, ask the assistant to call list_todos or list_statuses",
    ],
  },
  {
    id: "other-clients",
    title: "Other MCP clients",
    paragraphs: [
      "Any client that supports stdio MCP can use the same shape: command, args, and env with JUST_ME_CONFIG pointing at your config file.",
      "Claude Desktop uses a different config file path (see the MCP local servers guide), but the mcpServers JSON structure is the same.",
      "Just Me does not expose an HTTP or SSE MCP URL.",
    ],
  },
  {
    id: "tools",
    title: "Tools",
    paragraphs: ["The Just Me MCP server exposes these tools:"],
    bullets: [
      "list_todos — optional status_id, code",
      "get_todo — by id or ticket code; includes content_with_lines (N|line) for edits",
      "add_todo — title plus optional content, status_id, dates, field_values",
      "update_todo — patch fields by id (full content replace)",
      "edit_todo_lines — line-range markdown edit (1-based inclusive start_line / end_line)",
      "list_statuses",
      "list_fields — call before setting field_values on add/update",
    ],
    tailParagraphs: [
      "Prefer edit_todo_lines over replacing the whole content via update_todo. Use get_todo to read content_with_lines, then edit_todo_lines with start_line, end_line, and new_content.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    paragraphs: [],
    bullets: [
      "Server exits immediately — complete onboarding in Just Me first; MCP requires storage and onboardingComplete in config.json",
      "Command not found or module errors — rebuild MCP (pnpm --filter @just-me/mcp build) and check the path to dist/bundle/stdio.js",
      "Wrong data or empty lists — set JUST_ME_CONFIG to the same config file this app uses (see Settings → health check for storage path hints)",
      "Relative paths in args often fail — use absolute paths to stdio.js",
      "Changes to MCP code — rebuild before expecting Cursor to run the new server",
    ],
  },
];
