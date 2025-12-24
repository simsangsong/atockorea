'use client';

import { useState } from 'react';

interface QuickFactsProps {
  facts: string[];
}

export default function QuickFacts({ facts }: QuickFactsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!facts || facts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {facts.map((fact, index) => {
        const isExpanded = expandedIndex === index;
        // Split fact into title and description if it contains ":"
        const parts = fact.split(':');
        const title = parts[0]?.trim() || fact;
        const description = parts.length > 1 ? parts.slice(1).join(':').trim() : null;

        return (
          <div
            key={index}
            className="rounded-xl bg-gradient-to-br from-white via-white to-blue-50/30 border-2 border-gray-300 shadow-lg hover:shadow-xl hover:border-blue-400 transition-all overflow-hidden backdrop-blur-sm"
          >
            <button
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-semibold text-gray-900">{title}</p>
                  {description && !isExpanded && (
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-1">{description}</p>
                  )}
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                  isExpanded ? 'transform rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isExpanded && description && (
              <div className="px-5 pb-4 pt-0">
                <div className="pl-11">
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{description}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

