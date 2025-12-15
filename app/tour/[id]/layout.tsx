import { ReactNode } from 'react';
import { Metadata } from 'next';
import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';
import { createServerClient } from '@/lib/supabase';

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  try {
    const supabase = createServerClient();
    const tourId = params.id;

    const { data: tour, error } = await supabase
      .from('tours')
      .select('id, title, description, city, image_url, price, rating, review_count')
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
    const description = tour.description || `Book ${tour.title} in ${tour.city}. Experience the best of Korea with our licensed tour guides.`;

    return generateSEOMetadata({
      title: tour.title,
      description,
      image: imageUrl,
      url: `/tour/${tourId}`,
      type: 'website',
      tags: [tour.city, 'Korea tours', 'day tours'],
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

