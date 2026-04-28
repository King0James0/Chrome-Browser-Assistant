import { config } from '../config';
import type { ModelRouter } from '../router';
import type { ChatMessage, ToolCall } from '../router/types';
import type { WSMessage } from '../shared/types';
import { dispatchTool } from '../tools';
import { runAgent } from './loop';
import { getChromeSession, selectActivePage } from './session';

const SYSTEM_PROMPT = `You are a concise AI assistant living as an overlay in the user's Chrome browser. You can read the current page, click/type, navigate, scroll, wait for elements, and capture screenshots.

Response style — be terse:
- No preamble. Don't say "I'll help you" or "Let me check the page".
- Don't narrate what you're about to do or what you just did. Just do it and answer.
- For "summarize / explain / what is" questions: respond with the answer alone, no setup.
- For action requests (click, fill, navigate): perform the action, then a single short confirmation sentence at most.
- No meta commentary. The user can't see your tool calls — they only see your final words. So if your final words are about your process, the user gets nothing useful.

Image / screenshot results:
- When a tool returns image data (base64 PNG, etc.), the user has ALREADY been shown the image and can download it.
- NEVER inline image data, base64 strings, or markdown image syntax (![]()) in your response. The bytes are not useful in your reply — they only clutter the chat.
- A screenshot tool result is a confirmation. Reply with at most one short sentence like "Screenshot taken." Or simply omit any text and let the rendered image speak for itself.

Tool use:
- Read once, reason from the result. Minimal tool calls.
- Don't hallucinate page contents — call get_text first if you need to know what's there.`;

export interface SessionState {
  history: ChatMessage[];
}

function scrubForHistory(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const obj = result as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.length > 4000) {
      out[key] = '<binary data — already displayed to the user; do not reproduce>';
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function handleChatRequest(
  msg: Extract<WSMessage, { kind: 'chat-request' }>,
  state: SessionState,
  router: ModelRouter,
  send: (reply: WSMessage) => void,
): Promise<void> {
  const modelId = msg.modelId || config.defaultModel;
  console.log(`[chat] request: modelId=${modelId || '(none)'} text="${msg.text.slice(0, 60)}"`);

  if (!modelId) {
    console.log('[chat] reject: no model configured');
    send({
      kind: 'error',
      message: 'No model configured. Set DEFAULT_MODEL in .env or pick one in the extension settings.',
    });
    return;
  }

  let page;
  try {
    console.log(`[chat] attaching to chrome on :${config.chromeDebugPort}`);
    const session = await getChromeSession(config.chromeDebugPort);
    page = await selectActivePage(session, msg.pageContext);
    console.log(`[chat] page selected: ${page.url()}`);
    await page.bringToFront().catch((err) => {
      console.warn(`[chat] bringToFront failed: ${err}`);
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`[chat] chrome attach failed: ${errMsg}`);
    send({ kind: 'error', message: errMsg });
    return;
  }

  const userPrompt = msg.pageContext
    ? `Current page: ${msg.pageContext.url} — "${msg.pageContext.title}"\n\n${msg.text}`
    : msg.text;

  const onChunk = (text: string) =>
    send({ kind: 'chat-response', chunk: text, done: false });

  const onToolCall = async (call: ToolCall): Promise<unknown> => {
    console.log(`[chat] tool call: ${call.name} ${JSON.stringify(call.arguments).slice(0, 120)}`);
    send({ kind: 'tool-call', tool: call.name, args: call.arguments });
    try {
      const result = await dispatchTool(page, call);
      const summary = JSON.stringify(result).slice(0, 120);
      console.log(`[chat] tool result: ${summary}`);
      send({ kind: 'tool-result', result });
      return scrubForHistory(result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`[chat] tool error: ${call.name} ${errMsg}`);
      send({ kind: 'tool-result', result: null, error: errMsg });
      return { error: errMsg };
    }
  };

  try {
    console.log(`[chat] starting agent loop with model ${modelId}`);
    const updated = await runAgent({
      router,
      modelId,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: userPrompt,
      history: state.history,
      onChunk,
      onToolCall,
    });
    state.history = updated.filter((m) => m.role !== 'system');
    console.log(`[chat] done; history size=${state.history.length}`);
    send({ kind: 'chat-response', chunk: '', done: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`[chat] agent loop error: ${errMsg}`);
    send({ kind: 'error', message: errMsg });
  }
}
