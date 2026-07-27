/**
 * U-D9 — retiring the ops-only theme store.
 *
 * The migration is the one place a user's setting can be silently overwritten,
 * in either direction: forget to adopt and a dispatcher who ran dark gets
 * bounced to light; adopt too eagerly and a months-old ops key overrules the
 * light/dark they just picked in the smart app.
 */
import { migrateLegacyOpsTheme, OPS_THEME_KEY } from '@/components/tour-ops/opsTheme';

const SETTINGS_KEY = 'tour_mode_settings';
const LEGACY_ROOM_KEY = 'tour_ops_room_theme';

beforeEach(() => {
  window.localStorage.clear();
});

describe('migrateLegacyOpsTheme (U-D9)', () => {
  it('adopts the stored ops theme when the shared store is still on its default', () => {
    window.localStorage.setItem(OPS_THEME_KEY, 'dark');
    expect(migrateLegacyOpsTheme()).toBe('dark');
  });

  it('also reads the pre-unification room-manager key', () => {
    window.localStorage.setItem(LEGACY_ROOM_KEY, 'dark');
    expect(migrateLegacyOpsTheme()).toBe('dark');
  });

  it('treats an explicit smart-app choice as the winner', () => {
    window.localStorage.setItem(OPS_THEME_KEY, 'dark');
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'light' }));
    expect(migrateLegacyOpsTheme()).toBeNull();
  });

  it("does not treat 'system' as an explicit choice", () => {
    window.localStorage.setItem(OPS_THEME_KEY, 'dark');
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'system' }));
    expect(migrateLegacyOpsTheme()).toBe('dark');
  });

  it('clears the retired keys so it runs at most once', () => {
    window.localStorage.setItem(OPS_THEME_KEY, 'dark');
    window.localStorage.setItem(LEGACY_ROOM_KEY, 'dark');
    expect(migrateLegacyOpsTheme()).toBe('dark');
    expect(window.localStorage.getItem(OPS_THEME_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_ROOM_KEY)).toBeNull();
    expect(migrateLegacyOpsTheme()).toBeNull();
  });

  it('returns null when there was never an ops preference', () => {
    expect(migrateLegacyOpsTheme()).toBeNull();
  });

  it('survives corrupt settings JSON rather than throwing on boot', () => {
    window.localStorage.setItem(OPS_THEME_KEY, 'dark');
    window.localStorage.setItem(SETTINGS_KEY, '{not json');
    expect(migrateLegacyOpsTheme()).toBeNull();
  });
});
