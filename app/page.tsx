import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/HeroSection';
import CompactTrustBar from '@/components/CompactTrustBar';
import ComparisonSection from '@/components/ComparisonSection';
import TourTypeCards from '@/components/TourTypeCards';
import HowItWorksSection from '@/components/HowItWorksSection';
import PreviewItineraryCard from '@/components/PreviewItineraryCard';
import DestinationsCards from '@/components/DestinationsCards';
import ClassicBusSection from '@/components/ClassicBusSection';
import ReviewsSection from '@/components/ReviewsSection';
import FinalCTASection from '@/components/FinalCTASection';
import { generateMetadata as generateSEOMetadata } from '@/lib/seo';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

export const metadata = generateSEOMetadata({
  title: 'AtoC Korea - Licensed Korea-based Platform for Day Tours',
  description: 'Book authentic Korean day tours with licensed travel agencies. Explore Seoul, Busan, and Jeju with certified guides. Best prices guaranteed through direct partnerships.',
  url: '/',
  tags: ['Korea tours', 'Seoul tours', 'Busan tours', 'Jeju tours', 'day tours', 'travel Korea'],
});

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
      <Header />
      <main>
        <HeroSection />
        <CompactTrustBar />
        <ComparisonSection />
        <TourTypeCards />
        <HowItWorksSection />
        <PreviewItineraryCard />
        <DestinationsCards />
        <ClassicBusSection />
        <ReviewsSection />
        <FinalCTASection />
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
