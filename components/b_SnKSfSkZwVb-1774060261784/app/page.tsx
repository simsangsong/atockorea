"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Users,
  Sparkles,
  Bus,
  X,
  Calendar as CalendarIcon,
  MapPin,
  Search,
  Settings,
  ChevronRight,
  LayoutDashboard,
  History,
  Heart,
  ShoppingCart,
  User,
  Star,
} from "lucide-react";

const glassStyle =
  "bg-white/60 backdrop-blur-3xl border border-white/30 shadow-2xl rounded-[2.5rem]";

const itemFadeIn = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

type ViewType = "landing" | "planner" | "tours" | "mypage" | "cart";

type NavIconProps = {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
};

type ProductCardProps = {
  badge: string;
  title: string;
  description: string;
  bullets: string[];
  buttonLabel: string;
  image: string;
  buttonAction: () => void;
  compact?: boolean;
};

export default function AtocIntegratedApp() {
  const [view, setView] = useState<ViewType>("landing");
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>("");
  const [selectedDetail, setSelectedDetail] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) {
      const texts = [
        "AI is analyzing your travel style...",
        "Searching for Jeju's hidden gems...",
        "Crafting your bespoke 1-day itinerary...",
      ];
      let i = 0;
      setLoadingText(texts[0]);
      const interval = setInterval(() => {
        i = (i + 1) % texts.length;
        setLoadingText(texts[i]);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const handleGenerate = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep(2);
    }, 4500);
  };

  const renderView = () => {
    switch (view) {
      case "landing":
        return <LandingView />;
      case "planner":
        return <PlannerView />;
      case "tours":
        return <ToursView />;
      case "mypage":
        return <MyPageView />;
      default:
        return <LandingView />;
    }
  };

  const LandingView = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-3 pt-4 pb-32"
    >
      <div className="mx-auto max-w-md space-y-8">
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={itemFadeIn}
          className="rounded-[2rem] border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-full bg-white px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-500 shadow-sm">
              ATOCKOREA
            </div>
            <button
              onClick={() => setView("planner")}
              className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold text-white"
            >
              PLAN MY TRIP
            </button>
          </div>

          <div className="px-2 pt-2 text-center">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600">
              AI-planned Korea routes
            </p>
            <h1 className="text-[2.15rem] font-black leading-[0.95] tracking-tight text-slate-900">
              Bus tour price,
              <br />
              Private tour
              <br />
              comfort
            </h1>
            <p className="mx-auto mt-3 text-[14px] font-semibold text-slate-700">
              1-Click Itinerary Generation
            </p>
            <p className="mx-auto mt-3 max-w-[19rem] text-[13px] leading-5 text-slate-600">
              Build a smoother Korea travel day with AI-planned routing,
              clearer tour formats, and locally executed pickup-based options.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {["Jeju", "Busan", "Seoul", "Small Group", "Private"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={itemFadeIn}
          className="overflow-hidden rounded-[1.75rem] shadow-xl"
        >
          <div className="relative min-h-[16rem]">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-800/20" />
            <div className="relative z-10 flex min-h-[16rem] flex-col justify-end p-5 text-white">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200">
                Korea feature route
              </p>
              <h2 className="max-w-[16rem] text-[1.7rem] font-black leading-[1.05]">
                Smarter Korea routes with local execution
              </h2>
              <p className="mt-3 max-w-[17rem] text-[12px] leading-5 text-slate-200">
                AI helps shape the route first, then the day is carried out in a
                more realistic Korea-ready format.
              </p>
              <button
                onClick={() => setView("planner")}
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-[12px] font-bold text-slate-900 shadow-lg"
              >
                Plan My Korea Trip
              </button>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={itemFadeIn}
          className="rounded-[1.5rem] border border-white/70 bg-white/70 px-4 py-4 shadow-sm backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                AI planner
              </p>
              <h3 className="mt-1 text-[1rem] font-black text-slate-900">
                Plan your Korea day trip now
              </h3>
            </div>
            <button
              onClick={() => setView("planner")}
              className="shrink-0 rounded-full bg-slate-900 px-4 py-2.5 text-[11px] font-semibold text-white"
            >
              Start
            </button>
          </div>
        </motion.section>

        <motion.section
          id="compare"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={itemFadeIn}
          className="-mx-3 py-12 relative overflow-visible"
          style={{
            background: "linear-gradient(180deg, #d8e2eb 0%, #c4d1de 50%, #d8e2eb 100%)",
          }}
        >
          {/* Subtle light overlay */}
          <div 
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.5) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.35) 0%, transparent 45%)",
            }}
          />
          
          <div className="text-center mb-8 px-4 relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-2">
              Compare travel styles
            </p>
            <h2 className="text-[1.6rem] font-black leading-[1.1] tracking-tight text-slate-800">
              Find the Korea travel
              <br />
              style that fits you
            </h2>
            <p className="mx-auto mt-3 max-w-[18rem] text-[12px] leading-relaxed text-slate-500">
              Bus routes, AI-planned small-group, or fully private custom travel.
            </p>
          </div>

          {/* 2-up card container with proper overflow for badges */}
          <div 
            className="flex gap-3 px-4 pt-4 pb-2 overflow-x-auto snap-x snap-mandatory relative z-10"
            style={{ 
              scrollbarWidth: "none", 
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch"
            }}
          >
            {/* Classic Bus Tour Card */}
            <div 
              className="flex-shrink-0 w-[46%] min-w-[155px] snap-start rounded-[1.5rem] relative"
              style={{
                background: "linear-gradient(155deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))",
                boxShadow: "0 12px 40px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.45)",
              }}
            >
              <div 
                className="h-full rounded-[1.5rem] px-4 py-5 backdrop-blur-2xl flex flex-col"
                style={{
                  background: "linear-gradient(170deg, rgba(255,255,255,0.3) 0%, rgba(248,250,252,0.15) 100%)",
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1">
                  Classic
                </p>
                <h3 className="text-[1.1rem] font-black text-slate-700 leading-tight mb-2">
                  Bus Tour
                </h3>
                <p className="text-[11px] text-slate-500 leading-snug mb-5">
                  Fixed-route sightseeing at lowest cost
                </p>

                <div className="flex-1 space-y-0">
                  {[
                    { label: "Price", value: "Lowest" },
                    { label: "Group", value: "Large shared" },
                    { label: "Route", value: "Fixed" },
                    { label: "Pickup", value: "Meeting point" },
                    { label: "Best for", value: "Budget" },
                  ].map((row, i) => (
                    <div 
                      key={row.label} 
                      className={`flex justify-between items-center py-2 ${i !== 4 ? "border-b border-white/25" : ""}`}
                    >
                      <span className="text-[10px] text-slate-500">{row.label}</span>
                      <span className="text-[11px] text-slate-600 font-semibold">{row.value}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setView("tours")}
                  className="mt-5 w-full py-2.5 rounded-xl text-[11px] font-bold text-slate-600 transition-all hover:bg-white/40"
                  style={{
                    background: "rgba(255,255,255,0.3)",
                    border: "1px solid rgba(255,255,255,0.5)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  Explore
                </button>
              </div>
            </div>

            {/* AI Small Group Card - Featured */}
            <div 
              className="flex-shrink-0 w-[46%] min-w-[155px] snap-start rounded-[1.5rem] relative"
              style={{
                background: "linear-gradient(155deg, rgba(147,197,253,0.35), rgba(96,165,250,0.2))",
                boxShadow: "0 0 35px rgba(59,130,246,0.15), 0 12px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(255,255,255,0.2)",
                border: "1px solid rgba(147,197,253,0.5)",
              }}
            >
              {/* Ambient glow */}
              <div 
                className="absolute -inset-2 rounded-[2rem] opacity-50 blur-2xl pointer-events-none -z-10"
                style={{
                  background: "radial-gradient(circle, rgba(96,165,250,0.35) 0%, transparent 65%)",
                }}
              />
              
              {/* Badge */}
              <span 
                className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 text-[8px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide whitespace-nowrap"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  color: "#2563eb",
                  boxShadow: "0 3px 12px rgba(0,0,0,0.12)",
                  border: "1px solid rgba(147,197,253,0.6)",
                }}
              >
                Best Balance
              </span>
              
              <div 
                className="h-full rounded-[1.5rem] px-4 py-5 backdrop-blur-2xl flex flex-col"
                style={{
                  background: "linear-gradient(170deg, rgba(255,255,255,0.38) 0%, rgba(239,246,255,0.22) 100%)",
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-blue-600 mb-1 mt-3">
                  AI-Powered
                </p>
                <h3 className="text-[1.1rem] font-black text-slate-800 leading-tight mb-2">
                  Small Group
                </h3>
                <p className="text-[11px] text-slate-600 leading-snug mb-5">
                  Comfort + value with AI routes
                </p>

                <div className="flex-1 space-y-0">
                  {[
                    { label: "Price", value: "Mid-range" },
                    { label: "Group", value: "Small group" },
                    { label: "Route", value: "AI-planned" },
                    { label: "Pickup", value: "Hotel" },
                    { label: "Best for", value: "Smart value" },
                  ].map((row, i) => (
                    <div 
                      key={row.label} 
                      className={`flex justify-between items-center py-2 ${i !== 4 ? "border-b border-blue-200/35" : ""}`}
                    >
                      <span className="text-[10px] text-slate-500">{row.label}</span>
                      <span className="text-[11px] text-blue-700 font-bold">{row.value}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setView("planner")}
                  className="mt-5 w-full py-2.5 rounded-xl text-[11px] font-bold text-blue-700 transition-all hover:bg-white/50"
                  style={{
                    background: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(147,197,253,0.6)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  Plan Now
                </button>
              </div>
            </div>

            {/* AI Private Tour Card */}
            <div 
              className="flex-shrink-0 w-[46%] min-w-[155px] snap-start rounded-[1.5rem] relative"
              style={{
                background: "linear-gradient(155deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))",
                boxShadow: "0 12px 40px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.45)",
              }}
            >
              <div 
                className="h-full rounded-[1.5rem] px-4 py-5 backdrop-blur-2xl flex flex-col"
                style={{
                  background: "linear-gradient(170deg, rgba(255,255,255,0.3) 0%, rgba(248,250,252,0.15) 100%)",
                }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1">
                  Premium
                </p>
                <h3 className="text-[1.1rem] font-black text-slate-700 leading-tight mb-2">
                  Private Tour
                </h3>
                <p className="text-[11px] text-slate-500 leading-snug mb-5">
                  Maximum freedom, fully custom
                </p>

                <div className="flex-1 space-y-0">
                  {[
                    { label: "Price", value: "Premium" },
                    { label: "Group", value: "Private only" },
                    { label: "Route", value: "Custom" },
                    { label: "Pickup", value: "Hotel" },
                    { label: "Best for", value: "Full freedom" },
                  ].map((row, i) => (
                    <div 
                      key={row.label} 
                      className={`flex justify-between items-center py-2 ${i !== 4 ? "border-b border-white/25" : ""}`}
                    >
                      <span className="text-[10px] text-slate-500">{row.label}</span>
                      <span className="text-[11px] text-slate-600 font-semibold">{row.value}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setView("planner")}
                  className="mt-5 w-full py-2.5 rounded-xl text-[11px] font-bold text-slate-600 transition-all hover:bg-white/40"
                  style={{
                    background: "rgba(255,255,255,0.3)",
                    border: "1px solid rgba(255,255,255,0.5)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  Build Tour
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-500 mt-4 px-4 relative z-10">
            Swipe to compare
          </p>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={itemFadeIn}
          className="space-y-4"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
              Designed for Korea travel
            </p>
            <h2 className="mt-2 text-[2rem] font-black leading-none tracking-tight text-slate-900">
              How It Works
            </h2>
            <p className="mt-2 max-w-[20rem] text-[12px] leading-5 text-slate-600">
              A compact process that explains the product clearly before booking.
            </p>
          </div>

          {[
            {
              no: "01",
              title: "Tell us your Korea trip style",
              desc: "Pick the area and travel mood first.",
            },
            {
              no: "02",
              title: "Get an AI-built Korea route",
              desc: "A smarter day plan appears before checkout.",
            },
            {
              no: "03",
              title: "Choose your format",
              desc: "Join small group, go private, or compare with bus.",
            },
          ].map((item) => (
            <div
              key={item.no}
              className="rounded-[1.5rem] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-xl"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600">
                  {item.no}
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[12px] leading-5 text-slate-600">
                    {item.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </motion.section>

        <motion.section
          id="formats"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={itemFadeIn}
          className="space-y-4"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
              Tour formats
            </p>
            <h2 className="mt-2 text-[2rem] font-black leading-none tracking-tight text-slate-900">
              Choose the Korea format that fits
            </h2>
          </div>

          <ProductCard
            badge="AI-powered"
            title="AI Small Group"
            description="A premium Korea day format for travelers who want better routing and a more relaxed group feel."
            bullets={[
              "Smarter route planning",
              "Small-group comfort",
              "Better pacing than a standard bus",
              "From $89",
            ]}
            buttonLabel="Explore Small Group"
            image="https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?q=80&w=1200&auto=format&fit=crop"
            buttonAction={() => setView("planner")}
          />

          <ProductCard
            badge="Private"
            title="AI Private Tour"
            description="For travelers who want their own group, smoother pacing, and a premium Korea-ready day plan."
            bullets={[
              "Private vehicle feel",
              "More direct hotel pickup logic",
              "Best for families or private groups",
              "From $149",
            ]}
            buttonLabel="Explore Private Tour"
            image="https://images.unsplash.com/photo-1493558103817-58593965b282?q=80&w=1200&auto=format&fit=crop"
            buttonAction={() => setView("planner")}
          />

          <ProductCard
            badge="Sub-option"
            title="Classic Bus Tour"
            description="A lower-budget fixed route format for travelers who mainly want the simplest shared bus option."
            bullets={[
              "Lowest budget",
              "Fixed itinerary",
              "Meeting-point based",
              "From $49",
            ]}
            buttonLabel="Explore Bus Tour"
            image="https://images.unsplash.com/photo-1465447142348-e9952c393450?q=80&w=1200&auto=format&fit=crop"
            buttonAction={() => setView("tours")}
            compact
          />
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={itemFadeIn}
          className="space-y-4"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
              Korea destinations
            </p>
            <h2 className="mt-2 text-[2rem] font-black leading-none tracking-tight text-slate-900">
              Built around real Korea routes
            </h2>
          </div>

          {[
            {
              title: "Jeju",
              desc: "Volcanic coastlines, scenic stops, and better route flow.",
              image:
                "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop",
            },
            {
              title: "Busan",
              desc: "City views, harbor lines, and coastal urban energy.",
              image:
                "https://images.unsplash.com/photo-1526483360412-f4dbaf036963?q=80&w=1200&auto=format&fit=crop",
            },
            {
              title: "Seoul",
              desc: "Iconic city routes with denser itinerary coordination.",
              image:
                "https://images.unsplash.com/photo-1538485399081-7191377e8241?q=80&w=1200&auto=format&fit=crop",
            },
          ].map((routeCard) => (
            <div
              key={routeCard.title}
              className="relative overflow-hidden rounded-[1.5rem] shadow-lg"
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${routeCard.image}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/55 to-transparent" />
              <div className="relative z-10 p-4 pt-16 text-white">
                <h3 className="text-[1.15rem] font-black">{routeCard.title}</h3>
                <p className="mt-1 max-w-[15rem] text-[12px] leading-5 text-slate-200">
                  {routeCard.desc}
                </p>
              </div>
            </div>
          ))}
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={itemFadeIn}
          className="rounded-[2rem] bg-[#d9e5e5] px-4 py-6"
        >
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
            Reviews
          </p>
          <h2 className="mt-2 text-center text-[2rem] font-black leading-none tracking-tight text-slate-900">
            Loved by travelers
            <br />
            exploring <span className="text-blue-600">Korea</span>
          </h2>

          <div className="mt-5 space-y-3">
            {[
              {
                name: "Sarah M.",
                quote:
                  "Much better than a basic bus day. The route felt smarter and the pace felt easier.",
              },
              {
                name: "Daniel L.",
                quote:
                  "The Korea-specialized flow made the product clearer right away. Pickup logic also made more sense.",
              },
              {
                name: "Mina K.",
                quote:
                  "I liked that I could compare small group, private, and classic bus in one place without confusion.",
              },
            ].map((review) => (
              <div
                key={review.name}
                className="rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl"
              >
                <div className="mb-3 flex gap-1 text-amber-400">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} size={12} fill="currentColor" />
                  ))}
                </div>
                <p className="text-[12px] leading-5 text-slate-700">
                  {review.quote}
                </p>
                <p className="mt-3 text-[12px] font-bold text-slate-900">
                  {review.name}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={itemFadeIn}
          className="rounded-[2rem] border border-white/70 bg-white/80 px-5 py-6 shadow-sm backdrop-blur-xl"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
            Plan now
          </p>
          <h2 className="mt-2 text-[2rem] font-black leading-none tracking-tight text-slate-900">
            Ready to plan your Korea day trip?
          </h2>
          <p className="mt-3 max-w-[17rem] text-[12px] leading-5 text-slate-600">
            Start with the AI planner, then choose the Korea format that fits
            your day best.
          </p>

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setView("planner")}
              className="flex-1 rounded-full bg-slate-900 px-4 py-3 text-[12px] font-bold text-white"
            >
              Plan My Trip
            </button>
            <button
              onClick={() => setView("tours")}
              className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-[12px] font-bold text-slate-900"
            >
              View Tours
            </button>
          </div>
        </motion.section>
      </div>
    </motion.div>
  );

  const PlannerView = () => (
    <motion.div
      key="planner"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      <div
        className={`relative flex h-[85vh] w-full max-w-xl flex-col overflow-hidden p-8 ${glassStyle}`}
      >
        <button
          onClick={() => {
            setView("landing");
            setStep(1);
          }}
          className="absolute right-6 top-6 p-2 text-slate-400"
        >
          <X size={24} />
        </button>

        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-white/95 p-10 text-center backdrop-blur-2xl"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                className="mb-8 text-blue-600"
              >
                <Settings size={64} strokeWidth={1.5} />
              </motion.div>
              <motion.p
                key={loadingText}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl font-medium text-slate-800"
              >
                {loadingText}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-10 pt-4 text-center">
          <h2 className="mb-4 text-xl font-bold">Plan Your 1-Day Tour</h2>
          <div className="h-1 w-full rounded-full bg-slate-100">
            <motion.div
              animate={{ width: `${(step / 6) * 100}%` }}
              className="h-full rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <p className="text-center text-[10px] font-bold uppercase tracking-widest text-blue-600">
                    Step 01. Select Region
                  </p>
                  <div className="flex justify-center gap-3">
                    <button className="rounded-full bg-blue-600 px-8 py-3 font-bold text-white shadow-lg">
                      Jeju
                    </button>
                    <button className="cursor-not-allowed rounded-full border border-white bg-white/50 px-8 py-3 font-medium text-slate-400">
                      Seoul
                    </button>
                  </div>
                </div>
                <div className="space-y-4 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                    Step 02. Your Travel Style
                  </p>
                  <textarea
                    placeholder="e.g. Quiet cafes with sea view, local hidden restaurants..."
                    className="h-40 w-full rounded-[2rem] border border-white bg-white/40 p-6 text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  className="w-full rounded-[1.5rem] bg-blue-600 py-5 font-bold text-white shadow-2xl transition-all hover:bg-blue-700"
                >
                  Generate My Itinerary
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <h3 className="mb-6 text-center text-lg font-bold">
                  AI Crafted Itinerary
                </h3>
                {[1, 2, 3, 4].map((item, i) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15 }}
                    className="flex items-center justify-between rounded-2xl border border-white bg-white/60 p-4 shadow-sm backdrop-blur-md"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-200" />
                      <div>
                        <p className="font-bold">Destination {i + 1}</p>
                        <p className="text-[10px] text-slate-400">
                          Recommended duration: 1h 30m
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedDetail(true)}
                      className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-600"
                    >
                      View Details
                    </button>
                  </motion.div>
                ))}
                <button
                  onClick={() => setStep(4)}
                  className="mt-8 w-full rounded-[1.5rem] bg-slate-900 py-5 font-bold text-white shadow-2xl"
                >
                  Confirm Itinerary
                </button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-blue-600">
                  Step 04. Choose Package
                </p>
                <div className="grid gap-4">
                  <div className="flex cursor-pointer items-center justify-between rounded-[2rem] border-2 border-blue-600 bg-white p-6 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                        <Users size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold">AI Small Group Join</h3>
                        <p className="text-[10px] text-slate-400">
                          Share with other travelers
                        </p>
                      </div>
                    </div>
                    <span className="text-xl font-black text-blue-600">$89</span>
                  </div>
                  <div className="flex cursor-pointer items-center justify-between rounded-[2rem] border border-white bg-white/50 p-6 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-slate-50 p-2 text-blue-400">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold">AI Private Tour</h3>
                        <p className="text-[10px] text-slate-400">
                          Our group only, max flex
                        </p>
                      </div>
                    </div>
                    <span className="text-xl font-black text-slate-800">$149</span>
                  </div>
                </div>
                <button
                  onClick={() => setStep(5)}
                  className="mt-4 w-full rounded-[1.5rem] bg-blue-600 py-5 font-bold text-white shadow-2xl"
                >
                  Continue to Booking
                </button>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="s5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-blue-600">
                  Step 05. Select Date
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {["Mar 25", "Mar 26", "Mar 27", "Mar 28", "Mar 29", "Mar 30"].map((date, i) => (
                    <button
                      key={date}
                      className={`rounded-2xl border p-4 text-center transition-all ${
                        i === 0
                          ? "border-blue-600 bg-blue-600 text-white shadow-lg"
                          : "border-white bg-white/50 text-slate-700 hover:bg-white/80"
                      }`}
                    >
                      <p className="text-[10px] font-medium text-current opacity-70">2024</p>
                      <p className="text-sm font-bold">{date}</p>
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border border-white bg-white/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Select pickup time
                  </p>
                  <div className="flex gap-2">
                    {["08:00", "09:00", "10:00"].map((time, i) => (
                      <button
                        key={time}
                        className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
                          i === 0
                            ? "bg-slate-900 text-white"
                            : "bg-white/80 text-slate-700 hover:bg-white"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setStep(6)}
                  className="w-full rounded-[1.5rem] bg-blue-600 py-5 font-bold text-white shadow-2xl"
                >
                  Continue to Payment
                </button>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="s6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-blue-600">
                  Step 06. Confirm Booking
                </p>
                <div className="rounded-[2rem] border border-white bg-white/70 p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-sm text-slate-600">Tour</span>
                    <span className="text-sm font-bold text-slate-900">AI Small Group</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-sm text-slate-600">Date</span>
                    <span className="text-sm font-bold text-slate-900">Mar 25, 2024</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-sm text-slate-600">Time</span>
                    <span className="text-sm font-bold text-slate-900">08:00 AM</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-sm text-slate-600">Travelers</span>
                    <span className="text-sm font-bold text-slate-900">2 Adults</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-base font-bold text-slate-900">Total</span>
                    <span className="text-xl font-black text-blue-600">$178</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Reserve with deposit now. Final payment will be due 48 hours before your tour date.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setView("landing");
                    setStep(1);
                  }}
                  className="w-full rounded-[1.5rem] bg-blue-600 py-5 font-bold text-white shadow-2xl"
                >
                  Pay Deposit & Reserve
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {selectedDetail && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              className="absolute bottom-0 left-0 z-[120] flex h-[80%] w-full flex-col rounded-t-[3rem] bg-white p-8 shadow-[0_-10px_50px_rgba(0,0,0,0.1)]"
            >
              <div
                className="mx-auto mb-8 h-1 w-12 cursor-pointer rounded-full bg-slate-100"
                onClick={() => setSelectedDetail(null)}
              />
              <div className="mb-6 h-48 w-full shrink-0 rounded-[2rem] bg-slate-200" />
              <h3 className="mb-4 text-2xl font-black">UNESCO Spot: Jeju East</h3>
              <p className="mb-8 font-light italic leading-relaxed text-slate-600">
                Experience the breathtaking sunrise at Seongsan Ilchulbong, a
                5,000-year-old volcanic peak rising from the turquoise ocean.
              </p>
              <button
                onClick={() => setSelectedDetail(null)}
                className="mt-auto rounded-[1.5rem] bg-slate-100 py-5 font-bold text-slate-900"
              >
                Close Details
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  const ToursView = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8 px-4 pb-32 pt-10"
    >
      <h2 className="px-2 text-2xl font-black tracking-tight">
        Discover Jeju Tours
      </h2>
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          variants={itemFadeIn}
          initial="hidden"
          whileInView="visible"
          className={`flex gap-4 p-4 ${glassStyle}`}
        >
          <div className="h-24 w-24 shrink-0 rounded-2xl bg-slate-200" />
          <div className="flex flex-1 flex-col justify-between">
            <div>
              <span className="mb-1 block w-fit rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-bold uppercase text-blue-600">
                UNESCO Spots
              </span>
              <h3 className="line-clamp-2 text-sm font-bold leading-tight">
                Authentic One-Day Guided Tour: Full Itinerary Jeju
              </h3>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-xs font-black text-blue-600">$73,000</p>
              <button className="text-[10px] font-bold text-slate-400">
                View details
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );

  const MyPageView = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6 px-6 pb-32 pt-16"
    >
      <div className={`flex items-center gap-6 p-8 ${glassStyle}`}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
          G
        </div>
        <div>
          <h2 className="text-xl font-black">Guest Account</h2>
          <p className="text-xs text-slate-400">Welcome to ATOCKOREA</p>
        </div>
      </div>
      <div className={`overflow-hidden ${glassStyle}`}>
        {[
          { icon: <LayoutDashboard size={18} />, label: "Dashboard" },
          { icon: <MapPin size={18} />, label: "My Bookings" },
          { icon: <CalendarIcon size={18} />, label: "Upcoming Tours" },
          { icon: <History size={18} />, label: "History" },
          { icon: <Heart size={18} />, label: "Wishlist" },
          { icon: <Settings size={18} />, label: "Settings" },
        ].map((menu, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-white p-5 last:border-0 active:bg-white/40 transition-colors"
          >
            <div className="flex items-center gap-4 text-slate-700">
              {menu.icon}
              <span className="text-sm font-medium">{menu.label}</span>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </div>
        ))}
      </div>
      <button className="w-full py-5 text-sm font-medium text-slate-400">
        Sign Out
      </button>
    </motion.div>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=2070')] bg-cover bg-center bg-fixed" />
      <div className="fixed inset-0 z-0 bg-white/60 backdrop-blur-[50px]" />

      <AnimatePresence mode="wait">
        <div className="relative z-10">{renderView()}</div>
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 z-[90] flex h-20 w-full items-center justify-around border-t border-gray-100 bg-white/80 px-4 backdrop-blur-2xl md:hidden">
        <NavIcon
          active={view === "landing"}
          icon={<Search size={22} />}
          label="HOME"
          onClick={() => setView("landing")}
        />
        <NavIcon
          active={view === "tours"}
          icon={<Bus size={22} />}
          label="TOURS"
          onClick={() => setView("tours")}
        />
        <NavIcon
          active={view === "cart"}
          icon={<ShoppingCart size={22} />}
          label="CART"
          onClick={() => setView("cart")}
        />
        <NavIcon
          active={view === "mypage"}
          icon={<User size={22} />}
          label="MY"
          onClick={() => setView("mypage")}
        />
      </div>
    </div>
  );
}

function ProductCard({
  badge,
  title,
  description,
  bullets,
  buttonLabel,
  image,
  buttonAction,
  compact = false,
}: ProductCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] shadow-xl ${
        compact ? "min-h-[13rem]" : "min-h-[24rem]"
      }`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${image}')` }}
      />
      <div
        className={`absolute inset-0 ${
          compact
            ? "bg-gradient-to-t from-slate-950 via-slate-900/75 to-slate-900/35"
            : "bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-900/25"
        }`}
      />
      <div
        className={`relative z-10 flex h-full flex-col justify-end text-white ${
          compact ? "p-4" : "p-5"
        }`}
      >
        <div className="inline-flex w-fit rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
          {badge}
        </div>
        <h3
          className={`mt-3 font-black leading-[1.02] ${
            compact ? "text-[1.35rem]" : "text-[1.85rem]"
          }`}
        >
          {title}
        </h3>
        <p
          className={`mt-2 max-w-[18rem] text-slate-200 ${
            compact ? "text-[11px] leading-5" : "text-[12px] leading-5"
          }`}
        >
          {description}
        </p>
        <ul className={`mt-4 space-y-2 ${compact ? "text-[11px]" : "text-[12px]"}`}>
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-2 text-slate-100">
              <Check size={13} className="shrink-0 text-blue-300" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={buttonAction}
          className={`mt-5 inline-flex w-full items-center justify-center rounded-full bg-white font-bold text-slate-900 ${
            compact ? "px-4 py-3 text-[11px]" : "px-4 py-3.5 text-[12px]"
          }`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function NavIcon({ active, icon, label, onClick }: NavIconProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${
        active ? "scale-110 text-blue-600" : "text-slate-400"
      }`}
    >
      {icon}
      <span className="text-[8px] font-black tracking-tighter">{label}</span>
    </button>
  );
}
