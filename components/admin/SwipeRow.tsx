'use client';

import type { ReactNode } from 'react';
import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion';
import { haptic } from '@/lib/admin/haptics';
import { cn } from '@/lib/utils';

/**
 * Swipeable list row (W1.6 / spec §4.2). framer-motion drag="x" reveals up to
 * one action per side; dragging past `autoThreshold` fires it with a light
 * haptic, otherwise the row springs back (stiffness 500 / damping 40). The
 * revealed buttons are real tap targets too, so the gesture is never the only
 * way to act (keyboard/click accessible).
 */
export interface SwipeAction {
  label: string;
  onAction: () => void;
  tone?: 'default' | 'positive' | 'destructive';
  icon?: ReactNode;
}

const TONE_BG: Record<NonNullable<SwipeAction['tone']>, string> = {
  default: 'bg-slate-600',
  positive: 'bg-emerald-600',
  destructive: 'bg-red-600',
};

export function SwipeRow({
  children,
  leftAction,
  rightAction,
  autoThreshold = 120,
  className,
}: {
  children: ReactNode;
  /** Revealed by dragging right (content moves right). */
  leftAction?: SwipeAction;
  /** Revealed by dragging left (content moves left). */
  rightAction?: SwipeAction;
  autoThreshold?: number;
  className?: string;
}) {
  const x = useMotionValue(0);

  const fire = (action: SwipeAction) => {
    haptic('light');
    action.onAction();
  };

  const settle = () => animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const offset = info.offset.x;
    if (leftAction && offset >= autoThreshold) fire(leftAction);
    else if (rightAction && offset <= -autoThreshold) fire(rightAction);
    settle();
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {leftAction && (
        <button
          type="button"
          onClick={() => fire(leftAction)}
          className={cn(
            'absolute inset-y-0 left-0 flex items-center gap-1.5 px-5 text-sm font-semibold text-white',
            TONE_BG[leftAction.tone ?? 'default'],
          )}
        >
          {leftAction.icon}
          {leftAction.label}
        </button>
      )}
      {rightAction && (
        <button
          type="button"
          onClick={() => fire(rightAction)}
          className={cn(
            'absolute inset-y-0 right-0 flex items-center gap-1.5 px-5 text-sm font-semibold text-white',
            TONE_BG[rightAction.tone ?? 'default'],
          )}
        >
          {rightAction.icon}
          {rightAction.label}
        </button>
      )}
      <motion.div
        drag="x"
        dragConstraints={{ left: rightAction ? -160 : 0, right: leftAction ? 160 : 0 }}
        dragElastic={0.12}
        style={{ x }}
        onDragEnd={onDragEnd}
        className="relative z-10 bg-admin-surface"
      >
        {children}
      </motion.div>
    </div>
  );
}
