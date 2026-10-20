/**
 * Is Paddle actually configured, and does it agree with itself?
 *
 * Prints presence, length and environment *prefix* — never a credential value,
 * so the output is safe to paste anywhere, including into a chat. A masked key
 * is still a key; this deliberately shows neither the value nor a partial one.
 *
 * With `--ping` it makes one authenticated read-only call to Paddle to prove
 * the key is accepted. It never writes, never creates, and never charges.
 *
 *   npm run paddle:check
 *   npm run paddle:check -- --ping
 */
import "dotenv/config";

type Row = { label: string; ok: boolean | null; detail: string };

const rows: Row[] = [];
function row(label: string, ok: boolean | null, detail: string) {
  rows.push({ label, ok, detail });
}

/** Environment implied by a credential's prefix. Never returns the value. */
function prefixEnv(value: string, live: string, test: string): string {
  if (value.startsWith(live)) return "live";
  if (value.startsWith(test)) return "sandbox";
  return "unrecognised";
}

/**
 * Which variable supplied the site URL, named for the operator.
 *
 * Mirrors the order in `paymentConfig.appUrl`. The *value* is read from the
 * config module rather than recomputed here — this only reports where it came
 * from, so there is one place that resolves and one place that explains.
 */
function appUrlSource(): "NEXT_PUBLIC_APP_URL" | "SITE_URL" | null {
  // Trimmed, because the config chain skips blank and whitespace-only values.
  // Reporting on raw truthiness would name a variable the runtime ignored.
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) return "NEXT_PUBLIC_APP_URL";
  if (process.env.SITE_URL?.trim()) return "SITE_URL";
  return null;
}

/** An absolute https origin, which is what a live return URL has to be. */
function isLiveReturnUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function main() {
  const ping = process.argv.includes("--ping");

  const provider = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
  const env = (process.env.PADDLE_ENV ?? "").toLowerCase();
  const apiKey = process.env.PADDLE_API_KEY ?? "";
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  const currency = process.env.PAYMENT_CURRENCY ?? "";

  // The URL is read from the config module, not recomputed from the
  // environment. An earlier version of this script asserted
  // `NEXT_PUBLIC_SITE_URL`, which nothing in `src/` has ever read, so it
  // reported a failure on a correctly configured deployment. Importing the
  // real value makes that class of drift impossible: whatever checkout will
  // hand Paddle as a return URL is exactly what is checked here.
  const { paymentConfig } = await import("../src/lib/payments/config");
  const appUrl = paymentConfig.appUrl;
  const urlSource = appUrlSource();

  row("PAYMENT_PROVIDER", provider === "paddle", provider || "not set");
  row("PADDLE_ENV", env === "production", env || "not set");

  row(
    "PADDLE_API_KEY",
    apiKey.length > 0,
    apiKey ? `set, ${apiKey.length} chars, ${prefixEnv(apiKey, "pdl_live_", "pdl_sdbx_")} prefix` : "not set",
  );
  row(
    "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
    token.length > 0,
    token ? `set, ${token.length} chars, ${prefixEnv(token, "live_", "test_")} prefix` : "not set",
  );
  row(
    "PADDLE_WEBHOOK_SECRET",
    secret.length > 0,
    secret ? `set, ${secret.length} chars${secret.startsWith("pdl_ntfset_") ? "" : ", unexpected prefix"}` : "not set",
  );

  row("PAYMENT_CURRENCY", currency.length === 3, currency || "not set");

  // Falling through to the built-in default means neither variable is set, and
  // the default is `http://localhost:3000` — a return URL that strands every
  // real customer at the end of a payment. That is a failure here even though
  // it is the right answer on a laptop, because this script only ever asserts
  // production-shaped configuration (it already requires PADDLE_ENV=production).
  row(
    "Site URL",
    urlSource !== null && isLiveReturnUrl(appUrl),
    urlSource === null
      ? `${appUrl} — neither NEXT_PUBLIC_APP_URL nor SITE_URL is set; using the built-in default. Set SITE_URL.`
      : `${appUrl || "(empty)"} — from ${urlSource}`,
  );

  // The failure that produces a working-looking site that charges nobody.
  const keyEnv = apiKey ? prefixEnv(apiKey, "pdl_live_", "pdl_sdbx_") : null;
  const tokenEnv = token ? prefixEnv(token, "live_", "test_") : null;
  if (keyEnv && tokenEnv) {
    row(
      "key / token environments agree",
      keyEnv === tokenEnv,
      `api key is ${keyEnv}, client token is ${tokenEnv}`,
    );
  }
  if (env && tokenEnv) {
    const want = env === "production" ? "live" : "sandbox";
    row("PADDLE_ENV matches client token", tokenEnv === want, `PADDLE_ENV=${env}, token is ${tokenEnv}`);
  }

  console.log("\nPaddle configuration\n");
  let bad = 0;
  for (const r of rows) {
    const mark = r.ok === null ? "–" : r.ok ? "✓" : "✗";
    if (r.ok === false) bad++;
    console.log(`  ${mark}  ${r.label.padEnd(34)} ${r.detail}`);
  }

  if (ping) {
    console.log("\nLive API check (read-only)\n");
    if (!apiKey) {
      console.log("  ✗  skipped — PADDLE_API_KEY is not set");
      bad++;
    } else {
      const { paddleApi } = await import("../src/lib/payments/paddle-api");
      console.log(`  endpoint: ${paymentConfig.paddle.apiBase}`);
      const result = await paddleApi.check();
      if (result.ok) {
        console.log("  ✓  Paddle accepted the API key");
      } else {
        console.log(`  ✗  ${result.reason}`);
        bad++;
      }
    }
  }

  console.log(
    bad === 0
      ? "\nAll set. Nothing above is a secret — this output is safe to share.\n"
      : `\n${bad} item(s) need attention. No secret values were printed.\n`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
