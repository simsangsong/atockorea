/** Same heuristics as `EnhancedBookingSidebar` / `SmallGroupMobileBookingSheet`. */
export function isJejuPrivateCarTourJoin(title: string | undefined): boolean {
  if (!title || typeof title !== 'string') return false;
  const s = title.toLowerCase().trim();
  return (
    /jeju\s+private\s+car|private\s+car\s+charter/i.test(s) ||
    /제주\s*프라이빗\s*차|프라이빗\s*차\s*차터/i.test(s) ||
    /济州\s*私人\s*包车|济州\s*私人\s*汽车|私人\s*包车|私人\s*汽车/i.test(s) ||
    /濟州\s*私人\s*包車|私人\s*包車/i.test(s) ||
    /済州\s*プライベート|プライベート\s*チャーター|済州\s*貸切/i.test(s) ||
    /jeju\s+coche\s+privado|charter\s+privado/i.test(s)
  );
}
