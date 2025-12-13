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
      <div className="flex gap-4 min-w-max sm:min-w-0 sm:grid sm:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-sm border border-gray-200/50 min-w-[200px] sm:min-w-0 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-blue-600">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

