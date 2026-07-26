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

    /**
     * An auth failure carries its own status. It also carries a `code`, which
     * is the shape the Supabase branch identifies by — so it used to land
     * there, find no match for 'UNAUTHORIZED' in the postgres code map, and
     * come out as a 500. Measured on production: GET /api/admin/tours answered
     * 500 with a body reading {"error":"Unauthorized","code":"UNAUTHORIZED"}.
     * The right words at the wrong status: a monitor reads 5xx as "the server
     * is broken" and a client reads it as "retry", when the truth is "log in".
     */
    it('honours a status the error already stated, instead of guessing 500', async () => {
      class AuthFailure extends Error {
        status = 401;
        code = 'UNAUTHORIZED';
      }
      const response = handleApiError(new AuthFailure('Unauthorized'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('keeps a 403 a 403', async () => {
      const forbidden = Object.assign(new Error('Forbidden: Insufficient permissions'), {
        status: 403,
        code: 'FORBIDDEN',
      });
      const response = handleApiError(forbidden);
      expect(response.status).toBe(403);
    });

    it('does not let a 5xx status short-circuit the normal paths', async () => {
      // Only client-error statuses are trusted from the error object; a 500
      // still goes through the generic handler so it gets logged as one.
      const boom = Object.assign(new Error('upstream exploded'), { status: 502 });
      const response = handleApiError(boom);
      expect(response.status).toBe(500);
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
      // 🔴 원문 메시지는 **개발 모드에서만** 노출된다(운영에서는 'Internal server
      // error'로 가려진다 — 아래 프로덕션 테스트가 그걸 지킨다). jest는 NODE_ENV가
      // 'test'라, 개발 모드를 명시하지 않으면 이 테스트는 영원히 실패한다.
      const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
      const original = env.NODE_ENV;
      env.NODE_ENV = 'development';
      try {
        const error = new Error('Generic error');
        const response = handleApiError(error);
        const data = await response.json();

        expect(data.error).toBe('Generic error');
        expect(response.status).toBe(500);
      } finally {
        env.NODE_ENV = original;
      }
    });

    it('should not expose stack traces in production', async () => {
      const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
      const originalEnv = env.NODE_ENV;
      env.NODE_ENV = 'production';

      try {
        const error = new Error('Test error');
        const response = handleApiError(error);
        const data = await response.json();

        expect(data.error).toBe('Internal server error');
        expect(data.stack).toBeUndefined();
      } finally {
        env.NODE_ENV = originalEnv;
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

