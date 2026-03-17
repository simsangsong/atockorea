'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { COPY } from '@/src/design/copy';

export interface BuilderLoadingOverlayProps {
  /** When true, overlay is visible. */
  visible: boolean;
  /** Human pickup area label when known (enables area-specific stage 1 copy). When null, use generic copy only. */
  areaLabel: string | null;
  /** When true, show "Your trip is ready" (success state before redirect). */
  success: boolean;
}

const STAGE_INTERVAL_MS = 1500;

/**
 * Builder generate loading overlay. Max 3 stages + end.
 * Copy from COPY.builderLoading only; no real-time matching claims.
 * If areaLabel is set, stage 1 may show area-specific copy; otherwise generic only.
 */
export default function BuilderLoadingOverlay({ visible, areaLabel, success }: BuilderLoadingOverlayProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!visible || success) return;
    const t = setInterval(() => {
      setStage((s) => (s < 2 ? s + 1 : s));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [visible, success]);

  useEffect(() => {
    if (!visible) setStage(0);
  }, [visible]);

  if (!visible) return null;

  const copy = COPY.builderLoading;
  const stage1Text =
    areaLabel != null && areaLabel !== ''
      ? copy.stage1WithArea.replace('[Area]', areaLabel)
      : copy.stage1Generic;
  const stageTexts = [stage1Text, copy.stage2, copy.stage3];
  const currentText = success ? copy.end : stageTexts[stage];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] grid place-items-center overflow-hidden p-4 min-h-[100dvh] h-[100dvh] bg-slate-50"
        aria-live="polite"
        aria-busy={!success}
      >
        <div className="flex flex-col items-center justify-center max-w-sm text-center">
          {/* Simple assembly visual: route/pickup feel without fake matching */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-20 h-20 rounded-2xl bg-slate-200/80 flex items-center justify-center mb-6"
          >
            <svg
              viewBox="0 0 48 48"
              className="w-10 h-10 text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M8 24h8l4-8 4 16 4-12 8 4" />
              <circle cx="24" cy="24" r="3" />
            </svg>
          </motion.div>
          <motion.p
            key={success ? 'end' : stage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-slate-700 font-medium text-sm"
          >
            {currentText}
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
