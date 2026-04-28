import { useCallback, useEffect, useRef, useState } from 'react';

export interface Position {
  x: number;
  y: number;
}

export interface DraggableOptions {
  initial: Position;
  edgeSnapDistance?: number;
  bubbleSize?: number;
  onChange?: (pos: Position, isDragging: boolean) => void;
  onDragEnd?: (pos: Position) => void;
}

export function useDraggable(opts: DraggableOptions) {
  const [position, setPosition] = useState<Position>(opts.initial);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const movedRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setPosition((current) => {
      dragStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        startX: current.x,
        startY: current.y,
      };
      return current;
    });
    movedRef.current = false;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.pointerX;
      const dy = e.clientY - start.pointerY;
      if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;
      const next = { x: start.startX + dx, y: start.startY + dy };
      setPosition(next);
      optsRef.current.onChange?.(next, true);
    };

    const onUp = () => {
      const snap = optsRef.current.edgeSnapDistance ?? 24;
      const size = optsRef.current.bubbleSize ?? 64;
      setPosition((p) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        let { x, y } = p;
        if (x < snap) x = 0;
        else if (x > w - snap - size) x = w - size;
        if (y < snap) y = 0;
        else if (y > h - snap - size) y = h - size;
        const final = { x, y };
        optsRef.current.onDragEnd?.(final);
        return final;
      });
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDragging]);

  const didMove = useCallback(() => movedRef.current, []);

  return { position, isDragging, didMove, onPointerDown, setPosition };
}
