import { HomeMainBody } from '@/components/home/HomeMainBody';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
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
    <SitePageShell>
      <main className="bg-transparent">
        <HomeMainBody />
      </main>
    </SitePageShell>
  );
}
