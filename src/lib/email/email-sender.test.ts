import { describe, expect, it, vi } from "vitest";

import { createResendEmailSender, EmailDeliveryError } from "@/lib/email/email-sender";

const CONFIG = { apiKey: "re_test_key", from: "UPresent <no-reply@upresent.example>" };

const EMAIL = {
  to: "admin@springfield.example",
  subject: "Verify your email",
  text: "Open this link.",
};

describe("createResendEmailSender", () => {
  it("posts the email to Resend's send-email endpoint with the API key", async () => {
    const fetchEmail = vi.fn<typeof fetch>(async () => Response.json({ id: "email-1" }));

    await createResendEmailSender(CONFIG, fetchEmail).send(EMAIL);

    expect(fetchEmail).toHaveBeenCalledTimes(1);
    const [url, init] = fetchEmail.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer re_test_key");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "UPresent <no-reply@upresent.example>",
      to: ["admin@springfield.example"],
      subject: "Verify your email",
      text: "Open this link.",
    });
  });

  it("throws when Resend rejects the email", async () => {
    const fetchEmail = vi.fn<typeof fetch>(async () =>
      Response.json(
        { statusCode: 403, name: "validation_error", message: "Domain not verified" },
        { status: 403 },
      ),
    );

    await expect(createResendEmailSender(CONFIG, fetchEmail).send(EMAIL)).rejects.toBeInstanceOf(
      EmailDeliveryError,
    );
  });
});
