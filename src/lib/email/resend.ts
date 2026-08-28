import "server-only";

import { Resend } from "resend";

import { emailConfig } from "@/lib/email/config";
import type { EmailMessage, EmailProvider, SendOutcome } from "@/lib/email/types";

/**
 * Resend transport.
 *
 * The API key is read from the server environment and never crosses the
 * client boundary. The client is constructed lazily so importing this module
 * without credentials is harmless.
 */
class ResendProvider implements EmailProvider {
  readonly name = "Resend";

  get isConfigured(): boolean {
    return Boolean(emailConfig.apiKey && emailConfig.from);
  }

  async send(message: EmailMessage): Promise<SendOutcome> {
    if (!this.isConfigured) {
      return { ok: false, error: "Resend is not configured." };
    }

    try {
      const client = new Resend(emailConfig.apiKey);

      const { data, error } = await client.emails.send({
        from: emailConfig.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo ?? emailConfig.replyTo ?? undefined,
      });

      if (error) {
        return { ok: false, error: error.message || "Resend rejected the message." };
      }

      return { ok: true, providerId: data?.id ?? null };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown transport error.",
      };
    }
  }
}

export const resendProvider = new ResendProvider();
