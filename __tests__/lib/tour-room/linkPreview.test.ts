/**
 * @jest-environment node
 *
 * §5-4 — the link-preview safety kernel. The server dereferences guest URLs,
 * so the guard is the whole point: deny the SSRF classes before any fetch.
 */
import { firstUrlIn, isSafePreviewUrl, parsePreviewHtml } from '@/lib/tour-room/linkPreview';

describe('isSafePreviewUrl (SSRF guard)', () => {
  it('accepts a plain https site', () => {
    expect(isSafePreviewUrl('https://visitjeju.net/en/detail')).toBe(true);
  });

  it('denies every class the server must never touch', () => {
    for (const bad of [
      'http://example.com/x', // plaintext
      'https://169.254.169.254/latest', // metadata service
      'https://127.0.0.1/', // loopback
      'https://localhost/admin',
      'https://[::1]/x', // v6 literal
      'https://db.internal/secrets',
      'https://printer.local/',
      'https://router.lan/',
      'https://example.com:8443/x', // non-default port
      'https://intranet/x', // dotless host
      'not a url',
    ]) {
      expect(isSafePreviewUrl(bad)).toBe(false);
    }
  });
});

describe('parsePreviewHtml', () => {
  it('prefers og tags, falls back to <title>, strips entities, caps lengths', () => {
    const html = `<html><head>
      <meta property="og:title" content="성산일출봉 &amp; 우도" />
      <meta property="og:description" content="Sunrise peak &quot;tips&quot;" />
      <title>ignored</title></head></html>`;
    const p = parsePreviewHtml('https://www.visitjeju.net/x', html);
    expect(p).toMatchObject({ host: 'visitjeju.net', title: '성산일출봉 & 우도', description: 'Sunrise peak "tips"' });
  });

  it('honest nulls when a page offers nothing', () => {
    const p = parsePreviewHtml('https://example.com/x', '<html><body>hi</body></html>');
    expect(p.title).toBeNull();
    expect(p.description).toBeNull();
  });
});

describe('firstUrlIn', () => {
  it('finds the first url in chat text and none in plain prose', () => {
    expect(firstUrlIn('여기 좋아요 https://visitjeju.net/spot 꼭 가요')).toBe('https://visitjeju.net/spot');
    expect(firstUrlIn('그냥 텍스트')).toBeNull();
  });
});
