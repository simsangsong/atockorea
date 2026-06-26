import {
  MAX_SAVED_VIEWS,
  parseSavedViews,
  removeSavedView,
  serializeSavedViews,
  upsertSavedView,
  viewId,
  viewIsActive,
  type SavedView,
} from '@/lib/admin/saved-views';

describe('saved-views', () => {
  describe('viewId', () => {
    it('slugifies names and lowercases', () => {
      expect(viewId('Pending Orders')).toBe('pending-orders');
    });
    it('keeps Korean, drops punctuation', () => {
      expect(viewId('대기 주문!!')).toBe('대기-주문');
    });
    it('falls back to "view" for empty/symbol-only names', () => {
      expect(viewId('   ')).toBe('view');
      expect(viewId('!!!')).toBe('view');
    });
  });

  describe('parseSavedViews', () => {
    it('returns [] for null / invalid JSON / non-array', () => {
      expect(parseSavedViews(null)).toEqual([]);
      expect(parseSavedViews('not json')).toEqual([]);
      expect(parseSavedViews('{"a":1}')).toEqual([]);
    });
    it('drops malformed entries and non-string filter values', () => {
      const raw = JSON.stringify([
        { id: 'a', name: 'A', filters: { status: 'pending', n: 5 } },
        { name: '' }, // empty name dropped
        null, // dropped
        { name: 'B' }, // no filters -> {}
      ]);
      const views = parseSavedViews(raw);
      expect(views).toHaveLength(2);
      expect(views[0]).toEqual({ id: 'a', name: 'A', filters: { status: 'pending' } });
      expect(views[1]).toEqual({ id: 'b', name: 'B', filters: {} });
    });
    it('dedupes by id and caps at MAX_SAVED_VIEWS', () => {
      const many = Array.from({ length: MAX_SAVED_VIEWS + 5 }, (_, i) => ({
        name: `V${i}`,
        filters: {},
      }));
      expect(parseSavedViews(JSON.stringify(many))).toHaveLength(MAX_SAVED_VIEWS);

      const dup = JSON.stringify([
        { name: 'Same', filters: { a: '1' } },
        { name: 'Same', filters: { a: '2' } },
      ]);
      expect(parseSavedViews(dup)).toHaveLength(1);
    });
  });

  describe('upsertSavedView', () => {
    it('adds newest-first and strips empty filter values', () => {
      const out = upsertSavedView([], 'A', { status: 'pending', source: '' });
      expect(out).toEqual([{ id: 'a', name: 'A', filters: { status: 'pending' } }]);
    });
    it('replaces an existing view with the same id', () => {
      const start: SavedView[] = [{ id: 'a', name: 'A', filters: { status: 'pending' } }];
      const out = upsertSavedView(start, 'A', { status: 'confirmed' });
      expect(out).toHaveLength(1);
      expect(out[0].filters).toEqual({ status: 'confirmed' });
    });
    it('is a no-op (same ref) for an empty name', () => {
      const start: SavedView[] = [];
      expect(upsertSavedView(start, '   ', {})).toBe(start);
    });
    it('caps at MAX_SAVED_VIEWS keeping the newest', () => {
      let views: SavedView[] = [];
      for (let i = 0; i < MAX_SAVED_VIEWS + 3; i++) {
        views = upsertSavedView(views, `V${i}`, {});
      }
      expect(views).toHaveLength(MAX_SAVED_VIEWS);
      expect(views[0].name).toBe(`V${MAX_SAVED_VIEWS + 2}`);
    });
  });

  describe('removeSavedView', () => {
    it('removes by id', () => {
      const start: SavedView[] = [
        { id: 'a', name: 'A', filters: {} },
        { id: 'b', name: 'B', filters: {} },
      ];
      expect(removeSavedView(start, 'a')).toEqual([{ id: 'b', name: 'B', filters: {} }]);
    });
  });

  describe('viewIsActive', () => {
    const view: SavedView = { id: 'a', name: 'A', filters: { status: 'pending' } };
    it('matches when current filters equal the view (extra empty keys ignored)', () => {
      expect(viewIsActive(view, { status: 'pending', source: '' })).toBe(true);
    });
    it('does not match when a value differs', () => {
      expect(viewIsActive(view, { status: 'confirmed' })).toBe(false);
    });
    it('does not match when current has an extra non-empty filter', () => {
      expect(viewIsActive(view, { status: 'pending', source: 'tour_product' })).toBe(false);
    });
  });

  describe('serializeSavedViews', () => {
    it('round-trips through parse', () => {
      const views = upsertSavedView([], 'A', { status: 'pending' });
      expect(parseSavedViews(serializeSavedViews(views))).toEqual(views);
    });
  });
});
