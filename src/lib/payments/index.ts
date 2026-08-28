import "server-only";

/**
 * Public surface of the payment system.
 *
 * Call sites import from here rather than reaching for a driver, so the
 * provider stays swappable and every state change goes through the verified
 * webhook path in `payment-service`.
 */

export { applyEvent, getPaymentProvider } from "@/lib/payments/payment-service";
export type { ApplyResult } from "@/lib/payments/payment-service";
export { paymentConfig, paymentUrl } from "@/lib/payments/config";
export { describePayments } from "@/lib/payments/describe";
export type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  VerifiedEvent,
} from "@/lib/payments/types";
