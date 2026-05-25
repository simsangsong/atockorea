import type { NextRequest } from "next/server";
import { checkOrigin } from "@/lib/origin-check";

const responseWithJson = Response as typeof Response & {
  json?: (body: unknown, init?: ResponseInit) => Response;
};

function makeRequest(url: string, headers: Record<string, string>): NextRequest {
  return {
    url,
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe("checkOrigin", () => {
  beforeAll(() => {
    if (typeof responseWithJson.json !== "function") {
      Object.defineProperty(Response, "json", {
        value: (body: unknown, init?: ResponseInit) =>
          new Response(JSON.stringify(body), init),
      });
    }
  });

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://atockorea.com";
  });

  it("allows the production www origin when the app URL is configured without www", () => {
    const result = checkOrigin(
      makeRequest("https://www.atockorea.com/api/bookings", {
        origin: "https://www.atockorea.com",
      })
    );

    expect(result).toBeNull();
  });

  it("allows the production bare origin when posting to the www host", () => {
    const result = checkOrigin(
      makeRequest("https://www.atockorea.com/api/bookings", {
        origin: "https://atockorea.com",
      })
    );

    expect(result).toBeNull();
  });

  it("allows same-origin preview deployments even when they are not in env", () => {
    const result = checkOrigin(
      makeRequest("https://atockorea-preview.vercel.app/api/bookings", {
        origin: "https://atockorea-preview.vercel.app",
      })
    );

    expect(result).toBeNull();
  });

  it("blocks unrelated origins", async () => {
    const result = checkOrigin(
      makeRequest("https://www.atockorea.com/api/bookings", {
        origin: "https://example.com",
      })
    );

    expect(result?.status).toBe(403);
    await expect(result?.json()).resolves.toMatchObject({
      error: "forbidden",
      code: "ORIGIN_NOT_ALLOWED",
    });
  });
});
