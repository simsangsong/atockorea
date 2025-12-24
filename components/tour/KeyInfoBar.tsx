'use client';

interface KeyInfo {
  icon: React.ReactNode;
  label: string;
  value: string;
}

interface KeyInfoBarProps {
  items: KeyInfo[];
}

export default function KeyInfoBar({ items }: KeyInfoBarProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-br from-white via-blue-50/80 to-indigo-50/80 rounded-full border-2 border-blue-200/60 shadow-md hover:shadow-lg hover:border-blue-400 hover:scale-105 transition-all backdrop-blur-sm"
          >
            <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 text-blue-600">
              {item.icon}
            </div>
            <span className="text-xs sm:text-sm font-semibold text-gray-800 whitespace-nowrap">
              {item.value || item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

