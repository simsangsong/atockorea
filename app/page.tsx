"use client";

import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import TrustBar from "@/components/TrustBar";
import DestinationsCards from "@/components/DestinationsCards";
import SeasonalTours from "@/components/SeasonalTours";
import TourList from "@/components/TourList";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main>
        <HeroSection />
        <TrustBar />
        <DestinationsCards />
        <SeasonalTours />
        <TourList />
      </main>
      <Footer />
      <BottomNav />
      {/* Add padding bottom for mobile to account for bottom nav */}
      <div className="h-16 md:hidden" />
    </div>
  );
}

