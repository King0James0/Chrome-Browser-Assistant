import { useCallback, useEffect, useRef, useState } from 'react';

export interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachment?: { type: 'image'; dataUrl: string; savedPath?: string };
}

interface ChatProps {
  avatarSrc: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  messages: ChatMessageView[];
  pending: boolean;
  connected: boolean;
  bubblePosition: { x: number; y: number };
  bubbleSize?: number;
  onSend: (text: string) => void;
  onCollapse: () => void;
  onPositionChange: (p: { x: number; y: number }) => void;
  onSizeChange: (s: { width: number; height: number }) => void;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 240;

type EdgeName = 'top' | 'bottom' | 'left' | 'right';
type Corner = { horizontal: 'left' | 'right'; vertical: 'top' | 'bottom' };

export default function Chat({
  avatarSrc,
  position,
  size,
  messages,
  pending,
  connected,
  bubblePosition,
  bubbleSize = 64,
  onSend,
  onCollapse,
  onPositionChange,
  onSizeChange,
}: ChatProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;
  const isLeftHalf = bubblePosition.x + bubbleSize / 2 < w / 2;
  const isTopHalf = bubblePosition.y + bubbleSize / 2 < h / 2;
  const pageFacingSide: 'right' | 'left' = isLeftHalf ? 'right' : 'left';
  const corner: Corner = {
    horizontal: pageFacingSide,
    vertical: isTopHalf ? 'bottom' : 'top',
  };

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

  const startResize = useCallback(
    (edges: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean }) =>
      (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startX = position.x;
        const startY = position.y;
        const startW = size.width;
        const startH = size.height;

        const onMove = (ev: PointerEvent) => {
          const dx = ev.clientX - startClientX;
          const dy = ev.clientY - startClientY;
          let nx = startX;
          let ny = startY;
          let nw = startW;
          let nh = startH;

          if (edges.right) nw = startW + dx;
          if (edges.left) {
            nw = startW - dx;
            nx = startX + dx;
          }
          if (edges.bottom) nh = startH + dy;
          if (edges.top) {
            nh = startH - dy;
            ny = startY + dy;
          }

          const viewportW = document.documentElement.clientWidth;
          const viewportH = document.documentElement.clientHeight;
          const maxW = viewportW - 16;
          const maxH = viewportH - 16;
          if (nw < MIN_WIDTH) {
            if (edges.left) nx -= MIN_WIDTH - nw;
            nw = MIN_WIDTH;
          }
          if (nh < MIN_HEIGHT) {
            if (edges.top) ny -= MIN_HEIGHT - nh;
            nh = MIN_HEIGHT;
          }
          if (nw > maxW) nw = maxW;
          if (nh > maxH) nh = maxH;

          nx = Math.max(0, Math.min(viewportW - nw, nx));
          ny = Math.max(0, Math.min(viewportH - nh, ny));

          onPositionChange({ x: nx, y: ny });
          onSizeChange({ width: nw, height: nh });
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      },
    [position.x, position.y, size.width, size.height, onPositionChange, onSizeChange],
  );

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
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
        <img src={avatarSrc} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>Chrome-Browser-Assistant</div>
          <div style={{ fontSize: 11, color: connected ? '#7ec98a' : '#e88a8a' }}>
            {connected ? 'connected' : 'backend disconnected'}
          </div>
        </div>
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
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.18) transparent',
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#888', fontSize: 12 }}>
            Ask about this page, or type a slash command (try <code>/help</code>).
          </div>
        )}
        {messages.map((m) => (
          <MessageRow
            key={m.id}
            role={m.role}
            content={m.content}
            attachment={m.attachment}
          />
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
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          onKeyUp={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.stopPropagation()}
          placeholder={connected ? 'Ask anything, or /help' : 'backend disconnected'}
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

      <EdgeHandle edge="top" onPointerDown={startResize({ top: true })} />
      <EdgeHandle edge="bottom" onPointerDown={startResize({ bottom: true })} />
      <EdgeHandle edge={pageFacingSide} onPointerDown={startResize({ [pageFacingSide]: true })} />
      <CornerHandle corner={corner} onPointerDown={startResize(cornerEdges(corner))} />
    </div>
  );
}

function MessageRow({
  role,
  content,
  attachment,
}: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachment?: { type: 'image'; dataUrl: string; savedPath?: string };
}) {
  if (role === 'system') {
    return (
      <div style={{ color: '#888', fontSize: 11, fontStyle: 'italic', textAlign: 'center' }}>
        {content}
      </div>
    );
  }
  const isUser = role === 'user';
  if (!content && attachment?.type === 'image') {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'flex-start', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openImageInNewTab(attachment.dataUrl);
          }}
          style={{ alignSelf: 'flex-start', cursor: 'pointer' }}
        >
          <img
            src={attachment.dataUrl}
            alt="screenshot"
            style={{
              maxWidth: '90%',
              maxHeight: 220,
              borderRadius: 8,
              display: 'block',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#888',
            marginTop: 6,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span>screenshot — click thumbnail to preview</span>
          {attachment.savedPath && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard
                  .writeText(attachment.savedPath ?? '')
                  .catch(() => {});
              }}
              style={linkButtonStyle}
              title="copy file path to clipboard"
            >
              copy path
            </button>
          )}
        </div>
        {attachment.savedPath && (
          <div
            style={{
              fontSize: 11,
              color: '#7eb6ff',
              marginTop: 4,
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              userSelect: 'all',
            }}
          >
            {attachment.savedPath}
          </div>
        )}
      </div>
    );
  }
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

function EdgeHandle({
  edge,
  onPointerDown,
}: {
  edge: EdgeName;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const isHorizontal = edge === 'top' || edge === 'bottom';
  const cursor = isHorizontal ? 'ns-resize' : 'ew-resize';
  const thickness = 5;
  const inset = 14; // leave space for corner handles
  const style: React.CSSProperties = {
    position: 'absolute',
    cursor,
    touchAction: 'none',
  };
  if (edge === 'top') {
    Object.assign(style, { top: 0, left: inset, right: inset, height: thickness });
  } else if (edge === 'bottom') {
    Object.assign(style, { bottom: 0, left: inset, right: inset, height: thickness });
  } else if (edge === 'left') {
    Object.assign(style, { left: 0, top: inset, bottom: inset, width: thickness });
  } else {
    Object.assign(style, { right: 0, top: inset, bottom: inset, width: thickness });
  }
  return <div style={style} onPointerDown={onPointerDown} />;
}

function CornerHandle({
  corner,
  onPointerDown,
}: {
  corner: Corner;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cursor =
    (corner.horizontal === 'right' && corner.vertical === 'bottom') ||
    (corner.horizontal === 'left' && corner.vertical === 'top')
      ? 'nwse-resize'
      : 'nesw-resize';
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        [corner.horizontal]: 0,
        [corner.vertical]: 0,
        width: 14,
        height: 14,
        cursor,
        touchAction: 'none',
        background: `linear-gradient(${gradientAngle(corner)}, transparent 50%, rgba(255,255,255,0.3) 50%)`,
      }}
    />
  );
}

function cornerEdges(c: Corner) {
  return {
    [c.horizontal]: true,
    [c.vertical]: true,
  } as { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };
}

function gradientAngle(c: Corner): string {
  if (c.horizontal === 'right' && c.vertical === 'bottom') return '135deg';
  if (c.horizontal === 'left' && c.vertical === 'bottom') return '225deg';
  if (c.horizontal === 'right' && c.vertical === 'top') return '45deg';
  return '315deg';
}

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function openImageInNewTab(dataUrl: string): void {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    console.warn('[overlay] failed to open screenshot', err);
  }
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

const linkButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#7eb6ff',
  border: 'none',
  padding: 0,
  fontSize: 11,
  cursor: 'pointer',
  textDecoration: 'underline',
  fontFamily: 'inherit',
};
