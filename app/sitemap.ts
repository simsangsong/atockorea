import { MetadataRoute } from 'next';
import { createServerClient } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/tours`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Dynamic tour pages
  try {
    const supabase = createServerClient();
    const { data: tours } = await supabase
      .from('tours')
      .select('id, updated_at')
      .eq('is_active', true)
      .limit(1000); // Limit to prevent excessive data

    const tourPages: MetadataRoute.Sitemap =
      tours?.map((tour) => ({
        url: `${baseUrl}/tour/${tour.id}`,
        lastModified: tour.updated_at ? new Date(tour.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })) || [];

    return [...staticPages, ...tourPages];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return staticPages;
  }
}

