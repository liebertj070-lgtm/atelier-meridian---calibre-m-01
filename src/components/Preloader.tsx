import { useEffect, useRef, useState } from 'react';

interface PreloaderProps {
  sceneReady: boolean;
  onFinished?: () => void;
}

export default function Preloader({ sceneReady, onFinished }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      if (finishedRef.current) return;
      const elapsed = now - start;
      const target = sceneReady ? 100 : 88;

      setProgress((prev) => {
        const step = sceneReady ? 4 : 1.3;
        const next = Math.min(target, prev + step);
        if (next >= 100 && elapsed > 800 && !finishedRef.current) {
          finishedRef.current = true;
          window.setTimeout(() => {
            setDone(true);
            onFinished?.();
          }, 220);
          return 100;
        }
        return next;
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [sceneReady, onFinished]);

  return (
    <div
      className={`preloader-curtain fixed inset-0 z-50 flex flex-col justify-between bg-[#09090b] p-6 sm:p-10 md:p-14 ${
        done ? 'is-done' : ''
      }`}
      aria-hidden={done}
    >
      <div className="font-tech flex items-center justify-between text-[11px] tracking-[0.16em] text-[#9a948a]">
        <span>Geneva · 46.2044° N</span>
        <span>Calibre M-01 Chronometer</span>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="font-display text-center text-3xl font-normal tracking-[0.2em] text-[#f2ede4] uppercase sm:text-5xl">
          Atelier Meridian
        </div>
        <div className="relative h-px w-[min(320px,72vw)] overflow-hidden bg-[#f2ede4]/15">
          <div
            className="absolute inset-y-0 left-0 bg-[#d4a86a] transition-[width] duration-200 ease-out"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
      </div>

      <div className="font-tech flex items-end justify-between text-xs tracking-[0.14em] text-[#d4a86a]">
        <span>Calibrating Tourbillon Kinematics</span>
        <span className="font-display text-3xl font-normal leading-none text-[#f2ede4] sm:text-5xl">
          {String(Math.round(progress)).padStart(3, '0')}%
        </span>
      </div>
    </div>
  );
}
