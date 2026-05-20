import { generateMetadata as generateSEOMetadata } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: 'Korea Tours — Discover Jeju, Busan & Seoul',
  description: 'Curated small-group day tours across Korea — UNESCO heritage sites, volcanic Jeju, coastal Busan & Seoul day trips. Book directly with licensed Korean travel agencies.',
  url: '/tours/list',
  tags: ['Korea tours', 'Jeju tours', 'Busan tours', 'Seoul day trips', 'small group tours', 'UNESCO Korea', 'cruise shore excursions Korea'],
});

export default function ToursLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}













