/**
 * Proves how the Paddle environment resolves, without any credentials.
 *
 * `lib/payments/config.ts` reads the environment once at module load, so each
 * case runs in its own child process with its own env. Nothing here is a
 * restatement of the rules — every value printed comes from importing the real
 * config module.
 *
 * This is what makes a live cutover checkable in advance: it shows that
 * `PADDLE_ENV=production` reaches `api.paddle.com` and never the sandbox host,
 * and that a live server paired with a `test_` token refuses instead of
 * silently producing a checkout the customer cannot complete.
 *
 *   npm run test:paddle-env
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";

/** Child mode: print what the real config resolved to, as JSON. */
if (process.env.__PADDLE_ENV_PROBE === "1") {
  const run = async () => {
    const { paymentConfig, productionSafetyProblem, productionDeployment } =
      await import("../src/lib/payments/config");
    const { getPaymentProvider } = await import("../src/lib/payments/payment-service");
    const provider = getPaymentProvider();
    process.stdout.write(
      JSON.stringify({
        driver: paymentConfig.driver,
        env: paymentConfig.paddle.env,
        apiBase: paymentConfig.paddle.apiBase,
        tokenEnv: paymentConfig.paddle.tokenEnv,
        envMismatch: paymentConfig.paddle.envMismatch,
        providerName: provider.name,
        isConfigured: provider.isConfigured,
        isTestMode: provider.isTestMode,
        productionDeployment,
        safetyProblem: productionSafetyProblem(),
      }),
    );
  };
  run();
} else {
  let failures = 0;
  function check(label: string, pass: boolean, detail?: unknown) {
    if (!pass) failures++;
    console.log(
      `  ${pass ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  → ${JSON.stringify(detail)}`}`,
    );
  }

  /** Values are structurally valid but entirely fake — nothing reaches Paddle. */
  const FAKE_KEY = "pdl_live_probe_not_a_real_key_000000";
  const FAKE_SECRET = "pdl_ntfset_probe_not_a_real_secret_000";

  function probe(env: Record<string, string>) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--conditions=react-server", __filename],
      {
        env: {
          ...process.env,
          __PADDLE_ENV_PROBE: "1",
          PAYMENT_PROVIDER: "",
          PADDLE_ENV: "",
          PADDLE_API_KEY: "",
          PADDLE_WEBHOOK_SECRET: "",
          NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
          ...env,
        },
        encoding: "utf8",
      },
    );
    if (result.status !== 0) {
      throw new Error(`probe failed: ${result.stderr?.slice(0, 500)}`);
    }
    return JSON.parse(result.stdout) as {
      driver: string;
      env: string;
      apiBase: string;
      tokenEnv: string;
      envMismatch: boolean;
      providerName: string;
      isConfigured: boolean;
      isTestMode: boolean;
      productionDeployment: boolean;
      safetyProblem: string | null;
    };
  }

  console.log("\n=== default: nothing configured ===");
  const bare = probe({});
  check("defaults to the local sandbox driver", bare.providerName === "sandbox", bare.driver);
  check("defaults to the sandbox API base", bare.apiBase === "https://sandbox-api.paddle.com");

  console.log("\n=== PADDLE_ENV=production ===");
  const live = probe({
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "production",
    PADDLE_API_KEY: FAKE_KEY,
    PADDLE_WEBHOOK_SECRET: FAKE_SECRET,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_probe_not_a_real_token_0000",
  });
  check("uses the live API endpoint", live.apiBase === "https://api.paddle.com", live.apiBase);
  check("never uses the sandbox endpoint", !live.apiBase.includes("sandbox"));
  check("reports the Paddle driver", live.providerName === "paddle");
  check("is no longer test mode", live.isTestMode === false);
  check("is configured", live.isConfigured === true);
  check("token env agrees with the server", live.envMismatch === false, live.tokenEnv);

  console.log("\n=== misconfiguration guards ===");
  const mismatch = probe({
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "production",
    PADDLE_API_KEY: FAKE_KEY,
    PADDLE_WEBHOOK_SECRET: FAKE_SECRET,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_probe_not_a_real_token_0000",
  });
  check("live server + test_ token is detected", mismatch.envMismatch === true);
  check("and checkout refuses rather than breaking", mismatch.isConfigured === false);

  const noToken = probe({
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "production",
    PADDLE_API_KEY: FAKE_KEY,
    PADDLE_WEBHOOK_SECRET: FAKE_SECRET,
  });
  check("a missing client token refuses checkout", noToken.isConfigured === false);

  const noSecret = probe({
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "production",
    PADDLE_API_KEY: FAKE_KEY,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_probe_not_a_real_token_0000",
  });
  check("a missing webhook secret refuses checkout", noSecret.isConfigured === false);

  const typo = probe({
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "Production ",
    PADDLE_API_KEY: FAKE_KEY,
    PADDLE_WEBHOOK_SECRET: FAKE_SECRET,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_probe_not_a_real_token_0000",
  });
  check(
    "a malformed PADDLE_ENV falls back to sandbox, never to live money",
    typo.apiBase === "https://sandbox-api.paddle.com",
    typo.env,
  );

  console.log("\n=== production safety: never fall back to the fake driver ===");

  // The dangerous case: a real deployment where the Paddle variables were
  // forgotten. The built-in sandbox driver would otherwise complete orders and
  // grant downloads for free while every dashboard looked healthy.
  const forgotten = probe({
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://meemiart.com",
  });
  check("a production deployment is detected", forgotten.productionDeployment === true);
  check(
    "the sandbox driver refuses to serve production",
    forgotten.providerName === "sandbox" && forgotten.isConfigured === false,
  );
  check("and the reason names PAYMENT_PROVIDER", /PAYMENT_PROVIDER/.test(forgotten.safetyProblem ?? ""));

  const halfLive = probe({
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://meemiart.com",
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "production",
    PADDLE_API_KEY: FAKE_KEY,
    // webhook secret and client token deliberately absent
  });
  check(
    "incomplete live config refuses checkout rather than half-working",
    halfLive.isConfigured === false,
  );
  check(
    "and names the missing variables",
    /PADDLE_WEBHOOK_SECRET/.test(halfLive.safetyProblem ?? "") &&
      /NEXT_PUBLIC_PADDLE_CLIENT_TOKEN/.test(halfLive.safetyProblem ?? ""),
    halfLive.safetyProblem,
  );

  const fullyLive = probe({
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://meemiart.com",
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "production",
    PADDLE_API_KEY: FAKE_KEY,
    PADDLE_WEBHOOK_SECRET: FAKE_SECRET,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_probe_not_a_real_token_0000",
  });
  check("a complete live config has no safety problem", fullyLive.safetyProblem === null);
  check("and is configured", fullyLive.isConfigured === true);
  check("and uses the live endpoint", fullyLive.apiBase === "https://api.paddle.com");

  const localDev = probe({});
  check(
    "local development is unaffected — sandbox driver still usable",
    localDev.productionDeployment === false && localDev.isConfigured === true,
  );

  console.log(
    failures === 0
      ? "\nAll Paddle environment checks passed.\n"
      : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}
