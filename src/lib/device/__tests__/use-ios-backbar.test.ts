import { detectIosBackbar } from "../use-ios-backbar";

const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const KAKAOTALK_UA = `${IPHONE_SAFARI_UA} KAKAOTALK 10.5.5`;
const INSTAGRAM_UA = `${IPHONE_SAFARI_UA} Instagram 280.0.0.18.114 (iPhone15,2; iOS 17_0_3)`;
const FACEBOOK_UA = `${IPHONE_SAFARI_UA} [FBAN/FBIOS;FBAV/420.0.0.32.106;FBBV/123456;FBDV/iPhone15,2]`;
const NAVER_INAPP_UA = `${IPHONE_SAFARI_UA} NAVER(inapp; search; 1235; 11.16.3)`;
const LINE_UA = `${IPHONE_SAFARI_UA} Line/12.5.0`;
const IPAD_MASQUERADE_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

describe("detectIosBackbar", () => {
  it("returns false for regular iPhone Safari (browser back ← exists)", () => {
    expect(
      detectIosBackbar({
        userAgent: IPHONE_SAFARI_UA,
        isStandalone: false,
        maxTouchPoints: 5,
      })
    ).toBe(false);
  });

  it("returns true for iPhone in PWA standalone mode", () => {
    expect(
      detectIosBackbar({
        userAgent: IPHONE_SAFARI_UA,
        isStandalone: true,
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it("returns true for iPhone KakaoTalk in-app browser", () => {
    expect(
      detectIosBackbar({
        userAgent: KAKAOTALK_UA,
        isStandalone: false,
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it("returns true for iPhone Instagram in-app browser", () => {
    expect(
      detectIosBackbar({
        userAgent: INSTAGRAM_UA,
        isStandalone: false,
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it("returns true for iPhone Facebook in-app browser (FBAN/FBIOS)", () => {
    expect(
      detectIosBackbar({
        userAgent: FACEBOOK_UA,
        isStandalone: false,
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it("returns true for iPhone NAVER in-app browser", () => {
    expect(
      detectIosBackbar({
        userAgent: NAVER_INAPP_UA,
        isStandalone: false,
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it("returns true for iPhone Line in-app browser", () => {
    expect(
      detectIosBackbar({
        userAgent: LINE_UA,
        isStandalone: false,
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it("returns true for iPad masquerading as Macintosh in PWA standalone (maxTouchPoints > 1)", () => {
    expect(
      detectIosBackbar({
        userAgent: IPAD_MASQUERADE_UA,
        isStandalone: true,
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it("returns false for Macintosh desktop Safari (no touch points)", () => {
    expect(
      detectIosBackbar({
        userAgent: IPAD_MASQUERADE_UA,
        isStandalone: false,
        maxTouchPoints: 0,
      })
    ).toBe(false);
  });

  it("returns false for Android Chrome (system back exists)", () => {
    expect(
      detectIosBackbar({
        userAgent: ANDROID_CHROME_UA,
        isStandalone: false,
        maxTouchPoints: 5,
      })
    ).toBe(false);
  });

  it("returns false for Desktop Chrome", () => {
    expect(
      detectIosBackbar({
        userAgent: DESKTOP_CHROME_UA,
        isStandalone: false,
        maxTouchPoints: 0,
      })
    ).toBe(false);
  });
});
