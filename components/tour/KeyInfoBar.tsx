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
      <div className="flex gap-2 flex-nowrap sm:flex-wrap">
        {items.map((item, index) => (
          <div
            key={index}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 text-gray-700 flex-shrink-0"
          >
            <span className="flex-shrink-0 w-4 h-4 text-gray-500 [&>svg]:w-4 [&>svg]:h-4">
              {item.icon}
            </span>
            <span className="text-xs font-medium whitespace-nowrap">
              {item.value || item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
