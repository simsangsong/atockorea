"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  HOME_V2_SHARED_COASTAL_VIDEO_MP4,
  HOME_V2_VISUAL_BREAK_POSTER,
} from "@/lib/home/home-v2-visual-media";
import { useTranslations } from "@/lib/i18n";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

export function VisualBreak() {
  const t = useTranslations("home");
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const isMdOrUp = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.classList.add("visible");
    }
  }, []);

  useEffect(() => {
    if (!isMdOrUp) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current;
        if (!video) return;

        if (entry.isIntersecting) {
          playPromiseRef.current = video.play();
          playPromiseRef.current.catch(() => {});
        } else {
          if (playPromiseRef.current) {
            playPromiseRef.current
              .then(() => {
                video.pause();
              })
              .catch(() => {
                video.pause();
              });
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.5 },
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [isMdOrUp]);

  return (
    <section ref={containerRef} className="relative w-full overflow-hidden bg-slate-900 scroll-animate">
      <div className="h-12 md:h-16 bg-gradient-to-b from-white to-slate-50" />

      <div className="relative mx-4 h-[26vh] overflow-hidden rounded-home-card shadow-home-offer-base ring-1 ring-white/15 md:mx-8 md:h-[32vh] lg:mx-12 lg:h-[38vh]">
        <div className="absolute inset-0">
          <div className="relative h-full w-full">
            <Image
              src={HOME_V2_VISUAL_BREAK_POSTER}
              alt=""
              fill
              className={cn("object-cover scale-105", isMdOrUp && "hidden")}
              sizes="(max-width: 768px) 100vw, 80vw"
              priority={false}
              aria-hidden
            />

            {isMdOrUp ? (
              <video
                ref={videoRef}
                aria-hidden
                muted
                loop
                playsInline
                preload="none"
                poster={HOME_V2_VISUAL_BREAK_POSTER}
                className="absolute inset-0 z-[1] h-full w-full object-cover scale-105"
              >
                <source src={HOME_V2_SHARED_COASTAL_VIDEO_MP4} type="video/mp4" />
              </video>
            ) : null}
          </div>

          <div className="absolute inset-0 z-[2] bg-gradient-to-t from-slate-950/70 via-slate-900/30 to-slate-950/40" />

          <div
            className="absolute inset-0 z-[2]"
            style={{
              backgroundImage: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.25) 100%)",
            }}
          />
        </div>

        <div className="absolute inset-0 flex items-center justify-center px-6 md:px-8 z-10">
          <div className="text-center max-w-lg">
            <h2
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight tracking-tight"
              style={{
                textShadow: "0 2px 28px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.45)",
              }}
            >
              {t("premium.v2.visualBreak.headline")}
            </h2>

            <p
              className="mx-auto max-w-md text-sm font-medium leading-relaxed text-white/90 md:text-base"
              style={{
                textShadow: "0 2px 18px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.35)",
              }}
            >
              {t("premium.v2.visualBreak.subhead")}
            </p>
          </div>
        </div>
      </div>

      <div className="h-12 md:h-16 bg-gradient-to-t from-white to-slate-50" />
    </section>
  );
}
