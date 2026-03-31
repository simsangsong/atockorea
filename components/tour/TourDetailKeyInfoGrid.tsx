import type { ReactNode } from 'react';

export type TourDetailKeyInfoItem = {
  icon: ReactNode;
  label: string;
  value: string;
};

type TourDetailKeyInfoGridProps = {
  title: string;
  items: TourDetailKeyInfoItem[];
};

/**
 * “At a glance” grid shell: 3-column compact cells on mobile, horizontal chips on md+.
 */
export function TourDetailKeyInfoGrid({ title, items }: TourDetailKeyInfoGridProps) {
  if (items.length === 0) return null;

  const highlightFirst = items.length >= 2;

  return (
    <section className="px-3 py-4 font-sans lg:px-5" aria-label={title}>
      <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h2>

      <div className="grid grid-cols-3 gap-2 md:hidden">
        {items.map((item, index) => {
          const highlight = highlightFirst && index === 0;
          return (
            <div
              key={`${item.label}-${index}`}
              className={`flex flex-col items-center justify-center rounded-xl px-2 py-3 text-center ${
                highlight ? 'bg-neutral-900 text-white' : 'border border-neutral-100 bg-neutral-50'
              }`}
            >
              <div
                className={`mb-1.5 [&_svg]:h-4 [&_svg]:w-4 ${
                  highlight ? 'text-white/80' : 'text-neutral-400'
                }`}
              >
                {item.icon}
              </div>
              <span
                className={`text-[13px] font-semibold ${highlight ? 'text-white' : 'text-neutral-900'}`}
              >
                {item.value}
              </span>
              <span
                className={`mt-0.5 text-[10px] ${highlight ? 'text-white/60' : 'text-neutral-500'}`}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className={'scrollbar-hide hidden gap-3 overflow-x-auto pb-1 md:flex'}>
        {items.map((item, index) => {
          const highlight = highlightFirst && index === 0;
          return (
            <div
              key={`${item.label}-${index}-md`}
              className={`flex flex-shrink-0 items-center gap-3 rounded-xl px-4 py-3 ${
                highlight ? 'bg-neutral-900 text-white' : 'border border-neutral-100 bg-white'
              }`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4 ${
                  highlight ? 'bg-white/10 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {item.icon}
              </div>
              <div>
                <span
                  className={`block text-sm font-semibold ${highlight ? 'text-white' : 'text-neutral-900'}`}
                >
                  {item.value}
                </span>
                <span className={`text-[11px] ${highlight ? 'text-white/60' : 'text-neutral-500'}`}>
                  {item.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
