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
    <section
      aria-labelledby="pdp-difficulty-heading"
      data-meemi-anchor="difficulty"
      className="font-figtree flex flex-col gap-4 rounded-[20px] bg-plum-100/60 p-4"
    >
      <h2
        id="pdp-difficulty-heading"
        className="text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text"
      >
        Project difficulty
      </h2>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p className="flex items-baseline gap-1.5">
          <span className="pl-display text-[32px] leading-[36px] tracking-[-0.015em] tabular-nums">
            {result.score}
          </span>
          <span className="text-sm font-medium text-pl-muted">/ 10</span>
        </p>
        <p className="rounded-full bg-plum-500 px-2.5 py-1 text-[13px] leading-4 font-bold text-pl-on-dark">
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
                ? "h-2 flex-1 rounded-full bg-plum-500"
                : "h-2 flex-1 rounded-full bg-pl-line"
            }
          />
        ))}
      </div>

      <dl className="flex flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-pl-line py-3">
          <dt className="text-sm leading-[22px] text-pl-muted">Estimated time</dt>
          <dd className="text-base leading-[22px] font-bold text-pl-text">{result.estimatedTime}</dd>
        </div>

        <div className="flex flex-col gap-2 border-t border-pl-line py-3">
          <dt className="text-sm leading-[22px] text-pl-muted">What makes it challenging</dt>
          <dd>
            {result.challenges.length > 0 ? (
              <ul className="flex flex-col gap-1 text-base leading-[26px] text-pl-text">
                {result.challenges.map((challenge) => (
                  <li key={challenge} className="flex gap-2.5">
                    <span aria-hidden className="text-plum-500">
                      —
                    </span>
                    {challenge}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base leading-[26px] text-pl-text">No particularly demanding steps.</p>
            )}
          </dd>
        </div>

        {result.techniques.length > 0 && (
          <div data-meemi-anchor="techniques" className="flex flex-col gap-2 border-t border-pl-line py-3 last:pb-0">
            <dt className="text-sm leading-[22px] text-pl-muted">Techniques</dt>
            <dd>
              <ul className="flex flex-wrap gap-x-2 gap-y-1 text-base leading-[26px] text-pl-text">
                {result.techniques.map((technique, index) => (
                  <li key={technique.slug}>
                    {technique.label}
                    {index < result.techniques.length - 1 && (
                      <span aria-hidden className="ml-2 text-pl-muted">
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
        <summary className="pl-focus w-fit cursor-pointer rounded-sm text-sm leading-[22px] font-bold text-pl-text underline-offset-4 hover:underline">
          How this score is worked out
        </summary>

        <div className="mt-4 flex flex-col gap-4">
          <dl className="flex flex-col gap-2.5">
            {result.breakdown.map((row) => (
              <div key={row.dimension} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5">
                <dt className="text-sm text-pl-text">
                  {row.label}
                  <span className="text-pl-muted"> · {DIFFICULTY_WEIGHTS[row.dimension]}%</span>
                </dt>
                <dd className="text-sm font-bold text-pl-text tabular-nums">{row.rating} / 10</dd>
                <div aria-hidden className="col-span-2 h-1 overflow-hidden rounded-full bg-pl-line">
                  <div className="h-full rounded-full bg-plum-500" style={{ width: `${row.rating * 10}%` }} />
                </div>
              </div>
            ))}
          </dl>
          <p className="text-sm leading-[22px] text-pl-muted">
            Six ratings, weighted towards stitches, construction and shaping. A pattern is never scored more
            than two points below its most demanding part.
          </p>
        </div>
      </details>
    </section>
  );
}
