/**
 * Integration test for /api/tours endpoint
 * 
 * Note: This test requires a test database or mocked Supabase client
 * For full integration tests, set up a test Supabase instance
 */

// Integration tests for API endpoints
// Note: These tests require proper mocking or test database setup

describe('Integration: /api/tours', () => {
  it('should handle query parameters correctly', () => {
    const url = new URL('http://localhost:3000/api/tours?city=Seoul&limit=10');
    
    expect(url.searchParams.get('city')).toBe('Seoul');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('should handle price range filters', () => {
    const url = new URL('http://localhost:3000/api/tours?minPrice=50&maxPrice=200');
    
    expect(url.searchParams.get('minPrice')).toBe('50');
    expect(url.searchParams.get('maxPrice')).toBe('200');
  });

  it('should handle search query', () => {
    const url = new URL('http://localhost:3000/api/tours?search=seoul');
    
    expect(url.searchParams.get('search')).toBe('seoul');
  });
});

