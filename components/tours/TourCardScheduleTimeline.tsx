'use client';

export interface TourCardTimelineStop {
  time?: string;
  title: string;
}

type Density = 'comfortable' | 'compact';

export default function TourCardScheduleTimeline({
  stops,
  maxVisible,
  title,
  density = 'comfortable',
}: {
  stops: TourCardTimelineStop[];
  maxVisible?: number;
  title: string;
  density?: Density;
}) {
  if (stops.length === 0) return null;

  const cap = maxVisible ?? (density === 'compact' ? 4 : 8);
  const visible = stops.slice(0, cap);
  const more = stops.length - visible.length;

  const isCompact = density === 'compact';

  return (
    <div
      className={
        isCompact
          ? 'flex flex-col min-h-0'
          : 'flex flex-col h-full min-h-[120px] max-h-[220px] md:max-h-[280px]'
      }
    >
      <p
        className={
          isCompact
            ? 'text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1.5'
            : 'text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2.5 shrink-0'
        }
      >
        {title}
      </p>

      <ul
        className={
          isCompact
            ? 'space-y-1.5 min-w-0'
            : 'space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1 min-w-0'
        }
        aria-label={title}
      >
        {visible.map((stop: TourCardTimelineStop, i: number) => {
          const hasNext = i < visible.length - 1;
          return (
            <li key={`${stop.title}-${i}`} className="flex gap-2 min-w-0 items-stretch">
              <div className="flex flex-col items-center shrink-0 w-3.5">
                <span
                  className={
                    isCompact
                      ? 'mt-0.5 w-2 h-2 rounded-full bg-white border-2 border-indigo-500 shadow-sm'
                      : 'mt-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-500 shadow-sm ring-2 ring-indigo-50/80'
                  }
                  aria-hidden
                />
                {hasNext ? (
                  <span
                    className={
                      isCompact
                        ? 'w-px flex-1 min-h-[6px] mt-0.5 bg-gradient-to-b from-indigo-200 to-indigo-50'
                        : 'w-px flex-1 min-h-[8px] mt-1 bg-gradient-to-b from-indigo-300/80 to-indigo-100/60'
                    }
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                {stop.time?.trim() ? (
                  <span
                    className={
                      isCompact
                        ? 'block text-[9px] font-semibold text-indigo-600/90 tabular-nums leading-none mb-0.5'
                        : 'block text-[10px] font-semibold text-indigo-600 tabular-nums leading-none mb-0.5'
                    }
                  >
                    {stop.time.trim()}
                  </span>
                ) : null}
                <span
                  className={
                    isCompact
                      ? 'block text-[10px] font-medium text-gray-800 leading-snug line-clamp-2'
                      : 'block text-[11px] font-medium text-gray-800 leading-snug line-clamp-2'
                  }
                >
                  {stop.title}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {more > 0 ? (
        <p
          className={
            isCompact
              ? 'text-[9px] text-gray-400 mt-1'
              : 'text-[10px] text-gray-400 mt-2 shrink-0'
          }
        >
          +{more} more
        </p>
      ) : null}
    </div>
  );
}
