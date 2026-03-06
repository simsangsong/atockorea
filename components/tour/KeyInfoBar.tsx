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
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50/80 border border-slate-200/50 text-slate-700 flex-shrink-0 shadow-sm"
          >
            <span className="flex-shrink-0 w-4 h-4 text-slate-500 [&>svg]:w-4 [&>svg]:h-4">
              {item.icon}
            </span>
            <span className="text-xs font-medium whitespace-nowrap tracking-tight">
              {item.value || item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
