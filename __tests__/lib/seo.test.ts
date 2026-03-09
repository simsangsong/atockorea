import { generateMetadata, generateStructuredData } from '@/lib/seo';
import { Metadata } from 'next';

describe('seo', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://atockorea.com';
  });

  describe('generateMetadata', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://atockorea.com';
    });

    it('should generate basic metadata', () => {
      const metadata = generateMetadata({
        title: 'Test Page',
        description: 'Test description',
      });

      expect(metadata.title).toBe('Test Page | AtoC Korea');
      expect(metadata.description).toBe('Test description');
    });

    it('should generate metadata with Open Graph tags', () => {
      const metadata = generateMetadata({
        title: 'Test Page',
        description: 'Test description',
        url: '/test',
        image: 'https://example.com/image.jpg',
      });

      expect(metadata.openGraph?.title).toBe('Test Page | AtoC Korea');
      expect(metadata.openGraph?.description).toBe('Test description');
      // URL will use NEXT_PUBLIC_APP_URL from env
      expect(metadata.openGraph?.url).toContain('/test');
      const ogImages = metadata.openGraph?.images;
      const first = Array.isArray(ogImages) ? ogImages[0] : ogImages;
      const url = typeof first === 'string' ? first : (first as { url?: string })?.url;
      expect(url).toBe('https://example.com/image.jpg');
    });

    it('should generate metadata with Twitter Card', () => {
      const metadata = generateMetadata({
        title: 'Test Page',
        description: 'Test description',
        image: 'https://example.com/image.jpg',
      });

      expect(metadata.twitter?.title).toBe('Test Page | AtoC Korea');
      expect(metadata.twitter?.description).toBe('Test description');
      const twImages = metadata.twitter?.images;
      expect(Array.isArray(twImages) ? twImages[0] : twImages).toBe('https://example.com/image.jpg');
    });

    it('should set noindex when specified', () => {
      const metadata = generateMetadata({
        title: 'Test Page',
        noindex: true,
      });

      expect(metadata.robots && typeof metadata.robots === 'object' && 'index' in metadata.robots ? metadata.robots.index : undefined).toBe(false);
    });
  });

  describe('generateStructuredData', () => {
    it('should generate Tour structured data', () => {
      const data = generateStructuredData('Tour', {
        name: 'Seoul City Tour',
        description: 'Explore Seoul',
        image: 'https://example.com/image.jpg',
        url: 'https://atockorea.com/tour/123',
        price: 100,
        rating: 4.5,
        reviewCount: 50,
        duration: '8 hours',
        location: 'Seoul',
      });

      expect(data['@type']).toBe('Tour');
      const tourData = data as { name?: string; offers?: { price?: number }; aggregateRating?: { ratingValue?: number } };
      expect(tourData.name).toBe('Seoul City Tour');
      expect(tourData.offers?.price).toBe(100);
      expect(tourData.aggregateRating?.ratingValue).toBe(4.5);
    });

    it('should generate Organization structured data', () => {
      const data = generateStructuredData('Organization', {}) as { '@type'?: string; name?: string; url?: string };

      expect(data['@type']).toBe('Organization');
      expect(data.name).toBe('AtoC Korea');
      expect(data.url).toBeDefined();
    });

    it('should generate WebSite structured data', () => {
      const data = generateStructuredData('WebSite', {}) as { '@type'?: string; name?: string; potentialAction?: { '@type'?: string } };

      expect(data['@type']).toBe('WebSite');
      expect(data.name).toBe('AtoC Korea');
      expect(data.potentialAction?.['@type']).toBe('SearchAction');
    });
  });
});

