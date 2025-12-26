/**
 * Logging utility for client and server
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isClient = typeof window !== 'undefined';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) return true;
    
    // In production, only log warnings and errors
    return level === LogLevel.WARN || level === LogLevel.ERROR;
  }

  private log(level: LogLevel, message: string, error?: Error, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);
    const logContext = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, logContext);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, logContext);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, logContext);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, logContext);
        // In production, send to error tracking service
        if (!this.isDevelopment && this.isClient) {
          this.sendToErrorTracking(level, message, error, context);
        }
        break;
    }
  }

  private async sendToErrorTracking(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: LogContext
  ) {
    try {
      // Send to error tracking API
      await fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          message,
          error: error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          } : undefined,
          context: {
            ...context,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (err) {
      // Silently fail - don't break the app if logging fails
      console.error('Failed to send error to tracking service:', err);
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, undefined, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, undefined, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, undefined, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, error, context);
  }
}

export const logger = new Logger();

/**
 * Server-side logger with request context
 */
export function createServerLogger(req?: Request) {
  const context: LogContext = {};

  if (req) {
    context.path = new URL(req.url).pathname;
    context.method = req.method;
    context.userAgent = req.headers.get('user-agent') || undefined;
    context.ip = req.headers.get('x-forwarded-for') || 
                 req.headers.get('x-real-ip') || 
                 'unknown';
  }

  return {
    debug: (message: string, extraContext?: LogContext) => {
      logger.debug(message, { ...context, ...extraContext });
    },
    info: (message: string, extraContext?: LogContext) => {
      logger.info(message, { ...context, ...extraContext });
    },
    warn: (message: string, extraContext?: LogContext) => {
      logger.warn(message, { ...context, ...extraContext });
    },
    error: (message: string, error?: Error, extraContext?: LogContext) => {
      logger.error(message, error, { ...context, ...extraContext });
    },
  };
}










