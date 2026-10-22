import "server-only";

export type Email = {
  to: string;
  subject: string;
  text: string;
};

// The seam for sending email: Resend in production, a fake in tests.
export interface EmailSender {
  send(email: Email): Promise<void>;
}

export type ResendConfig = {
  apiKey: string;
  // A sender on a domain verified in Resend, e.g. "UPresent <no-reply@…>".
  from: string;
};

export class EmailDeliveryError extends Error {
  constructor(status: number, reason: string) {
    super(`Resend rejected the email (HTTP ${status}: ${reason}).`);
    this.name = "EmailDeliveryError";
  }
}

const RESEND_SEND_EMAIL_URL = "https://api.resend.com/emails";

// Calls Resend's REST API directly rather than through its SDK: sending one
// email is a single POST, which `fetch` already does. `fetchEmail` is
// injectable so tests don't reach the network.
export function createResendEmailSender(
  config: ResendConfig,
  fetchEmail: typeof fetch = fetch,
): EmailSender {
  return {
    async send(email: Email): Promise<void> {
      const response = await fetchEmail(RESEND_SEND_EMAIL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [email.to],
          subject: email.subject,
          text: email.text,
        }),
      });
      if (!response.ok) {
        // Resend's error `name` (e.g. "validation_error") says what went wrong
        // without echoing the recipient, which is PII (CODING_STANDARDS §10).
        const body: unknown = await response.json().catch(() => null);
        const reason =
          typeof body === "object" &&
          body !== null &&
          "name" in body &&
          typeof body.name === "string"
            ? body.name
            : response.statusText;
        throw new EmailDeliveryError(response.status, reason);
      }
    },
  };
}

function readResendConfig(): ResendConfig {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be set to send email (see .env.example).");
  }
  return { apiKey, from };
}

// Reads its configuration when an email is sent rather than at import, so
// modules that import this still load (e.g. in tests) without the variables.
export const emailSender: EmailSender = {
  send: (email) => createResendEmailSender(readResendConfig()).send(email),
};
