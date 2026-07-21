import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createDb,
  loadConfig,
  listTodos,
  addTodo,
  updateTodo,
  getTodo,
  getTodoByCode,
  listStatuses,
  listFields,
  type Todo,
} from "@just-me/core";
import { applyLineRangeEdit, formatNumberedContent } from "./line-edit.js";

async function resolveTodo(
  client: Awaited<ReturnType<typeof createDb>>["client"],
  id?: string,
  code?: string,
): Promise<Todo | null> {
  if (id) return getTodo(client, id);
  if (code) return getTodoByCode(client, code);
  return null;
}

async function main() {
  const config = await loadConfig();
  if (!config.onboardingComplete || !config.storage) {
    console.error("Just Me MCP: complete onboarding and configure storage first.");
    process.exit(1);
  }

  const { client } = await createDb(config);
  const server = new McpServer({ name: "just-me-todos", version: "0.1.3" });

  server.tool(
    "list_todos",
    "List todos with optional status or ticket code filter",
    {
      status_id: z.string().optional(),
      code: z.string().optional(),
    },
    async ({ status_id, code }) => {
      const todos = await listTodos(client, { statusId: status_id, code });
      return {
        content: [{ type: "text", text: JSON.stringify(todos, null, 2) }],
      };
    },
  );

  server.tool(
    "get_todo",
    "Get one todo by id or ticket code. Includes content_with_lines (N|line) for line-range edits.",
    {
      id: z.string().optional(),
      code: z.string().optional(),
    },
    async ({ id, code }) => {
      if (!id && !code) {
        return {
          content: [{ type: "text", text: "Provide id or code" }],
          isError: true,
        };
      }
      const todo = await resolveTodo(client, id, code);
      if (!todo) {
        return { content: [{ type: "text", text: "Todo not found" }], isError: true };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...todo,
                content_with_lines: formatNumberedContent(todo.content),
                line_count: todo.content.split("\n").length,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "add_todo",
    "Create a todo (defaults to Not Started status)",
    {
      title: z.string(),
      content: z.string().optional(),
      status_id: z.string().optional(),
      start_at: z.string().nullable().optional(),
      deadline_at: z.string().nullable().optional(),
      done_at: z.string().nullable().optional(),
      field_values: z.record(z.union([z.string(), z.array(z.string())])).optional(),
    },
    async ({ title, content, status_id, start_at, deadline_at, done_at, field_values }) => {
      const todo = await addTodo(client, {
        title,
        content,
        statusId: status_id,
        startAt: start_at ?? null,
        deadlineAt: deadline_at ?? null,
        doneAt: done_at ?? null,
        fieldValues: field_values,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(todo, null, 2) }],
      };
    },
  );

  server.tool(
    "update_todo",
    "Update a todo (full content replace). Prefer edit_todo_lines for partial markdown edits.",
    {
      id: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
      status_id: z.string().optional(),
      start_at: z.string().nullable().optional(),
      deadline_at: z.string().nullable().optional(),
      done_at: z.string().nullable().optional(),
      field_values: z.record(z.union([z.string(), z.array(z.string())])).optional(),
    },
    async ({ id, title, content, status_id, start_at, deadline_at, done_at, field_values }) => {
      const todo = await updateTodo(client, id, {
        title,
        content,
        statusId: status_id,
        startAt: start_at,
        deadlineAt: deadline_at,
        doneAt: done_at,
        fieldValues: field_values,
      });
      if (!todo) {
        return { content: [{ type: "text", text: "Todo not found" }], isError: true };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(todo, null, 2) }],
      };
    },
  );

  server.tool(
    "edit_todo_lines",
    "Edit todo markdown by 1-based line range. Use get_todo first for content_with_lines. end_line = start_line - 1 inserts; new_content \"\" deletes the range.",
    {
      id: z.string().optional(),
      code: z.string().optional(),
      start_line: z.number().int(),
      end_line: z.number().int(),
      new_content: z.string(),
    },
    async ({ id, code, start_line, end_line, new_content }) => {
      if (!id && !code) {
        return {
          content: [{ type: "text", text: "Provide id or code" }],
          isError: true,
        };
      }
      const existing = await resolveTodo(client, id, code);
      if (!existing) {
        return { content: [{ type: "text", text: "Todo not found" }], isError: true };
      }

      const edited = applyLineRangeEdit(
        existing.content,
        start_line,
        end_line,
        new_content,
      );
      if (!edited.ok) {
        return { content: [{ type: "text", text: edited.error }], isError: true };
      }

      const todo = await updateTodo(client, existing.id, { content: edited.content });
      if (!todo) {
        return { content: [{ type: "text", text: "Todo not found" }], isError: true };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...todo,
                content_with_lines: formatNumberedContent(todo.content),
                line_count: edited.lineCount,
                edited_range: { start_line, end_line },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool("list_statuses", "List all status options", {}, async () => {
    const statuses = await listStatuses(client);
    return {
      content: [{ type: "text", text: JSON.stringify(statuses, null, 2) }],
    };
  });

  server.tool(
    "list_fields",
    "List all custom field definitions with predefined tag options",
    {},
    async () => {
      const fields = await listFields(client);
      return {
        content: [{ type: "text", text: JSON.stringify(fields, null, 2) }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
