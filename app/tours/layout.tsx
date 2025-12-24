import { generateMetadata as generateSEOMetadata } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: 'All Tours - Explore Korea',
  description: 'Browse all available tours in Korea. Find the perfect day tour in Seoul, Busan, or Jeju. Compare prices, read reviews, and book directly with licensed travel agencies.',
  url: '/tours',
  tags: ['Korea tours', 'Seoul tours', 'Busan tours', 'Jeju tours', 'day tours'],
});

export default function ToursLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}





