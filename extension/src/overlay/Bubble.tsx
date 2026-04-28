import { useDraggable, type Position } from './useDraggable';

interface BubbleProps {
  avatarSrc: string;
  initialPosition: Position;
  size?: number;
  onClick: () => void;
  onPositionChange: (pos: Position) => void;
}

export default function Bubble({
  avatarSrc,
  initialPosition,
  size = 64,
  onClick,
  onPositionChange,
}: BubbleProps) {
  const { position, isDragging, didMove, onPointerDown } = useDraggable({
    initial: initialPosition,
    bubbleSize: size,
    onDragEnd: onPositionChange,
  });

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(28, 30, 38, 0.92)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06) inset',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        transition: isDragging ? 'none' : 'left 120ms ease-out, top 120ms ease-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (!didMove()) onClick();
      }}
    >
      <img
        src={avatarSrc}
        alt=""
        draggable={false}
        style={{
          width: '78%',
          height: '78%',
          objectFit: 'contain',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
