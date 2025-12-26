import { generateMetadata as generateSEOMetadata } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: 'Search Tours - Find Your Perfect Korea Tour',
  description: 'Search and discover amazing tours in Korea. Filter by destination, price, duration, and features to find the perfect day tour for your trip.',
  url: '/search',
  tags: ['Korea tours', 'tour search', 'Seoul', 'Busan', 'Jeju'],
});

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}










