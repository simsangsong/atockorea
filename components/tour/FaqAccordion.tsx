'use client';

import { useState } from 'react';
import type { Faq } from '@/types/tour';

interface FaqAccordionProps {
  items: Faq[];
  className?: string;
}

export default function FaqAccordion({ items, className = '' }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!items?.length) return null;

  return (
    <div className={`divide-y divide-gray-100 ${className}`}>
      {items.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className="py-3 first:pt-0">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full text-left list-none flex items-center justify-between gap-3 py-1 rounded-lg hover:bg-gray-50/80 transition-colors -mx-1 px-1"
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${idx}`}
              id={`faq-question-${idx}`}
            >
              <span className="text-sm font-medium text-gray-900">{faq.question}</span>
              <svg
                className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              id={`faq-answer-${idx}`}
              role="region"
              aria-labelledby={`faq-question-${idx}`}
              className={`overflow-hidden transition-all duration-200 ease-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <p className="mt-2 text-sm text-gray-600 leading-relaxed pl-0">{faq.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
