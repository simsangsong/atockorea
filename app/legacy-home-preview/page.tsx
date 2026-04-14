import LegacyHomePage from '@/components/home/legacy/LegacyHomePage';
import { SitePageShell } from '@/src/components/layout/SitePageShell';
import { generateMetadata as generateSEOMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = generateSEOMetadata({
  title: 'Legacy home (preview)',
  description: 'Internal preview of the pre–v2 homepage layout. Not for indexing.',
  url: '/legacy-home-preview',
  noindex: true,
  nofollow: true,
});

export default function LegacyHomePreviewPage() {
  return (
    <SitePageShell>
      <main className="bg-transparent">
        <LegacyHomePage />
      </main>
    </SitePageShell>
  );
}
