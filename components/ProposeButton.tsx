'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RobotMascot } from './RobotMascot';

const CYAN = '#00FFFF';
const PURPLE = '#BF5AF2';

/** Play a short glitch-style sound using Web Audio API (no external file). */
function playGlitchSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
  } catch {
    // ignore if AudioContext not allowed (e.g. autoplay policy)
  }
}

export interface ProposeButtonProps {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

/** Same overlay + glitch + circuit + scanline; use as wrapper for a link/card so click triggers transition then navigation. */
export function ProposeTransitionLink({
  href = '/custom-join-tour',
  children,
  className,
}: {
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const router = useRouter();
  const playedGlitch = useRef(false);

  const trigger = useCallback(() => {
    setIsTransitioning(true);
    if (!playedGlitch.current) {
      playedGlitch.current = true;
      playGlitchSound();
    }
    setTimeout(() => router.push(href), 1500);
  }, [href, router]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      trigger();
    },
    [trigger]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger();
      }
    },
    [trigger]
  );

  return (
    <>
      <div role="button" tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown} className={className}>
        {children}
      </div>
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="transition-overlay fixed inset-0 z-[9999] bg-[#050B18] flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="transition-circuit-bg absolute inset-0 opacity-40" aria-hidden />
            <div className="transition-scanline absolute inset-0 pointer-events-none" aria-hidden />
            <motion.div
              initial={{ y: 20, scale: 0.8 }}
              animate={{
                y: [0, -20, 0],
                scale: 1,
                filter: [
                  `drop-shadow(0 0 5px ${CYAN})`,
                  `drop-shadow(0 0 20px ${PURPLE})`,
                  `drop-shadow(0 0 5px ${CYAN})`,
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-32 h-32 relative z-10"
            >
              <RobotMascot className="w-full h-full" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="mt-6 text-cyan-400 font-mono tracking-tighter text-sm relative z-10"
            >
              AI ANALYZING YOUR PREFERENCES...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function ProposeButton({ href = '/custom-join-tour', children, className }: ProposeButtonProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const router = useRouter();
  const playedGlitch = useRef(false);

  const handleStartTour = useCallback(() => {
    setIsTransitioning(true);
    if (!playedGlitch.current) {
      playedGlitch.current = true;
      playGlitchSound();
    }
    setTimeout(() => {
      router.push(href);
    }, 1500);
  }, [href, router]);

  return (
    <>
      <button
        type="button"
        onClick={handleStartTour}
        className={
          className ??
          'relative group px-8 py-4 bg-transparent border-2 border-cyan-500 text-cyan-400 font-bold rounded-full overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(0,255,255,0.6)]'
        }
      >
        <span className="relative z-10 uppercase tracking-widest">
          {children ?? 'Propose a Tour'}
        </span>
        <div className="absolute inset-0 bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors" />
      </button>

      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="transition-overlay fixed inset-0 z-[9999] bg-[#050B18] flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Moving circuit board grid background */}
            <div className="transition-circuit-bg absolute inset-0 opacity-40" aria-hidden />

            {/* Scanline overlay */}
            <div
              className="transition-scanline absolute inset-0 pointer-events-none"
              aria-hidden
            />

            <motion.div
              initial={{ y: 20, scale: 0.8 }}
              animate={{
                y: [0, -20, 0],
                scale: 1,
                filter: [
                  `drop-shadow(0 0 5px ${CYAN})`,
                  `drop-shadow(0 0 20px ${PURPLE})`,
                  `drop-shadow(0 0 5px ${CYAN})`,
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-32 h-32 relative z-10"
            >
              <RobotMascot className="w-full h-full" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="mt-6 text-cyan-400 font-mono tracking-tighter text-sm relative z-10"
            >
              AI ANALYZING YOUR PREFERENCES...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
