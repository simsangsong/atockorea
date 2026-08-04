import {
  departureDayReason,
  getDepartureDays,
  isDateOffDepartureDay,
  weekdayOfDateString,
} from "@/lib/tour-departure-days";

const WAUJEONGSA = "seoul-suwon-hwaseong-waujeongsa-starfield"; // Tue/Thu/Sat
const FOLK_VILLAGE = "seoul-suwon-hwaseong-folk-village-starfield-library"; // Mon/Thu/Sat
const GWANGMYEONG = "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library"; // Sun/Wed/Fri
const POCHEON = "pocheon-sanjeong-lake-herb-island-art-valley"; // Mon/Thu/Sat

describe("tour-departure-days", () => {
  describe("weekdayOfDateString", () => {
    it("reads the weekday from the string, not from a local Date", () => {
      // 2026-08-03 is a Monday; 2026-08-08 is a Saturday.
      expect(weekdayOfDateString("2026-08-03")).toBe(1);
      expect(weekdayOfDateString("2026-08-08")).toBe(6);
    });

    it("accepts an ISO timestamp by taking its date part", () => {
      expect(weekdayOfDateString("2026-08-03T23:30:00+09:00")).toBe(1);
    });

    it("returns null rather than a wrong weekday for junk", () => {
      expect(weekdayOfDateString("")).toBeNull();
      expect(weekdayOfDateString(null)).toBeNull();
      expect(weekdayOfDateString(undefined)).toBeNull();
      expect(weekdayOfDateString("2026/08/03")).toBeNull();
      expect(weekdayOfDateString("not-a-date")).toBeNull();
    });
  });

  describe("getDepartureDays", () => {
    it("returns the operator's weekdays for each Suwon package", () => {
      expect(getDepartureDays(WAUJEONGSA)?.weekdays).toEqual([2, 4, 6]);
      expect(getDepartureDays(FOLK_VILLAGE)?.weekdays).toEqual([1, 4, 6]);
      expect(getDepartureDays(GWANGMYEONG)?.weekdays).toEqual([0, 3, 5]);
    });

    it("returns the Mon/Thu/Sat schedule for the Pocheon Jaein Falls product", () => {
      expect(getDepartureDays(POCHEON)?.weekdays).toEqual([1, 4, 6]);
      expect(getDepartureDays(POCHEON)?.label).toBe("Mon, Thu, Sat");
    });

    it("returns null for products with no fixed schedule", () => {
      expect(getDepartureDays("jeju-grand-highlights-loop")).toBeNull();
      expect(getDepartureDays("")).toBeNull();
      expect(getDepartureDays(null)).toBeNull();
      expect(getDepartureDays(undefined)).toBeNull();
    });

    it("gives the three Suwon packages a schedule that covers every weekday exactly once", () => {
      // They share one vehicle, so an overlap means double-booked staff and a
      // gap means a weekday nobody covers. This is the whole point of the split.
      const covered = [WAUJEONGSA, FOLK_VILLAGE, GWANGMYEONG].flatMap(
        (slug) => getDepartureDays(slug)?.weekdays ?? [],
      );
      expect(covered.length).toBe(9);
      // Thu (4) and Sat (6) are deliberately shared by two packages; the
      // operator runs both those days. Sun/Mon/Tue/Wed/Fri belong to one each.
      const counts = covered.reduce<Record<number, number>>((acc, d) => {
        acc[d] = (acc[d] ?? 0) + 1;
        return acc;
      }, {});
      expect(counts).toEqual({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 2, 5: 1, 6: 2 });
    });
  });

  describe("isDateOffDepartureDay", () => {
    it("keeps the operator's own August dates open (Klook calendar, 2026-08-04)", () => {
      // §12 recorded: waujeongsa 6·8·11·13·15·18·20·22·25·27·29
      for (const day of [6, 8, 11, 13, 15, 18, 20, 22, 25, 27, 29]) {
        const date = `2026-08-${String(day).padStart(2, "0")}`;
        expect(isDateOffDepartureDay(WAUJEONGSA, date)).toBe(false);
      }
      // §12 recorded: gwangmyeong 5·7·9·12·14·16·19·21·23·26·28·30
      for (const day of [5, 7, 9, 12, 14, 16, 19, 21, 23, 26, 28, 30]) {
        const date = `2026-08-${String(day).padStart(2, "0")}`;
        expect(isDateOffDepartureDay(GWANGMYEONG, date)).toBe(false);
      }
    });

    it("closes every weekday the tour does not depart on", () => {
      // 2026-08-02 Sun … 2026-08-08 Sat is a full week.
      const week = [
        "2026-08-02", // Sun
        "2026-08-03", // Mon
        "2026-08-04", // Tue
        "2026-08-05", // Wed
        "2026-08-06", // Thu
        "2026-08-07", // Fri
        "2026-08-08", // Sat
      ];
      expect(week.map((d) => isDateOffDepartureDay(WAUJEONGSA, d))).toEqual([
        true, true, false, true, false, true, false,
      ]);
      expect(week.map((d) => isDateOffDepartureDay(FOLK_VILLAGE, d))).toEqual([
        true, false, true, true, false, true, false,
      ]);
      expect(week.map((d) => isDateOffDepartureDay(GWANGMYEONG, d))).toEqual([
        false, true, true, false, true, false, true,
      ]);
      expect(week.map((d) => isDateOffDepartureDay(POCHEON, d))).toEqual([
        true, false, true, true, false, true, false,
      ]);
    });

    it("leaves unscheduled products alone on every day of the week", () => {
      for (const d of ["2026-08-02", "2026-08-05", "2026-08-08"]) {
        expect(isDateOffDepartureDay("jeju-grand-highlights-loop", d)).toBe(false);
        expect(isDateOffDepartureDay(null, d)).toBe(false);
      }
    });

    it("does not close a date it cannot parse", () => {
      // Date validation belongs to the caller; guessing here would reject
      // legitimate requests for a reason the guest cannot act on.
      expect(isDateOffDepartureDay(WAUJEONGSA, "garbage")).toBe(false);
      expect(isDateOffDepartureDay(WAUJEONGSA, null)).toBe(false);
    });
  });

  describe("departureDayReason", () => {
    it("names the actual days so the guest can rebook", () => {
      expect(departureDayReason(WAUJEONGSA)).toBe("This tour departs on Tue, Thu, Sat only.");
      expect(departureDayReason(GWANGMYEONG)).toBe("This tour departs on Sun, Wed, Fri only.");
    });

    it("returns null when there is nothing to explain", () => {
      expect(departureDayReason("jeju-grand-highlights-loop")).toBeNull();
    });

    it("agrees with the weekday list it describes", () => {
      // A label edited without the weekdays (or the reverse) would tell guests
      // one thing and close another.
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (const slug of [WAUJEONGSA, FOLK_VILLAGE, GWANGMYEONG, POCHEON]) {
        const sched = getDepartureDays(slug)!;
        expect(sched.label).toBe(sched.weekdays.map((d) => names[d]).join(", "));
      }
    });
  });
});
