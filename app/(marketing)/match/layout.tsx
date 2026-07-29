import { generateMetadata as generateSEOMetadata } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: 'Korea Day Tour Matcher — Find your best-fit tour',
  description:
    'Describe your travel style and we will match you with the small-group, private, or bus day tour in Korea that fits best — powered by an LLM + curated scoring.',
  url: '/match',
  tags: [
    'Korea day tour',
    'Jeju day tour',
    'tour matcher',
    'small group tour',
    'private tour',
  ],
});

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
