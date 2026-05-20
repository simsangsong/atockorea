'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { LIST_EYEBROW_CLS, LIST_ACCENT_LINE_CLS, LIST_DISPLAY_ACCENT_CLS } from '@/lib/tours-list-tokens';

/**
 * Conversion rescue band (Phase 4.7) — shown ONLY after the reader has browsed
 * enough (visibleCount >= 28, B9), never from the start (would damage catalogue
 * trust). For someone who has seen plenty but not decided, it offers the builder
 * branch. Amber magazine-signature family (consistent with hero/footer).
 */
interface ConversionRescueBandProps {
  title: string;
  body: string;
  cta: string;
  href: string;
  eyebrow: string;
}

export function ConversionRescueBand({ title, body, cta, href, eyebrow }: ConversionRescueBandProps) {
  const reduce = useReducedMotion() === true;
  return (
    <motion.div
      className="mx-auto my-8 w-full max-w-[1320px] px-3 sm:px-4"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative overflow-hidden rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-50 via-amber-50/40 to-white px-6 py-8 text-center sm:px-10 sm:py-10">
        <span className={`mx-auto mb-3 block h-px w-12 ${LIST_ACCENT_LINE_CLS}`} aria-hidden />
        <span className={LIST_EYEBROW_CLS}>{eyebrow}</span>
        <h2 className={`mx-auto mt-2 max-w-xl text-[22px] leading-[1.25] text-stone-900 sm:text-[26px] ${LIST_DISPLAY_ACCENT_CLS}`}>
          {title}
        </h2>
        <p className="mx-auto mt-2.5 max-w-md text-[13.5px] leading-[1.6] text-stone-600">{body}</p>
        <Link
          href={href}
          className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-[14px] font-bold text-white shadow-[0_10px_28px_-12px_rgba(15,23,42,0.5)] transition hover:bg-slate-800"
        >
          {cta}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </motion.div>
  );
}
