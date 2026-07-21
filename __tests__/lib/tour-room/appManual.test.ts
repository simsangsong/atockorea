/**
 * A5 — in-app usage manual content contract.
 * (docs/smart-guide-ops-detail-audit-2026-07-21.md)
 */
import { MANUAL_SECTIONS, MANUAL_TITLE, manualSections } from '@/lib/tour-room/appManual';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

describe('manual content', () => {
  it('every section carries all 5 locales for title and body', () => {
    for (const section of MANUAL_SECTIONS) {
      for (const locale of ROOM_LOCALES) {
        expect(section.title[locale]?.trim()).toBeTruthy();
        expect(section.body[locale]?.trim()).toBeTruthy();
      }
    }
    for (const locale of ROOM_LOCALES) expect(MANUAL_TITLE[locale]?.trim()).toBeTruthy();
  });

  it('join and private both include the shared basics', () => {
    const joinKeys = manualSections('join').map((section) => section.key);
    const privateKeys = manualSections('private').map((section) => section.key);
    for (const key of ['chat', 'arrival', 'meeting', 'signals', 'sos']) {
      expect(joinKeys).toContain(key);
      expect(privateKeys).toContain(key);
    }
  });

  it('role separation: join explains staff=safety/ops; private explains driver+guide split', () => {
    const joinKeys = manualSections('join').map((section) => section.key);
    expect(joinKeys).toContain('roles');
    expect(joinKeys).not.toContain('money');
    const roles = MANUAL_SECTIONS.find((section) => section.key === 'roles')!;
    expect(roles.body.ko).toContain('안전');
    expect(roles.body.ko).toContain('스마트 가이드');

    const privateKeys = manualSections('private').map((section) => section.key);
    expect(privateKeys).toContain('driver_role');
    expect(privateKeys).toContain('money');
    expect(privateKeys).not.toContain('roles');
  });
});
