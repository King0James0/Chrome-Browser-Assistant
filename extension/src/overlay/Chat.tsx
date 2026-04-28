import { useEffect, useRef, useState } from 'react';

export interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  avatarSrc: string;
  mode: 'compact' | 'full';
  messages: ChatMessageView[];
  pending: boolean;
  connected: boolean;
  onSend: (text: string) => void;
  onCollapse: () => void;
  onToggleFullMode: () => void;
}

export default function Chat({
  avatarSrc,
  mode,
  messages,
  pending,
  connected,
  onSend,
  onCollapse,
  onToggleFullMode,
}: ChatProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  function handleSend() {
    const text = input.trim();
    if (!text || pending) return;
    onSend(text);
    setInput('');
  }

  const isFull = mode === 'full';
  const width = isFull ? 480 : 320;
  const height = isFull ? 600 : 380;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width,
        height,
        background: 'rgba(20, 20, 22, 0.95)',
        color: '#eee',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <img src={avatarSrc} alt="" style={{ width: 28, height: 28 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>Chrome-Browser-Assistant</div>
          <div style={{ fontSize: 11, color: connected ? '#7ec98a' : '#e88a8a' }}>
            {connected ? 'connected' : 'backend disconnected'}
          </div>
        </div>
        <button
          onClick={onToggleFullMode}
          title={isFull ? 'Compact' : 'Full mode'}
          style={iconButtonStyle}
        >
          {isFull ? '⤢' : '⤡'}
        </button>
        <button onClick={onCollapse} title="Close" style={iconButtonStyle}>
          {'✕'}
        </button>
      </header>

      <div
        ref={listRef}
        style={{
          flex: 1,
          padding: 12,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#888', fontSize: 12 }}>
            Ask about this page, or type a slash command.
          </div>
        )}
        {messages.map((m) => (
          <MessageRow key={m.id} role={m.role} content={m.content} />
        ))}
      </div>

      <footer
        style={{
          padding: 8,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: 6,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={connected ? 'Ask anything...' : 'backend disconnected'}
          disabled={!connected || pending}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            color: '#eee',
            border: 'none',
            borderRadius: 6,
            padding: '8px 10px',
            outline: 'none',
            fontSize: 13,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!connected || pending || !input.trim()}
          style={{
            background: '#3a7afe',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '0 12px',
            cursor: 'pointer',
            opacity: !connected || pending || !input.trim() ? 0.4 : 1,
          }}
        >
          {'↑'}
        </button>
      </footer>
    </div>
  );
}

function MessageRow({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          background: isUser ? '#3a7afe' : 'rgba(255,255,255,0.08)',
          color: isUser ? 'white' : '#eee',
          padding: '6px 10px',
          borderRadius: 10,
          maxWidth: '85%',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </div>
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#aaa',
  border: 'none',
  width: 24,
  height: 24,
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  borderRadius: 4,
};
