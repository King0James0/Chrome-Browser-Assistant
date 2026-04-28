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
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))',
        transition: isDragging ? 'none' : 'left 120ms ease-out, top 120ms ease-out',
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
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>
  );
}
