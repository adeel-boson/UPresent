import { userAgentFromString } from "next/server";

import type { RequestContext } from "@/lib/auth/request-context";

// The subset of `Headers` read here, so the read-only headers from `headers()`
// fit as well as a plain `Headers`.
type RequestHeaders = Pick<Headers, "get">;

const UNKNOWN = "Unknown";

// Reads where this request came from, for the security emails the (auth)
// routes send. Lives in the route layer because it uses Next's User-Agent
// parser. No hosting-provider-specific headers: everything comes from the
// User-Agent, the standard X-Forwarded-For and the server clock.
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
