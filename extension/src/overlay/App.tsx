import { useEffect, useRef, useState } from 'react';
import Bubble from './Bubble';
import Chat, { type ChatMessageView } from './Chat';
import { avatarSrc } from './avatars';
import { onMessage, probeBackend, sendMessage } from './messaging';
import { getSettings, setSettings } from '../shared/storage';
import type { PageContext, WSMessage } from '../shared/types';
import type { Position } from './useDraggable';

type ViewMode = 'bubble' | 'chat';

const DEFAULT_CHAT_SIZE = { width: 360, height: 440 };
const BUBBLE_SIZE = 64;

const HELP_TEXT = `Available commands:
/clear — clear chat history (extension side and backend session)
/help — show this message`;

export default function App() {
  const [view, setView] = useState<ViewMode>('bubble');
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 });
  const [chatSize, setChatSize] = useState(DEFAULT_CHAT_SIZE);
  const [chatPosition, setChatPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [avatar, setAvatar] = useState<string>(avatarSrc('astronaut'));
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [defaultModel, setDefaultModel] = useState('');
  const lastSelectionRef = useRef('');

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection()?.toString() ?? '';
      if (sel.trim().length > 0) {
        lastSelectionRef.current = sel;
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  useEffect(() => {
    let active = true;
    getSettings().then((s) => {
      if (!active) return;
      setAvatar(avatarSrc(s.avatarId, s.avatarDataUrl));
      setDefaultModel(s.defaultModel);
      setChatSize(s.chatSize ?? DEFAULT_CHAT_SIZE);
      const valid = s.bubblePosition.x >= 0 && s.bubblePosition.y >= 0;
      setPosition(valid ? s.bubblePosition : defaultPosition());
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return onMessage((msg) => {
      if (msg.kind === 'chat-response') {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && !last.attachment) {
            return [...prev.slice(0, -1), { ...last, content: last.content + msg.chunk }];
          }
          return [...prev, { id: randomId(), role: 'assistant', content: msg.chunk }];
        });
        if (msg.done) setPending(false);
      } else if (msg.kind === 'tool-result') {
        const r = msg.result as Record<string, unknown> | null;
        if (
          r &&
          typeof r === 'object' &&
          r.mimeType === 'image/png' &&
          typeof r.base64 === 'string'
        ) {
          const dataUrl = `data:image/png;base64,${r.base64}`;
          const savedPath = typeof r.savedPath === 'string' ? r.savedPath : undefined;
          setMessages((prev) => [
            ...prev,
            {
              id: randomId(),
              role: 'assistant',
              content: '',
              attachment: { type: 'image', dataUrl, savedPath },
            },
          ]);
        }
      } else if (msg.kind === 'toggle-overlay') {
        setView((v) => (v === 'bubble' ? 'chat' : 'bubble'));
      } else if (msg.kind === 'error') {
        setMessages((prev) => [
          ...prev,
          { id: randomId(), role: 'assistant', content: `error: ${msg.message}` },
        ]);
        setPending(false);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      const ok = await probeBackend().catch(() => false);
      if (!cancelled) setConnected(ok);
    }
    probe();
    const interval = setInterval(probe, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (trimmed === '/clear') {
      setMessages([]);
      sendMessage({ kind: 'clear-history' });
      return;
    }
    if (trimmed === '/help') {
      setMessages((prev) => [
        ...prev,
        { id: randomId(), role: 'user', content: trimmed },
        { id: randomId(), role: 'assistant', content: HELP_TEXT },
      ]);
      return;
    }

    setMessages((prev) => [...prev, { id: randomId(), role: 'user', content: trimmed }]);
    setPending(true);
    const liveSel = window.getSelection()?.toString() ?? '';
    const sel = liveSel.trim().length > 0 ? liveSel : lastSelectionRef.current;
    const ctx: PageContext = {
      url: location.href,
      title: document.title,
      selectedText: sel.trim().length > 0 ? sel : undefined,
    };
    const msg: WSMessage = {
      kind: 'chat-request',
      tabId: -1,
      text: trimmed,
      modelId: defaultModel,
      pageContext: ctx,
    };
    sendMessage(msg);
    lastSelectionRef.current = '';
  }

  function handlePosChange(p: Position) {
    setPosition(p);
    setSettings({ bubblePosition: p });
  }

  function handleSizeChange(s: { width: number; height: number }) {
    setChatSize(s);
    setSettings({ chatSize: s });
  }

  function openChat() {
    // Snapshot selection now, before chat input takes focus and clears it.
    const sel = window.getSelection()?.toString() ?? '';
    if (sel.trim().length > 0) {
      lastSelectionRef.current = sel;
    }
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    const isLeftHalf = position.x + BUBBLE_SIZE / 2 < w / 2;
    const isTopHalf = position.y + BUBBLE_SIZE / 2 < h / 2;
    const x = isLeftHalf ? position.x : Math.max(0, position.x + BUBBLE_SIZE - chatSize.width);
    const y = isTopHalf ? position.y : Math.max(0, position.y + BUBBLE_SIZE - chatSize.height);
    setChatPosition({
      x: Math.max(0, Math.min(w - chatSize.width, x)),
      y: Math.max(0, Math.min(h - chatSize.height, y)),
    });
    setView('chat');
  }

  useEffect(() => {
    function reclamp() {
      const w = document.documentElement.clientWidth;
      const h = document.documentElement.clientHeight;
      setPosition((p) => {
        if (p.x < 0 || p.y < 0) return p;
        return {
          x: Math.max(0, Math.min(w - BUBBLE_SIZE, p.x)),
          y: Math.max(0, Math.min(h - BUBBLE_SIZE, p.y)),
        };
      });
      setChatPosition((p) => ({
        x: Math.max(0, Math.min(w - chatSize.width, p.x)),
        y: Math.max(0, Math.min(h - chatSize.height, p.y)),
      }));
    }
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [chatSize.width, chatSize.height]);

  if (view === 'bubble') {
    if (position.x < 0 || position.y < 0) return null;
    return (
      <Bubble
        avatarSrc={avatar}
        initialPosition={position}
        size={BUBBLE_SIZE}
        onClick={openChat}
        onPositionChange={handlePosChange}
      />
    );
  }

  return (
    <Chat
      avatarSrc={avatar}
      position={chatPosition}
      size={chatSize}
      messages={messages}
      pending={pending}
      connected={connected}
      bubblePosition={position}
      bubbleSize={BUBBLE_SIZE}
      onSend={handleSend}
      onCollapse={() => setView('bubble')}
      onPositionChange={setChatPosition}
      onSizeChange={handleSizeChange}
    />
  );
}

function defaultPosition(): Position {
  return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
