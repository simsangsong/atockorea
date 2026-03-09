import { logger, createServerLogger, LogLevel } from '@/lib/logger';

// Mock console methods
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('logger', () => {
  const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };

  beforeEach(() => {
    jest.clearAllMocks();
    global.console = mockConsole as any;
    env.NODE_ENV = 'development';
  });

  afterEach(() => {
    env.NODE_ENV = 'test';
  });

  describe('logger methods', () => {
    it('should log debug message', () => {
      logger.debug('Debug message', { userId: '123' });
      expect(mockConsole.debug).toHaveBeenCalled();
    });

    it('should log info message', () => {
      logger.info('Info message', { userId: '123' });
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should log warn message', () => {
      logger.warn('Warning message', { userId: '123' });
      expect(mockConsole.warn).toHaveBeenCalled();
    });

    it('should log error message with error object', () => {
      const error = new Error('Test error');
      logger.error('Error message', error, { userId: '123' });
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('createServerLogger', () => {
    it('should create server logger with request context', () => {
      const req = {
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        headers: {
          get: (name: string) => {
            if (name === 'user-agent') return 'test-agent';
            if (name === 'x-forwarded-for') return '127.0.0.1';
            return null;
          },
        },
      } as any;

      const serverLogger = createServerLogger(req);
      serverLogger.info('Test message');

      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should create server logger without request', () => {
      const serverLogger = createServerLogger();
      serverLogger.info('Test message');

      expect(mockConsole.info).toHaveBeenCalled();
    });
  });

  describe('log levels in production', () => {
    beforeEach(() => {
      env.NODE_ENV = 'production';
    });

    afterEach(() => {
      env.NODE_ENV = 'test';
    });

    it('should not log debug in production', () => {
      logger.debug('Debug message');
      expect(mockConsole.debug).not.toHaveBeenCalled();
    });

    it('should not log info in production', () => {
      logger.info('Info message');
      expect(mockConsole.info).not.toHaveBeenCalled();
    });

    it('should log warn in production', () => {
      logger.warn('Warning message');
      expect(mockConsole.warn).toHaveBeenCalled();
    });

    it('should log error in production', () => {
      logger.error('Error message');
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });
});

