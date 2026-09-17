import { DIFFICULTY_WEIGHTS, type DifficultyResult } from "@/lib/difficulty/engine";

/**
 * "Project difficulty" — in the information column, between the description
 * and "What you get".
 *
 * Everything here comes from `evaluatePublicDifficulty`, which derives the
 * score from the stored ratings. The block renders only for a product with an
 * enabled rating; for every other product the column is exactly as it was.
 *
 * Styled with the column's own vocabulary — the micro-caps label and hairlines
 * of "What you get", the display serif of the price — so it reads as part of
 * the page rather than a widget dropped onto it.
 *
 * The meter is never the only statement of difficulty: the score and level
 * are printed beside it, and the meter itself is a `role="meter"` with the
 * same sentence as its value text. The breakdown is a native `<details>`, so
 * it needs no JavaScript and works from the keyboard.
 */
export function PdpDifficulty({ result }: { result: DifficultyResult }) {
  const valueText = `${result.score} out of 10 — ${result.levelLabel}`;

  return (
    // `data-meemi-anchor`: where the product page's Meemi guide may offer to explain.
    <section aria-labelledby="pdp-difficulty-heading" data-meemi-anchor="difficulty" className="flex flex-col gap-5">
      <h2
        id="pdp-difficulty-heading"
        className="text-[0.6875rem] leading-none font-semibold tracking-[0.22em] text-pdp-label uppercase"
      >
        Project difficulty
      </h2>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-[2.25rem] leading-none font-semibold tracking-[-0.02em] text-pdp-title tabular-nums">
            {result.score}
          </span>
          <span className="text-sm font-medium text-pdp-meta">/ 10</span>
        </p>
        <p className="text-[0.6875rem] leading-none font-semibold tracking-[0.16em] text-brand-600 uppercase">
          {result.levelLabel}
        </p>
      </div>

      <div
        role="meter"
        aria-label="Project difficulty"
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={result.scoreTenths / 10}
        aria-valuetext={valueText}
        className="flex gap-1"
      >
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            aria-hidden
            className={
              index < result.meterSegments
                ? "h-1.5 flex-1 rounded-full bg-brand-600"
                : "h-1.5 flex-1 rounded-full bg-pdp-track"
            }
          />
        ))}
      </div>

      <dl className="flex flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-pdp-hairline/70 py-3 first:pt-0">
          <dt className="text-sm text-pdp-meta">Estimated time</dt>
          <dd className="text-[0.9375rem] font-medium text-pdp-title">{result.estimatedTime}</dd>
        </div>

        <div className="flex flex-col gap-2 border-b border-pdp-hairline/70 py-3">
          <dt className="text-sm text-pdp-meta">What makes it challenging</dt>
          <dd>
            {result.challenges.length > 0 ? (
              <ul className="flex flex-col gap-1 text-[0.9375rem] leading-[1.6] text-pdp-body">
                {result.challenges.map((challenge) => (
                  <li key={challenge} className="flex gap-2.5">
                    <span aria-hidden className="text-brand-400">
                      —
                    </span>
                    {challenge}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.9375rem] leading-[1.6] text-pdp-body">No particularly demanding steps.</p>
            )}
          </dd>
        </div>

        {result.techniques.length > 0 && (
          <div data-meemi-anchor="techniques" className="flex flex-col gap-2 border-b border-pdp-hairline/70 py-3 last:border-0">
            <dt className="text-sm text-pdp-meta">Techniques</dt>
            <dd>
              <ul className="flex flex-wrap gap-x-2 gap-y-1 text-[0.9375rem] leading-[1.6] text-pdp-body">
                {result.techniques.map((technique, index) => (
                  <li key={technique.slug}>
                    {technique.label}
                    {index < result.techniques.length - 1 && (
                      <span aria-hidden className="ml-2 text-pdp-label">
                        ·
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>

      <details className="group">
        <summary className="cursor-pointer text-[0.6875rem] font-semibold tracking-[0.14em] text-pdp-title uppercase underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          How this score is worked out
        </summary>

        <div className="mt-4 flex flex-col gap-4">
          <dl className="flex flex-col gap-2.5">
            {result.breakdown.map((row) => (
              <div key={row.dimension} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5">
                <dt className="text-sm text-pdp-body">
                  {row.label}
                  <span className="text-pdp-subtle"> · {DIFFICULTY_WEIGHTS[row.dimension]}%</span>
                </dt>
                <dd className="text-sm font-medium text-pdp-title tabular-nums">{row.rating} / 10</dd>
                <div aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-pdp-track">
                  <div className="h-full rounded-full bg-brand-400" style={{ width: `${row.rating * 10}%` }} />
                </div>
              </div>
            ))}
          </dl>
          <p className="text-sm leading-[1.6] text-pdp-meta">
            Six ratings, weighted towards stitches, construction and shaping. A pattern is never scored more
            than two points below its most demanding part.
          </p>
        </div>
      </details>
    </section>
  );
}
