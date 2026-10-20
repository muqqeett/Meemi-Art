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
    // Both subsystems resolve the origin through `lib/app-url.ts`. Reporting
    // each one separately is what lets the cases below assert they agree
    // rather than assuming it from the shared import.
    const { emailConfig } = await import("../src/lib/email/config");
    const provider = getPaymentProvider();
    process.stdout.write(
      JSON.stringify({
        driver: paymentConfig.driver,
        env: paymentConfig.paddle.env,
        apiBase: paymentConfig.paddle.apiBase,
        appUrl: paymentConfig.appUrl,
        emailAppUrl: emailConfig.appUrl,
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
  const FAKE_TOKEN = "live_probe_not_a_real_token_0000";

  /**
   * Every variable a case might care about, blanked.
   *
   * Child processes inherit the developer's `.env`; anything not listed here
   * leaks in and makes a result depend on whose machine ran it.
   *
   * `undefined`, not `""`: Node omits undefined values when it builds the
   * child's environment, so these are genuinely absent. The difference matters
   * for the URL chain, which is `??` — an empty string is not nullish, so it
   * would win the chain and resolve the app URL to "" instead of falling
   * through. See the `NEXT_PUBLIC_APP_URL=""` case below.
   *
   * Omitting them is only half the job: every child starts with
   * `import "dotenv/config"`, which would refill them straight from the
   * developer's `.env`. `NO_DOTENV` points that import at a path which does
   * not exist, so a child sees exactly the variables a case sets and nothing
   * else.
   */
  const NO_DOTENV = `${__filename}.no-such-env-file`;

  const CLEARED: Record<string, string | undefined> = {
    DOTENV_CONFIG_PATH: NO_DOTENV,
    PAYMENT_PROVIDER: undefined,
    PADDLE_ENV: undefined,
    PADDLE_API_KEY: undefined,
    PADDLE_WEBHOOK_SECRET: undefined,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: undefined,
    NEXT_PUBLIC_APP_URL: undefined,
    SITE_URL: undefined,
  };

  function probe(env: Record<string, string>) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--conditions=react-server", __filename],
      {
        env: {
          ...process.env,
          __PADDLE_ENV_PROBE: "1",
          ...CLEARED,
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
      appUrl: string;
      emailAppUrl: string;
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
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: FAKE_TOKEN,
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
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: FAKE_TOKEN,
  });
  check("a missing webhook secret refuses checkout", noSecret.isConfigured === false);

  const typo = probe({
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "Production ",
    PADDLE_API_KEY: FAKE_KEY,
    PADDLE_WEBHOOK_SECRET: FAKE_SECRET,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: FAKE_TOKEN,
  });
  check(
    "a malformed PADDLE_ENV falls back to sandbox, never to live money",
    typo.apiBase === "https://sandbox-api.paddle.com",
    typo.env,
  );

  console.log("\n=== site URL resolution ===");

  // `paymentConfig.appUrl` is the base for every return URL handed to Paddle,
  // so these cases pin the contract the operator-facing checker has to agree
  // with: NEXT_PUBLIC_APP_URL first, then SITE_URL, then a localhost default.
  const siteOnly = probe({ SITE_URL: "https://meemiart.com" });
  check("SITE_URL supplies the app URL", siteOnly.appUrl === "https://meemiart.com", siteOnly.appUrl);

  const trailing = probe({ SITE_URL: "https://meemiart.com/" });
  check("a trailing slash is normalised away", trailing.appUrl === "https://meemiart.com", trailing.appUrl);

  const neither = probe({});
  check(
    "with neither variable set it falls back to localhost",
    neither.appUrl === "http://localhost:3000",
    neither.appUrl,
  );

  const precedence = probe({
    NEXT_PUBLIC_APP_URL: "https://preview.meemiart.com",
    SITE_URL: "https://meemiart.com",
  });
  check(
    "NEXT_PUBLIC_APP_URL wins over SITE_URL",
    precedence.appUrl === "https://preview.meemiart.com",
    precedence.appUrl,
  );

  // The runtime does not validate the string — it only strips trailing
  // slashes — so a typo reaches `appUrl` verbatim. That is precisely why the
  // checker has to reject it before a deploy rather than after.
  const garbage = probe({ SITE_URL: "meemiart.com" });
  check(
    "an invalid URL is passed through unvalidated by the runtime",
    garbage.appUrl === "meemiart.com",
    garbage.appUrl,
  );

  // A variable that exists but was left blank is what a hosting platform
  // writes, and an empty string is not nullish — under the old `??` chain it
  // won and collapsed every return URL to a bare path while a valid SITE_URL
  // sat behind it. These four cases pin the fall-through.
  const blankAppUrl = probe({ NEXT_PUBLIC_APP_URL: "", SITE_URL: "https://meemiart.com" });
  check(
    "a blank NEXT_PUBLIC_APP_URL falls through to SITE_URL",
    blankAppUrl.appUrl === "https://meemiart.com",
    blankAppUrl.appUrl,
  );

  const spacesAppUrl = probe({ NEXT_PUBLIC_APP_URL: "   ", SITE_URL: "https://meemiart.com" });
  check(
    "a whitespace-only NEXT_PUBLIC_APP_URL falls through to SITE_URL",
    spacesAppUrl.appUrl === "https://meemiart.com",
    spacesAppUrl.appUrl,
  );

  const bothBlank = probe({ NEXT_PUBLIC_APP_URL: "", SITE_URL: "" });
  check(
    "both blank falls all the way through to the localhost default",
    bothBlank.appUrl === "http://localhost:3000",
    bothBlank.appUrl,
  );

  const bothWhitespace = probe({ NEXT_PUBLIC_APP_URL: " ", SITE_URL: "\t" });
  check(
    "both whitespace-only behaves the same as both blank",
    bothWhitespace.appUrl === "http://localhost:3000",
    bothWhitespace.appUrl,
  );

  const padded = probe({ SITE_URL: "  https://meemiart.com  " });
  check(
    "surrounding whitespace is trimmed off a real value",
    padded.appUrl === "https://meemiart.com",
    padded.appUrl,
  );

  const blankBeatenByValue = probe({
    NEXT_PUBLIC_APP_URL: "https://preview.meemiart.com",
    SITE_URL: "",
  });
  check(
    "a valid NEXT_PUBLIC_APP_URL still wins over a blank SITE_URL",
    blankBeatenByValue.appUrl === "https://preview.meemiart.com",
    blankBeatenByValue.appUrl,
  );

  console.log("\n=== email links resolve to the same origin as payment returns ===");

  // Before `lib/app-url.ts` these were two separate `??` chains with the same
  // bug. A customer could be returned to one origin by Paddle and sent a
  // receipt linking to another — or, with a blank variable, to a bare path in
  // their inbox. Each case asserts the resolved value *and* that the two
  // subsystems agree on it.
  const emailCases: [string, Record<string, string>, string][] = [
    ["SITE_URL supplies both", { SITE_URL: "https://meemiart.com" }, "https://meemiart.com"],
    [
      "a blank NEXT_PUBLIC_APP_URL falls through to SITE_URL",
      { NEXT_PUBLIC_APP_URL: "", SITE_URL: "https://meemiart.com" },
      "https://meemiart.com",
    ],
    [
      "a whitespace-only NEXT_PUBLIC_APP_URL falls through to SITE_URL",
      { NEXT_PUBLIC_APP_URL: "   ", SITE_URL: "https://meemiart.com" },
      "https://meemiart.com",
    ],
    [
      "a valid NEXT_PUBLIC_APP_URL takes precedence",
      { NEXT_PUBLIC_APP_URL: "https://preview.meemiart.com", SITE_URL: "https://meemiart.com" },
      "https://preview.meemiart.com",
    ],
    [
      "both blank falls through to the localhost default",
      { NEXT_PUBLIC_APP_URL: "", SITE_URL: "" },
      "http://localhost:3000",
    ],
    [
      "both whitespace-only behaves the same as both blank",
      { NEXT_PUBLIC_APP_URL: " ", SITE_URL: "\t" },
      "http://localhost:3000",
    ],
    [
      "a trailing slash is normalised away for both",
      { SITE_URL: "https://meemiart.com/" },
      "https://meemiart.com",
    ],
  ];

  for (const [label, env, expected] of emailCases) {
    const result = probe(env);
    check(`email: ${label}`, result.emailAppUrl === expected, result.emailAppUrl);
    check(
      `  …and payment resolution agrees`,
      result.emailAppUrl === result.appUrl,
      { email: result.emailAppUrl, payment: result.appUrl },
    );
  }

  console.log("\n=== the operator-facing checker agrees with the runtime ===");

  // These run `check-paddle-env.ts` itself. The bug this guards against was in
  // the checker, not the config: it asserted NEXT_PUBLIC_SITE_URL, which
  // nothing in src/ reads, so it failed on a correctly configured deployment.
  const CHECKER = __filename.replace(/test-paddle-env\.ts$/, "check-paddle-env.ts");

  function checkerSiteUrlRow(env: Record<string, string>) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--conditions=react-server", CHECKER],
      { env: { ...process.env, ...CLEARED, ...env }, encoding: "utf8" },
    );
    const line = (result.stdout ?? "").split("\n").find((l) => l.includes("Site URL")) ?? "";
    return { ok: line.includes("✓"), line: line.trim(), exitCode: result.status };
  }

  const liveEnv = {
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "production",
    PADDLE_API_KEY: FAKE_KEY,
    PADDLE_WEBHOOK_SECRET: FAKE_SECRET,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: FAKE_TOKEN,
    PAYMENT_CURRENCY: "USD",
  };

  const viaSiteUrl = checkerSiteUrlRow({ ...liveEnv, SITE_URL: "https://meemiart.com" });
  check("checker accepts SITE_URL", viaSiteUrl.ok, viaSiteUrl.line);
  check(
    "and the whole check passes on a complete live config",
    viaSiteUrl.exitCode === 0,
    viaSiteUrl.exitCode,
  );

  const viaAppUrl = checkerSiteUrlRow({
    ...liveEnv,
    NEXT_PUBLIC_APP_URL: "https://preview.meemiart.com",
  });
  check("checker accepts NEXT_PUBLIC_APP_URL on its own", viaAppUrl.ok, viaAppUrl.line);
  check(
    "and names it as the source",
    /NEXT_PUBLIC_APP_URL/.test(viaAppUrl.line),
    viaAppUrl.line,
  );

  const missingUrl = checkerSiteUrlRow(liveEnv);
  check("checker rejects the localhost fallback", !missingUrl.ok, missingUrl.line);
  check("and tells the operator to set SITE_URL", /SITE_URL/.test(missingUrl.line), missingUrl.line);

  const badUrl = checkerSiteUrlRow({ ...liveEnv, SITE_URL: "meemiart.com" });
  check("checker rejects a URL with no scheme", !badUrl.ok, badUrl.line);

  const insecureUrl = checkerSiteUrlRow({ ...liveEnv, SITE_URL: "http://meemiart.com" });
  check("checker rejects a plain-http return URL", !insecureUrl.ok, insecureUrl.line);

  // The checker must name the variable the runtime actually used, not the one
  // that merely exists — otherwise its explanation sends the operator to edit
  // the wrong setting.
  const blankAppUrlRow = checkerSiteUrlRow({
    ...liveEnv,
    NEXT_PUBLIC_APP_URL: "",
    SITE_URL: "https://meemiart.com",
  });
  check("checker accepts a blank NEXT_PUBLIC_APP_URL behind a valid SITE_URL", blankAppUrlRow.ok, blankAppUrlRow.line);
  check(
    "and credits SITE_URL, not the blank variable",
    /from SITE_URL/.test(blankAppUrlRow.line),
    blankAppUrlRow.line,
  );

  const spacesAppUrlRow = checkerSiteUrlRow({
    ...liveEnv,
    NEXT_PUBLIC_APP_URL: "   ",
    SITE_URL: "https://meemiart.com",
  });
  check(
    "checker credits SITE_URL over a whitespace-only NEXT_PUBLIC_APP_URL",
    spacesAppUrlRow.ok && /from SITE_URL/.test(spacesAppUrlRow.line),
    spacesAppUrlRow.line,
  );

  const bothBlankRow = checkerSiteUrlRow({ ...liveEnv, NEXT_PUBLIC_APP_URL: "", SITE_URL: "" });
  check("checker rejects both-blank and names SITE_URL", !bothBlankRow.ok && /SITE_URL/.test(bothBlankRow.line), bothBlankRow.line);

  // `looksLikeProduction` asks whether `appUrl` is a localhost origin, so the
  // fall-through above changes what an origin-less production deploy looks
  // like: blank used to resolve to "", which is not localhost and therefore
  // read as production. It now resolves to the localhost default, exactly as
  // an entirely unset SITE_URL always has. These two assert that blank and
  // unset agree — the inconsistency, not the strictness, was the bug.
  const unsetOrigin = probe({ NODE_ENV: "production" });
  const blankOrigin = probe({ NODE_ENV: "production", SITE_URL: "" });
  check(
    "an origin-less production deploy is classified the same whether SITE_URL is blank or unset",
    blankOrigin.productionDeployment === unsetOrigin.productionDeployment,
    { blank: blankOrigin.productionDeployment, unset: unsetOrigin.productionDeployment },
  );
  check(
    "and an explicitly configured production origin is still detected",
    probe({ NODE_ENV: "production", SITE_URL: "https://meemiart.com" }).productionDeployment === true,
  );

  console.log("\n=== production safety: never fall back to the fake driver ===");

  // The dangerous case: a real deployment where the Paddle variables were
  // forgotten. The built-in sandbox driver would otherwise complete orders and
  // grant downloads for free while every dashboard looked healthy.
  const forgotten = probe({
    NODE_ENV: "production",
    SITE_URL: "https://meemiart.com",
  });
  check("a production deployment is detected", forgotten.productionDeployment === true);
  check(
    "the sandbox driver refuses to serve production",
    forgotten.providerName === "sandbox" && forgotten.isConfigured === false,
  );
  check("and the reason names PAYMENT_PROVIDER", /PAYMENT_PROVIDER/.test(forgotten.safetyProblem ?? ""));

  const halfLive = probe({
    NODE_ENV: "production",
    SITE_URL: "https://meemiart.com",
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
    SITE_URL: "https://meemiart.com",
    PAYMENT_PROVIDER: "paddle",
    PADDLE_ENV: "production",
    PADDLE_API_KEY: FAKE_KEY,
    PADDLE_WEBHOOK_SECRET: FAKE_SECRET,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: FAKE_TOKEN,
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
