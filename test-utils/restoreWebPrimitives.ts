/**
 * jest.setup.js replaces global Request/Response/Headers with dumb stubs for
 * jsdom component tests. Node-environment API-route tests need the real web
 * primitives (NextResponse.json, SSE ReadableStream responses), and they need
 * them restored BEFORE next/server is evaluated — NextResponse extends the
 * global Response captured at module-eval time. Import this module first:
 *
 *   import '@/test-utils/restoreWebPrimitives';
 *   import { GET } from '@/app/api/.../route';
 *
 * (Lives outside __tests__/ so jest's testMatch doesn't treat it as a suite.)
 */
import { Request as UndiciRequest, Response as UndiciResponse, Headers as UndiciHeaders } from 'undici';

/* eslint-disable @typescript-eslint/no-explicit-any */
(global as any).Request = UndiciRequest;
(global as any).Response = UndiciResponse;
(global as any).Headers = UndiciHeaders;
/* eslint-enable @typescript-eslint/no-explicit-any */

export {};
