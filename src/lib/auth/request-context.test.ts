import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatRequestContext, readRequestContext } from "@/lib/auth/request-context";

const CHROME_ON_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SAFARI_ON_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function describeRequest(headers: Record<string, string>): string {
  return formatRequestContext(readRequestContext(new Headers(headers)));
}

describe("request context", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T14:05:42Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("describes the browser, OS, device, IP and UTC time of a request", () => {
    expect(
      describeRequest({ "user-agent": CHROME_ON_WINDOWS, "x-forwarded-for": "203.0.113.7" }),
    ).toBe("Chrome 131 on Windows (desktop) · IP 203.0.113.7 · 29 Sep 2026, 14:05 UTC");
  });

  it("names the device type of a phone", () => {
    expect(
      describeRequest({ "user-agent": SAFARI_ON_IPHONE, "x-forwarded-for": "198.51.100.4" }),
    ).toBe("Mobile Safari 17 on iOS (mobile) · IP 198.51.100.4 · 29 Sep 2026, 14:05 UTC");
  });

  it("uses the rightmost forwarded IP, not the one the client claims", () => {
    expect(
      describeRequest({
        "user-agent": CHROME_ON_WINDOWS,
        "x-forwarded-for": "10.9.9.9, 192.0.2.1 ,203.0.113.7",
      }),
    ).toContain("· IP 203.0.113.7 ·");
  });

  it("shows Unknown for details the request doesn't carry", () => {
    expect(describeRequest({})).toBe(
      "Unknown browser on Unknown OS (Unknown device) · IP Unknown · 29 Sep 2026, 14:05 UTC",
    );
  });

  it("pads the time and uses UTC whatever the server's time zone", () => {
    vi.setSystemTime(new Date("2026-01-03T23:07:00-05:00"));

    expect(describeRequest({})).toContain("· 4 Jan 2026, 04:07 UTC");
  });
});
