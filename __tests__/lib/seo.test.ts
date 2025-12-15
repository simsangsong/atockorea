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
      expect(metadata.openGraph?.images?.[0]?.url).toBe('https://example.com/image.jpg');
    });

    it('should generate metadata with Twitter Card', () => {
      const metadata = generateMetadata({
        title: 'Test Page',
        description: 'Test description',
        image: 'https://example.com/image.jpg',
      });

      expect(metadata.twitter?.title).toBe('Test Page | AtoC Korea');
      expect(metadata.twitter?.description).toBe('Test description');
      expect(metadata.twitter?.images?.[0]).toBe('https://example.com/image.jpg');
    });

    it('should set noindex when specified', () => {
      const metadata = generateMetadata({
        title: 'Test Page',
        noindex: true,
      });

      expect(metadata.robots?.index).toBe(false);
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
      expect(data.name).toBe('Seoul City Tour');
      expect(data.offers.price).toBe(100);
      expect(data.aggregateRating.ratingValue).toBe(4.5);
    });

    it('should generate Organization structured data', () => {
      const data = generateStructuredData('Organization', {});

      expect(data['@type']).toBe('Organization');
      expect(data.name).toBe('AtoC Korea');
      // URL will use NEXT_PUBLIC_APP_URL from env
      expect(data.url).toBeDefined();
    });

    it('should generate WebSite structured data', () => {
      const data = generateStructuredData('WebSite', {});

      expect(data['@type']).toBe('WebSite');
      expect(data.name).toBe('AtoC Korea');
      expect(data.potentialAction['@type']).toBe('SearchAction');
    });
  });
});

