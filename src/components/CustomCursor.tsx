import { useEffect, useRef, useState } from 'react';

interface CustomCursorProps {
  isDragging: boolean;
}

export default function CustomCursor({ isDragging }: CustomCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -100, y: -100, tx: -100, ty: -100 });
  const [mode, setMode] = useState<'default' | 'drag' | 'action'>('default');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isCoarse || reduced) return;

    document.body.classList.add('has-custom-cursor');

    const onMove = (e: MouseEvent) => {
      pos.current.tx = e.clientX;
      pos.current.ty = e.clientY;
      setVisible(true);

      const target = e.target as HTMLElement | null;
      if (target?.closest('button, a, input, select, [data-cursor="action"]')) {
        setMode('action');
      } else if (target?.closest('.canvas-stage') || target === document.body) {
        setMode('drag');
      } else {
        setMode('default');
      }
    };

    const onLeave = () => setVisible(false);

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    let raf = 0;
    const render = () => {
      pos.current.x += (pos.current.tx - pos.current.x) * 0.24;
      pos.current.y += (pos.current.ty - pos.current.y) * 0.24;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      document.body.classList.remove('has-custom-cursor');
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  const effectiveMode = isDragging ? 'drag' : mode;

  return (
    <div
      ref={cursorRef}
      className={`custom-cursor cursor--${effectiveMode}`}
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden="true"
    >
      <div className="cursor-ring">
        <span className="cursor-label">{isDragging ? 'ORBIT' : '360°'}</span>
      </div>
      <div className="cursor-dot" />
    </div>
  );
}
