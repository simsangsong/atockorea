import { ReactNode } from 'react';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';
import { createServerClient } from '@/lib/supabase';

type MetadataLocale = 'en' | 'ko' | 'zh' | 'zh-TW' | 'es' | 'ja';

async function detectRequestLocale(): Promise<MetadataLocale> {
  try {
    const h = await Promise.resolve(headers());
    if (h == null || typeof (h as Headers)?.get !== 'function') return 'en';
    const acceptLanguage = (h as Headers).get?.('accept-language')?.toLowerCase() || '';

    if (acceptLanguage.includes('ko')) return 'ko';
    if (acceptLanguage.includes('zh-tw') || acceptLanguage.includes('zh-hant')) return 'zh-TW';
    if (acceptLanguage.includes('zh')) return 'zh';
    if (acceptLanguage.includes('es')) return 'es';
    if (acceptLanguage.includes('ja')) return 'ja';
  } catch {
    // headers() can be unavailable in some contexts (e.g. static generation)
  }
  return 'en';
}

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  try {
    const supabase = createServerClient();
    const tourId = params.id;

    const { data: tour, error } = await supabase
      .from('tours')
      .select('id, title, description, city, image_url, price, rating, review_count, translations, seo_title, meta_description')
      .eq('id', tourId)
      .eq('is_active', true)
      .single();

    if (error || !tour) {
      return generateSEOMetadata({
        title: 'Tour Not Found',
        description: 'The tour you are looking for does not exist.',
        url: `/tour/${tourId}`,
        noindex: true,
      });
    }

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com';
    const imageUrl = tour.image_url || `${siteUrl}/og-image.jpg`;

    const requestLocale = await detectRequestLocale();
    const translations = (tour.translations || {}) as Record<string, any>;
    const tr = translations[requestLocale] as Record<string, any> | undefined;

    const baseTitle = (tour.seo_title as string) || tour.title || '';
    const baseDescription =
      (tour.meta_description as string) ||
      tour.description ||
      `Book ${tour.title} in ${tour.city}. Experience the best of Korea with our licensed tour guides.`;

    const localizedTitle = (tr?.title as string) || (tour.seo_title as string) || tour.title || '';
    const localizedDescription =
      (tr?.description as string) || (tour.meta_description as string) || tour.description || baseDescription;

    const path = `/tour/${tourId}`;

    const languages: Record<string, string> = {
      en: `${siteUrl}${path}`,
      'zh-CN': `${siteUrl}/zh-CN${path}`,
      ja: `${siteUrl}/ja${path}`,
      es: `${siteUrl}/es${path}`,
      ko: `${siteUrl}/ko${path}`,
      'x-default': `${siteUrl}${path}`,
    };

    return generateSEOMetadata({
      title: localizedTitle,
      description: localizedDescription,
      image: imageUrl,
      url: path,
      type: 'website',
      tags: [tour.city, 'Korea tours', 'day tours'],
      languages,
    });
  } catch (error) {
    console.error('Error generating metadata:', error);
    return generateSEOMetadata({
      title: 'Tour Details',
      description: 'View tour details and book your Korea adventure.',
      url: `/tour/${params.id}`,
    });
  }
}

async function generateStructuredDataForTour(tourId: string) {
  try {
    const supabase = createServerClient();
    const { data: tour } = await supabase
      .from('tours')
      .select('id, title, description, city, image_url, price, rating, review_count, duration')
      .eq('id', tourId)
      .eq('is_active', true)
      .single();

    if (!tour) return null;

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com';
    
    return generateStructuredData('Tour', {
      name: tour.title,
      description: tour.description || `Experience ${tour.title} in ${tour.city}`,
      image: tour.image_url || `${siteUrl}/og-image.jpg`,
      url: `${siteUrl}/tour/${tour.id}`,
      price: parseFloat(tour.price?.toString() || '0'),
      rating: tour.rating ? parseFloat(tour.rating.toString()) : undefined,
      reviewCount: tour.review_count || 0,
      duration: tour.duration,
      location: tour.city,
    });
  } catch (error) {
    console.error('Error generating structured data:', error);
    return null;
  }
}

export default async function TourLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { id: string };
}) {
  const structuredData = await generateStructuredDataForTour(params.id);

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      )}
      {children}
    </>
  );
}

