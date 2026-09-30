// Where a request came from, for "Requested from" / "Changed from" lines in
// security emails. It goes into the email only: never store or log it
// (CODING_STANDARDS §10), since an IP and a browser fingerprint are PII.
// Read from the request in the route layer, by `readRequestContext` in
// `src/app/(auth)/_lib/`, so this module stays free of framework calls.
export type RequestContext = {
  browser: string;
  os: string;
  device: string;
  ip: string;
  time: Date;
};

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
