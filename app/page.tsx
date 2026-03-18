import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroPremium from '@/src/components/home/HeroPremium';
import TrustStripPremium from '@/src/components/home/TrustStripPremium';
import ComparisonPanelPremium from '@/src/components/home/ComparisonPanelPremium';
import ProductCardsPremium from '@/src/components/home/ProductCardsPremium';
import HowItWorksPremium from '@/src/components/home/HowItWorksPremium';
import DestinationsCards from '@/components/DestinationsCards';
import ClassicBusSection from '@/components/ClassicBusSection';
import ReviewsPremium from '@/src/components/home/ReviewsPremium';
import FinalCtaPremium from '@/src/components/home/FinalCtaPremium';
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
        <HeroPremium />
        <TrustStripPremium />
        <ComparisonPanelPremium />
        <ProductCardsPremium />
        <HowItWorksPremium />
        <DestinationsCards hideLegacyBlocks />
        <ClassicBusSection />
        <ReviewsPremium />
        <FinalCtaPremium />
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
