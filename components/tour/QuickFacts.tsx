'use client';

interface QuickFactsProps {
  facts: string[];
}

export default function QuickFacts({ facts }: QuickFactsProps) {
  if (!facts || facts.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 p-6 fade-in">
      <h2 className="text-xl font-bold text-gray-900 mb-4">What to Expect</h2>
      <ul className="space-y-3">
        {facts.map((fact, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700 leading-relaxed">{fact}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

