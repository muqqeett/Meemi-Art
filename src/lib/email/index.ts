import "server-only";

/**
 * Public surface of the email system.
 *
 * Everything here is server-only. Call sites import from this module rather
 * than reaching for the Resend SDK directly, so the transport stays swappable
 * and every send goes through the logging and dedupe path.
 */

export { sendEmail, withinRateLimit, isEmailConfigured } from "@/lib/email/email-service";
export type { SendResult } from "@/lib/email/email-service";
export { describeEmail, emailConfig, emailUrl } from "@/lib/email/config";
export { EMAIL_TEMPLATES } from "@/lib/email/types";
export type { EmailTemplate, EmailMessage } from "@/lib/email/types";

export {
  verifyEmailTemplate,
  welcomeTemplate,
  resetPasswordTemplate,
  passwordChangedTemplate,
} from "@/lib/email/templates/auth";

export { testEmailTemplate } from "@/lib/email/templates/test";

export {
  purchaseReadyTemplate,
  adminNewOrderTemplate,
  orderRefundedTemplate,
} from "@/lib/email/templates/orders";
export type { OrderEmailData, OrderEmailLine } from "@/lib/email/templates/orders";
