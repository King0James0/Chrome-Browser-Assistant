import { useEffect, useState } from 'react';
import Bubble from './Bubble';
import Chat, { type ChatMessageView } from './Chat';
import { avatarSrc } from './avatars';
import { onMessage, probeBackend, sendMessage } from './messaging';
import { getSettings, setSettings } from '../shared/storage';
import type { PageContext, WSMessage } from '../shared/types';
import type { Position } from './useDraggable';

type ViewMode = 'bubble' | 'compact' | 'full';

export default function App() {
  const [view, setView] = useState<ViewMode>('bubble');
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 });
  const [avatar, setAvatar] = useState<string>(avatarSrc('astronaut'));
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [defaultModel, setDefaultModel] = useState('');

  useEffect(() => {
    let active = true;
    getSettings().then((s) => {
      if (!active) return;
      setAvatar(avatarSrc(s.avatarId, s.avatarDataUrl));
      setDefaultModel(s.defaultModel);
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
          if (last && last.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: last.content + msg.chunk }];
          }
          return [...prev, { id: randomId(), role: 'assistant', content: msg.chunk }];
        });
        if (msg.done) setPending(false);
      } else if (msg.kind === 'toggle-overlay') {
        setView((v) => (v === 'bubble' ? 'compact' : 'bubble'));
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
    setMessages((prev) => [...prev, { id: randomId(), role: 'user', content: text }]);
    setPending(true);
    const ctx: PageContext = {
      url: location.href,
      title: document.title,
      selectedText: window.getSelection()?.toString() || undefined,
    };
    const msg: WSMessage = {
      kind: 'chat-request',
      tabId: -1,
      text,
      modelId: defaultModel,
      pageContext: ctx,
    };
    sendMessage(msg);
  }

  function handlePosChange(p: Position) {
    setPosition(p);
    setSettings({ bubblePosition: p });
  }

  if (view === 'bubble') {
    if (position.x < 0 || position.y < 0) return null;
    return (
      <Bubble
        avatarSrc={avatar}
        initialPosition={position}
        onClick={() => setView('compact')}
        onPositionChange={handlePosChange}
      />
    );
  }

  return (
    <Chat
      avatarSrc={avatar}
      mode={view}
      messages={messages}
      pending={pending}
      connected={connected}
      onSend={handleSend}
      onCollapse={() => setView('bubble')}
      onToggleFullMode={() => setView(view === 'full' ? 'compact' : 'full')}
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
