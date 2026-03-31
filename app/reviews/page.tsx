import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import ReviewsPageClient from "@/components/reviews/ReviewsPageClient";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo";
import {
  attachReviewProfiles,
  fetchPublicReviewsForApi,
} from "@/lib/reviews-queries.server";

export const metadata = generateSEOMetadata({
  title: "Traveler Reviews — AtoC Korea",
  description: "What travelers say about AI-planned Korea tours, small-group join, and classic bus options.",
  url: "/reviews",
});

export default async function ReviewsMarketingPage() {
  const rawPublic = await fetchPublicReviewsForApi({
    limit: 50,
    offset: 0,
    homePreview: false,
  });
  const initialPublicReviews = await attachReviewProfiles(rawPublic);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-orange-50/20 pt-20 pb-24">
        <ReviewsPageClient initialPublicReviews={initialPublicReviews} />
      </main>
      <Footer />
      <BottomNav />
      <div className="mobile-bottom-nav-spacer md:hidden" aria-hidden />
    </>
  );
}
