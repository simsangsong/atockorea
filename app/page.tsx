import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroSection from '@/components/HeroSection';
import DestinationsCards from '@/components/DestinationsCards';
import TourList from '@/components/TourList';
import SeasonalTours from '@/components/SeasonalTours';
import PaymentMethodInfo from '@/components/PaymentMethodInfo';
import TrustBar from '@/components/TrustBar';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
      <Header />
      <main>
        <HeroSection />
        <DestinationsCards />
        <TourList />
        <SeasonalTours />
        <PaymentMethodInfo />
        <TrustBar />
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
