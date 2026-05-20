'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  LIST_EYEBROW_CLS,
  LIST_ACCENT_LINE_CLS,
  LIST_DISPLAY_ACCENT_CLS,
} from '@/lib/tours-list-tokens';
import type { EditorialInsertContent } from '@/lib/tours-list-editorial-inserts';

/**
 * Editorial insert (Phase 4.4) — a col-span-full curation moment dropped into
 * the grid every 6th slot (B8). Magazine editorial signal: amber eyebrow + thin
 * gold rule + upright-serif headline (italic banned, B18). The amber here is the
 * hero/footer magazine signature family — distinct from the site-native slate of
 * the filter controls (B32).
 */
interface EditorialInsertProps {
  content: EditorialInsertContent;
  /** Resolver: i18n key → localized string. */
  t: (key: string) => string;
}

export function EditorialInsert({ content, t }: EditorialInsertProps) {
  const reduce = useReducedMotion() === true;
  return (
    <motion.div
      className="col-span-full"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50/70 via-white to-white px-5 py-6 sm:px-8 sm:py-7">
        {/* Thin gold rule, top-left */}
        <span className={`mb-3 block h-px w-10 ${LIST_ACCENT_LINE_CLS}`} aria-hidden />
        <span className={LIST_EYEBROW_CLS}>{t(content.eyebrowKey)}</span>
        <p
          className={`mt-1.5 max-w-2xl text-[18px] leading-[1.3] text-stone-900 sm:text-[21px] ${LIST_DISPLAY_ACCENT_CLS}`}
        >
          {t(content.titleKey)}
        </p>

        {content.ctaKey && content.ctaHref ? (
          <Link
            href={content.ctaHref}
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-800 underline-offset-4 transition hover:text-amber-900 hover:underline"
          >
            {t(content.ctaKey)}
            <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </motion.div>
  );
}
