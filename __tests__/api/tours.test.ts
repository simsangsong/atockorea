import { GET } from '@/app/api/tours/route';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  createServerClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}));

describe('/api/tours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return tours list', async () => {
    const { createServerClient } = require('@/lib/supabase');
    const mockTours = [
      {
        id: '1',
        title: 'Test Tour',
        city: 'Seoul',
        price: 100,
        price_type: 'person',
        image_url: 'https://example.com/image.jpg',
        rating: 4.5,
        review_count: 10,
        is_active: true,
      },
    ];

    const queryChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: mockTours, error: null }),
    };

    (createServerClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => queryChain),
    });

    const req = {
      url: 'http://localhost:3000/api/tours',
      method: 'GET',
      headers: new Headers(),
    } as any;

    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty('tours');
  });

  it('should handle errors correctly', async () => {
    const { createServerClient } = require('@/lib/supabase');
    
    const queryChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    };

    (createServerClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => queryChain),
    });

    const req = {
      url: 'http://localhost:3000/api/tours',
      method: 'GET',
      headers: new Headers(),
    } as any;

    const response = await GET(req);
    const json = await response.json();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(json).toHaveProperty('error');
  });
});

