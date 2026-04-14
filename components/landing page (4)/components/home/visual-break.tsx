'use client'

import { useEffect, useRef } from 'react'

export function VisualBreak() {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.classList.add('visible')
    }

    // Intersection Observer for video autoplay control
    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current
        if (!video) return

        if (entry.isIntersecting) {
          // Store the play promise so we can wait for it before pausing
          playPromiseRef.current = video.play()
          playPromiseRef.current.catch(() => {
            // Silently handle any play errors
          })
        } else {
          // Wait for any pending play() to complete before pausing
          if (playPromiseRef.current) {
            playPromiseRef.current.then(() => {
              video.pause()
            }).catch(() => {
              // If play failed, still try to pause
              video.pause()
            })
          } else {
            video.pause()
          }
        }
      },
      { threshold: 0.5 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current)
      }
    }
  }, [])

  return (
    <section 
      ref={containerRef}
      className="relative w-full overflow-hidden bg-slate-900 scroll-animate"
    >
      {/* Visual separator above */}
      <div className="h-12 md:h-16 bg-gradient-to-b from-white to-slate-50" />
      
      {/* Video container */}
      <div className="relative h-[26vh] md:h-[32vh] lg:h-[38vh] mx-4 md:mx-8 lg:mx-12 rounded-2xl overflow-hidden">
        {/* Scenic background video - Editorial cinematic feel */}
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            poster="/images/jeju-seasonal.jpg"
            className="absolute inset-0 w-full h-full object-cover scale-105"
            loading="lazy"
          >
            <source src="https://videos.pexels.com/video-files/3629519/3629519-uhd_2560_1440_30fps.mp4" type="video/mp4" />
          </video>
          
          {/* Cinematic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/30 to-slate-950/40" />
          
          {/* Subtle vignette for depth */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.25) 100%)'
          }} />
        </div>

        {/* Minimal editorial content - purely emotional, no hard sell */}
        <div className="absolute inset-0 flex items-center justify-center px-6 md:px-8 z-10">
          <div className="text-center max-w-lg">
            {/* Aspirational headline only - no CTA needed here */}
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight tracking-tight" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
              Discover Korea at your own pace
            </h2>

            {/* Brief emotional bridge */}
            <p className="text-sm md:text-base text-white/90 font-medium leading-relaxed max-w-md mx-auto" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
              Scenic coastlines, hidden villages, and unforgettable moments — all matched to the way you travel.
            </p>
          </div>
        </div>
      </div>
      
      {/* Visual separator below */}
      <div className="h-12 md:h-16 bg-gradient-to-t from-white to-slate-50" />
    </section>
  )
}
