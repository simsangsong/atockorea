'use client';

import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export default function CollapsibleSection({ 
  title, 
  children, 
  defaultOpen = false,
  className = ''
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-xl bg-white border-2 border-gray-200 shadow-md hover:shadow-lg overflow-hidden transition-all ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
      >
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <svg
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}




