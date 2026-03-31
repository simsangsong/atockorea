"use client";

import { Landmark, MapPinned, UsersRound, type LucideIcon } from "lucide-react";
import { useSiteCopy } from "@/src/lib/use-site-copy";
import { HOME_OUTER_SHELL_SURFACE } from "@/lib/mypage-ui";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  mapPinned: MapPinned,
  usersRound: UsersRound,
  landmark: Landmark,
};

export default function HomeBookWithConfidence() {
  const { homepageBookWithConfidence } = useSiteCopy();
  const { eyebrow, title, cards } = homepageBookWithConfidence;

  return (
    <section
      className={cn("home-section-y home-section-divide w-full px-4 sm:px-6 lg:px-8")}
      aria-labelledby="home-book-with-confidence-heading"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div
          className={cn(
            HOME_OUTER_SHELL_SURFACE,
            "px-6 py-10 sm:px-8 sm:py-12 md:px-10 md:py-14",
          )}
        >
          <p className="home-type-eyebrow text-center">{eyebrow}</p>
          <h2
            id="home-book-with-confidence-heading"
            className="home-type-display mt-2.5 text-center text-[1.85rem] leading-[1.05] sm:text-[2.35rem] sm:leading-[0.98]"
          >
            {title}
          </h2>

          <div className="mt-9 flex flex-col gap-5 sm:mt-10 sm:gap-6">
            {cards.map((card, index) => {
              const Icon = ICONS[card.icon] ?? MapPinned;
              const tagline = card.tagline?.trim();
              const footerNote = card.footerNote?.trim();
              return (
                <article
                  key={`${card.headline}-${index}`}
                  className={cn(
                    "home-neutral-editorial p-8 sm:p-9 md:p-10",
                    "antialiased [font-synthesis:none]",
                  )}
                >
                  <div className="flex flex-col gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        "bg-gradient-to-b from-sky-50 to-sky-100/70 text-sky-700",
                        "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-sky-200/75",
                      )}
                      aria-hidden
                    >
                      <Icon className="h-[1.15rem] w-[1.15rem] stroke-[2]" />
                    </div>
                    <div>
                      <h3 className="home-support-title text-[15px] sm:text-base">{card.headline}</h3>
                      {tagline ? (
                        <p className="mt-1.5 text-[12px] font-semibold tracking-[-0.01em] text-slate-600">{tagline}</p>
                      ) : null}
                    </div>
                    <p className="home-type-body text-[12px] sm:text-[13px]">{card.body}</p>
                    <div
                      className={cn(
                        "mt-2 border-t border-slate-200/60 pt-5",
                        "text-[11px] font-medium leading-relaxed tracking-tight text-slate-500",
                      )}
                    >
                      <p>{card.footer}</p>
                      {footerNote ? <p className="mt-1 text-slate-400">{footerNote}</p> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
