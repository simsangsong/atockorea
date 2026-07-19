/**
 * Location message parsing — driver signals append a maps URL to the bubble
 * text; the chat turns that into an inline map preview.
 */
import { parseLocationMessage, staticMapUrl } from '@/lib/tour-room/locationMessage';

describe('parseLocationMessage', () => {
  it('extracts coords + strips the URL from the label', () => {
    const loc = parseLocationMessage('차량이 픽업 장소에 도착했어요.\nhttps://maps.google.com/?q=35.080370,129.078507');
    expect(loc).not.toBeNull();
    expect(loc!.lat).toBeCloseTo(35.08037, 5);
    expect(loc!.lng).toBeCloseTo(129.078507, 5);
    expect(loc!.label).toBe('차량이 픽업 장소에 도착했어요.');
    expect(loc!.url).toContain('q=35.080370,129.078507');
  });

  it('handles the www.google.com/maps?q= variant', () => {
    const loc = parseLocationMessage('Parked here https://www.google.com/maps?q=37.5665,126.9780');
    expect(loc).not.toBeNull();
    expect(loc!.lat).toBeCloseTo(37.5665, 4);
    expect(loc!.lng).toBeCloseTo(126.978, 4);
  });

  it('returns null when there is no maps link', () => {
    expect(parseLocationMessage('그냥 채팅 메시지예요')).toBeNull();
    expect(parseLocationMessage('')).toBeNull();
    expect(parseLocationMessage(null)).toBeNull();
  });

  it('rejects out-of-range coordinates', () => {
    expect(parseLocationMessage('https://maps.google.com/?q=200.0,400.0')).toBeNull();
  });
});

describe('staticMapUrl', () => {
  it('builds a Static Maps URL centered + marked at the point', () => {
    const url = staticMapUrl(35.08, 129.07);
    expect(url).toContain('maps.googleapis.com/maps/api/staticmap');
    expect(url).toContain('center=35.080000,129.070000');
    expect(url).toContain('markers=');
    expect(url).toContain('key=');
  });
});
