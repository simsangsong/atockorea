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
  title: 'AtoC Korea - Korea Day Tours, Hand-Picked by Our Team',
  description: 'Korea day tours hand-picked by our team. Same operators trusted by Klook, GetYourGuide, and Viator — book direct here, compare prices anytime.',
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
