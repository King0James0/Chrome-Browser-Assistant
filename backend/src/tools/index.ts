import fs from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright';
import { z } from 'zod';
import { config } from '../config';
import type { ToolCall, ToolDefinition } from '../router/types';

type ToolSpec = {
  definition: ToolDefinition;
  schema: z.ZodTypeAny;
  run: (page: Page, input: unknown) => Promise<unknown>;
};

function defineTool<S extends z.ZodTypeAny>(spec: {
  definition: ToolDefinition;
  schema: S;
  run: (page: Page, input: z.infer<S>) => Promise<unknown>;
}): ToolSpec {
  return {
    definition: spec.definition,
    schema: spec.schema,
    run: spec.run as (page: Page, input: unknown) => Promise<unknown>,
  };
}

const tools: Record<string, ToolSpec> = {
  click: defineTool({
    definition: {
      name: 'click',
      description:
        'Click an element by CSS selector or Playwright text= locator. Examples: "button.subscribe", "text=Submit", "[data-testid=login]".',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector or text= locator' },
        },
        required: ['selector'],
      },
    },
    schema: z.object({ selector: z.string() }),
    async run(page, { selector }) {
      await page.locator(selector).first().click();
      return { ok: true };
    },
  }),

  type: defineTool({
    definition: {
      name: 'type',
      description:
        'Fill text into an input or textarea identified by selector. Replaces existing value.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['selector', 'text'],
      },
    },
    schema: z.object({ selector: z.string(), text: z.string() }),
    async run(page, { selector, text }) {
      await page.locator(selector).first().fill(text);
      return { ok: true };
    },
  }),

  scroll: defineTool({
    definition: {
      name: 'scroll',
      description:
        'Scroll the page or an element. Provide deltaY for a relative scroll, or toSelector to scroll a specific element into view.',
      parameters: {
        type: 'object',
        properties: {
          deltaY: { type: 'number', description: 'Relative scroll in pixels (positive = down)' },
          toSelector: { type: 'string', description: 'Scroll this selector into view' },
        },
      },
    },
    schema: z.object({
      deltaY: z.number().optional(),
      toSelector: z.string().optional(),
    }),
    async run(page, input) {
      if (input.toSelector) {
        await page.locator(input.toSelector).first().scrollIntoViewIfNeeded();
      } else if (typeof input.deltaY === 'number') {
        await page.mouse.wheel(0, input.deltaY);
      }
      return { ok: true };
    },
  }),

  get_text: defineTool({
    definition: {
      name: 'get_text',
      description:
        'Return visible text under a selector. Defaults to body. Long results are truncated.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', default: 'body' },
          maxChars: { type: 'number', default: 8000 },
        },
      },
    },
    schema: z.object({
      selector: z.string().default('body'),
      maxChars: z.number().int().positive().default(8000),
    }),
    async run(page, { selector, maxChars }) {
      const text = await page.locator(selector).first().innerText();
      const truncated = text.length > maxChars;
      return {
        text: truncated ? `${text.slice(0, maxChars)}\n…` : text,
        truncated,
      };
    },
  }),

  get_html: defineTool({
    definition: {
      name: 'get_html',
      description:
        'Return raw HTML under a selector. Defaults to body. Long results are truncated.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', default: 'body' },
          maxChars: { type: 'number', default: 16000 },
        },
      },
    },
    schema: z.object({
      selector: z.string().default('body'),
      maxChars: z.number().int().positive().default(16000),
    }),
    async run(page, { selector, maxChars }) {
      const html = await page.locator(selector).first().innerHTML();
      const truncated = html.length > maxChars;
      return {
        html: truncated ? `${html.slice(0, maxChars)}\n…` : html,
        truncated,
      };
    },
  }),

  navigate: defineTool({
    definition: {
      name: 'navigate',
      description: 'Navigate the current page to a URL.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Absolute URL' } },
        required: ['url'],
      },
    },
    schema: z.object({ url: z.string().url() }),
    async run(page, { url }) {
      await page.goto(url);
      return { ok: true, finalUrl: page.url() };
    },
  }),

  wait_for_selector: defineTool({
    definition: {
      name: 'wait_for_selector',
      description: 'Block until a selector becomes visible. Throws on timeout.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          timeoutMs: { type: 'number', default: 10000 },
        },
        required: ['selector'],
      },
    },
    schema: z.object({
      selector: z.string(),
      timeoutMs: z.number().int().positive().default(10000),
    }),
    async run(page, { selector, timeoutMs }) {
      await page.locator(selector).first().waitFor({ timeout: timeoutMs, state: 'visible' });
      return { ok: true };
    },
  }),

  screenshot: defineTool({
    definition: {
      name: 'screenshot',
      description:
        'Capture a PNG screenshot. Default (no selector) captures the VISIBLE VIEWPORT — what the user sees right now. Pass a selector ONLY to capture a specific element. Do NOT pass "body" or "html" as selector; omit selector for the viewport. Image is shown to the user automatically — do not inline base64 in your response.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'OPTIONAL element selector. Omit for visible viewport (most common).',
          },
        },
      },
    },
    schema: z.object({ selector: z.string().optional() }),
    async run(page, { selector }) {
      const isWholeDoc = selector && /^(body|html|:root)$/i.test(selector.trim());
      const OVERLAY_HOST_ID = 'chrome-browser-assistant-overlay-host';
      await page
        .evaluate((id: string) => {
          const doc = (globalThis as { document?: unknown }).document as
            | { getElementById: (s: string) => { style: { visibility: string } } | null }
            | undefined;
          const el = doc?.getElementById(id);
          if (el) el.style.visibility = 'hidden';
        }, OVERLAY_HOST_ID)
        .catch(() => {});
      let png: Buffer;
      try {
        png = selector && !isWholeDoc
          ? await page.locator(selector).first().screenshot({ timeout: 10000 })
          : await page.screenshot({ timeout: 10000 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/0 width|0 height|viewport/i.test(msg) && !selector) {
          console.log('[screenshot] viewport screenshot failed, falling back to fullPage');
          png = await page.screenshot({ fullPage: true, timeout: 30000 });
        } else {
          throw err;
        }
      } finally {
        await page
          .evaluate((id: string) => {
            const doc = (globalThis as { document?: unknown }).document as
              | { getElementById: (s: string) => { style: { visibility: string } } | null }
              | undefined;
            const el = doc?.getElementById(id);
            if (el) el.style.visibility = '';
          }, OVERLAY_HOST_ID)
          .catch(() => {});
      }
      const dir = path.resolve(config.screenshotsDir);
      fs.mkdirSync(dir, { recursive: true });
      const filename = `screenshot-${Date.now()}.png`;
      const fullPath = path.join(dir, filename);
      fs.writeFileSync(fullPath, png);
      return {
        mimeType: 'image/png',
        base64: png.toString('base64'),
        savedPath: fullPath,
        sizeBytes: png.length,
      };
    },
  }),
};

export const v1Tools: ToolDefinition[] = Object.values(tools).map((t) => t.definition);

export async function dispatchTool(page: Page, call: ToolCall): Promise<unknown> {
  const tool = tools[call.name];
  if (!tool) {
    throw new Error(`unknown tool: ${call.name}`);
  }
  const parsed = tool.schema.safeParse(call.arguments);
  if (!parsed.success) {
    throw new Error(`invalid args for ${call.name}: ${parsed.error.message}`);
  }
  return tool.run(page, parsed.data);
}
