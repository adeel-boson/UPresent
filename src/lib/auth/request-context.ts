import { userAgentFromString } from "next/server";

// Where a request came from, for "Requested from" / "Changed from" lines in
// security emails. It goes into the email only: never store or log it
// (CODING_STANDARDS §10), since an IP and a browser fingerprint are PII.
export type RequestContext = {
  browser: string;
  os: string;
  device: string;
  ip: string;
  time: Date;
};

// The subset of `Headers` read here, so the read-only headers from `headers()`
// fit as well as a plain `Headers`.
type RequestHeaders = Pick<Headers, "get">;

const UNKNOWN = "Unknown";

// No hosting-provider-specific headers: everything comes from the User-Agent,
// the standard X-Forwarded-For and the server clock.
export function readRequestContext(headers: RequestHeaders): RequestContext {
  const userAgentHeader = headers.get("user-agent");
  const { browser, os, device } = userAgentFromString(userAgentHeader ?? undefined);
  const browserVersion = browser.version?.split(".")[0];

  return {
    browser: browser.name
      ? [browser.name, browserVersion].filter(Boolean).join(" ")
      : `${UNKNOWN} browser`,
    os: os.name ?? `${UNKNOWN} OS`,
    // The parser leaves `type` undefined for desktop browsers; without a
    // User-Agent at all there's nothing to say.
    device: userAgentHeader ? (device.type ?? "desktop") : `${UNKNOWN} device`,
    ip: readClientIp(headers),
    time: new Date(),
  };
}

// The rightmost X-Forwarded-For entry is the one added by whatever sits
// directly in front of the app (Next itself sets it to the socket address when
// it's missing). Entries to its left are whatever the client sent, so they are
// never trusted.
function readClientIp(headers: RequestHeaders): string {
  const forwardedFor = headers.get("x-forwarded-for");
  const rightmost = forwardedFor?.split(",").at(-1)?.trim();
  return rightmost || UNKNOWN;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// e.g. "Chrome 131 on Windows (desktop) · IP 203.0.113.7 · 29 Sep 2026, 14:05 UTC".
// The time is always UTC, and labelled so, because the server doesn't know the
// reader's time zone. Formatted by hand: Intl's month abbreviations vary by
// ICU version (en-GB now writes "Sept").
export function formatRequestContext(context: RequestContext): string {
  const { time } = context;
  const pad = (value: number) => String(value).padStart(2, "0");
  const utcTime =
    `${time.getUTCDate()} ${MONTHS[time.getUTCMonth()]} ${time.getUTCFullYear()}, ` +
    `${pad(time.getUTCHours())}:${pad(time.getUTCMinutes())} UTC`;
  return `${context.browser} on ${context.os} (${context.device}) · IP ${context.ip} · ${utcTime}`;
}
