import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import HeroPremium from '@/src/components/home/HeroPremium';
import ProductCardsPremium from '@/src/components/home/ProductCardsPremium';
import SmallGroupValuePremium from '@/src/components/home/SmallGroupValuePremium';
import HomeBookWithConfidence from '@/src/components/home/HomeBookWithConfidence';
import HomeReviewsPreview from '@/src/components/home/HomeReviewsPreview';
import ClassicBusSection from '@/components/ClassicBusSection';
import FinalCtaPremium from '@/src/components/home/FinalCtaPremium';
import { AppBackground } from '@/src/components/v0-skin';
import { getHomepagePreviewReviews } from '@/lib/reviews-queries.server';

/** Shared premium home shell for `/` and `/ko`, `/zh-CN`, etc. */
export default async function PremiumHomePage() {
  const homeReviews = await getHomepagePreviewReviews();

  return (
    <AppBackground>
      <Header />
      <main className="bg-transparent pb-2">
        <HeroPremium />
        <ProductCardsPremium />
        <SmallGroupValuePremium />
        <HomeBookWithConfidence />
        <HomeReviewsPreview reviews={homeReviews} />
        <ClassicBusSection />
        <FinalCtaPremium />
      </main>
      <Footer />
      <BottomNav />
      <div className="mobile-bottom-nav-spacer md:hidden" aria-hidden />
    </AppBackground>
  );
}
