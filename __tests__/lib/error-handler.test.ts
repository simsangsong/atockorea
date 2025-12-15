import { AppError, handleApiError, createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/error-handler';
import { NextRequest } from 'next/server';

// Mock NextRequest
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {
    url: string;
    method: string;
    headers: Headers;
    
    constructor(input: string | Request, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers || {});
    }
  },
  NextResponse: {
    json: (body: any, init?: ResponseInit) => {
      return {
        json: () => Promise.resolve(body),
        status: init?.status || 200,
      };
    },
  },
}));

describe('error-handler', () => {
  describe('AppError', () => {
    it('should create an AppError with default status code', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });

    it('should create an AppError with custom status code and code', () => {
      const error = new AppError('Not found', 404, 'NOT_FOUND', { id: '123' });
      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.details).toEqual({ id: '123' });
    });
  });

  describe('handleApiError', () => {
    it('should handle AppError correctly', async () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      const response = handleApiError(error);
      const data = await response.json();
      
      expect(data.error).toBe('Test error');
      expect(data.code).toBe('TEST_ERROR');
      expect(response.status).toBe(400);
    });

    it('should handle Supabase errors correctly', async () => {
      const supabaseError = { code: 'PGRST116', message: 'Not found' };
      const response = handleApiError(supabaseError);
      const data = await response.json();
      
      expect(data.error).toBe('Not found');
      expect(data.code).toBe('PGRST116');
      expect(response.status).toBe(404);
    });

    it('should handle generic errors correctly', async () => {
      const error = new Error('Generic error');
      const response = handleApiError(error);
      const data = await response.json();
      
      expect(data.error).toBe('Generic error');
      expect(response.status).toBe(500);
    });

    it('should not expose stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        const error = new Error('Test error');
        const response = handleApiError(error);
        const data = await response.json();
        
        expect(data.error).toBe('Internal server error');
        expect(data.stack).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with default status code', async () => {
      const response = createErrorResponse('Error message');
      const data = await response.json();
      
      expect(data.error).toBe('Error message');
      expect(response.status).toBe(500);
    });

    it('should create error response with custom status code and code', async () => {
      const response = createErrorResponse('Not found', 404, 'NOT_FOUND', { id: '123' });
      const data = await response.json();
      
      expect(data.error).toBe('Not found');
      expect(data.code).toBe('NOT_FOUND');
      expect(data.details).toEqual({ id: '123' });
      expect(response.status).toBe(404);
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response with default status code', async () => {
      const response = createSuccessResponse({ id: '123' });
      const data = await response.json();
      
      expect(data.data).toEqual({ id: '123' });
      expect(data.success).toBe(true);
      expect(response.status).toBe(200);
    });

    it('should create success response with custom status code and message', async () => {
      const response = createSuccessResponse({ id: '123' }, 201, 'Created');
      const data = await response.json();
      
      expect(data.data).toEqual({ id: '123' });
      expect(data.message).toBe('Created');
      expect(data.success).toBe(true);
      expect(response.status).toBe(201);
    });
  });

  describe('withErrorHandler', () => {
    it('should wrap handler and catch errors', async () => {
      const handler = jest.fn().mockRejectedValue(new AppError('Test error', 400));
      const wrappedHandler = withErrorHandler(handler);
      
      const req = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: new Headers(),
      } as any;
      
      const response = await wrappedHandler(req);
      const json = await response.json();
      
      expect(handler).toHaveBeenCalled();
      expect(json.error).toBe('Test error');
      expect(response.status).toBe(400);
    });

    it('should return handler result if no error', async () => {
      const handler = jest.fn().mockResolvedValue(createSuccessResponse({ success: true }));
      const wrappedHandler = withErrorHandler(handler);
      
      const req = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: new Headers(),
      } as any;
      
      const response = await wrappedHandler(req);
      const json = await response.json();
      
      expect(handler).toHaveBeenCalled();
      expect(json.success).toBe(true);
      expect(response.status).toBe(200);
    });
  });
});

