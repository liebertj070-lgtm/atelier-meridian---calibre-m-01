import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useRef } from 'react';

interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'outline' | 'solid';
  size?: 'md' | 'sm';
  strength?: number;
}

export default function MagneticButton({
  children,
  className = '',
  variant = 'outline',
  size = 'md',
  strength = 0.24,
  onMouseMove,
  onMouseLeave,
  ...rest
}: MagneticButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    const el = btnRef.current;
    if (el && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      el.style.transition = '';
      el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
    }
    onMouseMove?.(e);
  };

  const handleMouseLeave = (e: MouseEvent<HTMLButtonElement>) => {
    const el = btnRef.current;
    if (el) {
      el.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    }
    onMouseLeave?.(e);
  };

  const baseStyles =
    'mag-btn font-tech inline-flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 uppercase tracking-[0.14em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a86a] cursor-pointer';
  const sizeStyles =
    size === 'sm' ? 'px-4 py-2 text-[11px] min-h-[40px]' : 'px-6 py-3.5 text-xs min-h-[44px]';
  const variantStyles =
    variant === 'solid'
      ? 'bg-[#d4a86a] text-[#09090b] border border-[#d4a86a] font-medium hover:bg-[#e1ba80]'
      : 'bg-[#121216]/90 text-[#f2ede4] border border-[#d4a86a]/40 hover:border-[#d4a86a] hover:bg-[#d4a86a]/12';

  return (
    <button
      ref={btnRef}
      type={rest.type ?? 'button'}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-cursor="action"
      {...rest}
    >
      {children}
    </button>
  );
}
