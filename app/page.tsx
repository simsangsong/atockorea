import { HomeMainBody } from '@/components/home/HomeMainBody';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { generateMetadata as generateSEOMetadata } from '@/lib/seo';

/**
 * No `export const dynamic` here — the page itself is static. The root layout calls
 * `await cookies()` so this route still renders dynamically at the layout level, but
 * removing the explicit `force-dynamic` lets Next opt into PPR / streaming once the
 * layout-level cookie read is reworked (tracked separately).
 */

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
