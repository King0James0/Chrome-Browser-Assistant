import { config } from '../config';
import type { ModelRouter } from '../router';
import type { ChatMessage, ToolCall } from '../router/types';
import type { WSMessage } from '../shared/types';
import { dispatchTool } from '../tools';
import { runAgent } from './loop';
import { getChromeSession, selectActivePage } from './session';

const SYSTEM_PROMPT = `You are an AI assistant that lives as an overlay in the user's Chrome browser.

You can:
- Read the current page (get_text, get_html)
- Click and type into elements (click, type)
- Navigate, scroll, wait for elements
- Capture screenshots

Guidelines:
- When the user asks about the page, prefer get_text on the body or a relevant container. Read once and reason from the result.
- When the user asks you to act (click, fill, navigate), do exactly that and confirm what you did.
- If you make a mistake, acknowledge it and correct it.
- Don't hallucinate page contents. If you need to know what's on the page, call get_text first.
- Keep tool use minimal. Most questions can be answered with one or two reads.`;

export interface SessionState {
  history: ChatMessage[];
}

export async function handleChatRequest(
  msg: Extract<WSMessage, { kind: 'chat-request' }>,
  state: SessionState,
  router: ModelRouter,
  send: (reply: WSMessage) => void,
): Promise<void> {
  if (!msg.modelId && !config.defaultModel) {
    send({
      kind: 'error',
      message: 'No model configured. Set DEFAULT_MODEL in .env or pick one in the extension settings.',
    });
    return;
  }

  let page;
  try {
    const session = await getChromeSession(config.chromeDebugPort);
    page = await selectActivePage(session, msg.pageContext);
  } catch (err) {
    send({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    return;
  }

  const userPrompt = msg.pageContext
    ? `Current page: ${msg.pageContext.url} — "${msg.pageContext.title}"\n\n${msg.text}`
    : msg.text;

  const onChunk = (text: string) =>
    send({ kind: 'chat-response', chunk: text, done: false });

  const onToolCall = async (call: ToolCall): Promise<unknown> => {
    send({ kind: 'tool-call', tool: call.name, args: call.arguments });
    try {
      const result = await dispatchTool(page, call);
      send({ kind: 'tool-result', result });
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      send({ kind: 'tool-result', result: null, error: errMsg });
      return { error: errMsg };
    }
  };

  try {
    const updated = await runAgent({
      router,
      modelId: msg.modelId || config.defaultModel,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: userPrompt,
      history: state.history,
      onChunk,
      onToolCall,
    });
    state.history = updated.filter((m) => m.role !== 'system');
    send({ kind: 'chat-response', chunk: '', done: true });
  } catch (err) {
    send({
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
