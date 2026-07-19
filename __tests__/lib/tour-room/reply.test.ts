/**
 * Reply/quote snapshot (Kakao-grade chat, Phase 1).
 */
import { buildReplySnapshot } from '@/lib/tour-room/reply';

describe('buildReplySnapshot', () => {
  it('captures a text message as a trimmed excerpt', () => {
    const snap = buildReplySnapshot({
      id: 'm1',
      sender_role: 'customer',
      input_kind: 'text',
      source_text: '  We are near the east gate now  ',
    });
    expect(snap).toEqual({ id: 'm1', sender_role: 'customer', input_kind: 'text', excerpt: 'We are near the east gate now' });
  });

  it('truncates a long excerpt to 90 chars', () => {
    const long = 'a'.repeat(200);
    expect(buildReplySnapshot({ id: 'm', sender_role: 'guide', input_kind: 'text', source_text: long }).excerpt).toHaveLength(90);
  });

  it('keeps the caption excerpt for an image and marks the kind', () => {
    const snap = buildReplySnapshot({
      id: 'm2',
      sender_role: 'customer',
      input_kind: 'image',
      source_text: 'look at this view',
      metadata: { kind: 'attachment_image', attachment: { url: 'u', name: 'v.jpg' } },
    });
    expect(snap.input_kind).toBe('image');
    expect(snap.excerpt).toBe('look at this view');
    expect(snap.file_name).toBeUndefined();
  });

  it('carries the file name for a file attachment', () => {
    const snap = buildReplySnapshot({
      id: 'm3',
      sender_role: 'guide',
      input_kind: 'file',
      source_text: '',
      metadata: { kind: 'attachment_file', attachment: { url: 'u', name: 'itinerary.pdf' } },
    });
    expect(snap.input_kind).toBe('file');
    expect(snap.excerpt).toBe('');
    expect(snap.file_name).toBe('itinerary.pdf');
  });

  it('uses the transcript for an audio message', () => {
    const snap = buildReplySnapshot({ id: 'm4', sender_role: 'driver', input_kind: 'audio', source_text: '5분 뒤 출발합니다' });
    expect(snap).toMatchObject({ input_kind: 'audio', excerpt: '5분 뒤 출발합니다' });
  });
});
