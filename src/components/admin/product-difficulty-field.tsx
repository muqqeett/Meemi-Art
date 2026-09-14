"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FormGrid, ToggleRow, controlInput, controlSelect, describedBy } from "@/components/admin/admin-form";
import {
  DIFFICULTY_DIMENSIONS,
  DIFFICULTY_DIMENSION_INFO,
  DIFFICULTY_WEIGHTS,
  MAX_TECHNIQUES,
  RATING_MAX,
  RATING_MIN,
  difficultyLevelFor,
  difficultyScoreTenths,
  formatEstimatedTime,
  formatTenths,
  hoursToMinutes,
  isValidEstimate,
  isValidRating,
  type DifficultyDimension,
} from "@/lib/difficulty/engine";
import { TECHNIQUES, TECHNIQUE_GROUP_LABELS, type TechniqueGroup, type TechniqueSlug } from "@/lib/difficulty/techniques";
import type { ProductDifficultyFormValues } from "@/lib/validations/admin";

/**
 * The product form's "Project difficulty" section.
 *
 * Holds the six ratings, the time estimate (typed in hours, in half-hour
 * steps, held as minutes) and the techniques. The preview uses the same engine
 * the product page does, so what an admin sees is what shoppers will see — but
 * it is only a preview: the server validates the inputs and the score is
 * derived again from the saved ratings. No score is ever submitted.
 *
 * A saved rating is never removed from here. Switching it off hides it and
 * keeps every value, so switching it back on restores them.
 */

type DifficultyErrors = { message?: string } & Partial<Record<string, unknown>>;

function messageOf(errors: DifficultyErrors | undefined, key: string): string | undefined {
  const entry = errors?.[key] as { message?: string; root?: { message?: string } } | undefined;
  return entry?.message ?? entry?.root?.message;
}

const RATINGS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, index) => RATING_MIN + index);

const GROUPS = (Object.keys(TECHNIQUE_GROUP_LABELS) as TechniqueGroup[]).map((group) => ({
  group,
  label: TECHNIQUE_GROUP_LABELS[group],
  techniques: TECHNIQUES.filter((technique) => technique.group === group),
}));

function hoursText(minutes: number): string {
  return Number.isFinite(minutes) && minutes > 0 ? String(minutes / 60) : "";
}

export function ProductDifficultyField({
  value,
  saved,
  onChange,
  errors,
}: {
  value: ProductDifficultyFormValues | null;
  /** True when the product already has a saved rating. */
  saved: boolean;
  onChange: (next: ProductDifficultyFormValues | null) => void;
  errors?: DifficultyErrors;
}) {
  const [hours, setHours] = useState(() => ({
    min: value ? hoursText(value.minutesMin) : "",
    max: value ? hoursText(value.minutesMax) : "",
  }));

  if (!value) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Not rated. Nothing about difficulty appears on the product page until a rating is added and switched on.
        </p>
        <Button
          type="button"
          variant="outline"
          size="pillSm"
          onClick={() =>
            onChange({
              enabled: true,
              stitches: Number.NaN,
              construction: Number.NaN,
              shaping: Number.NaN,
              colorwork: Number.NaN,
              assembly: Number.NaN,
              patternReading: Number.NaN,
              minutesMin: Number.NaN,
              minutesMax: Number.NaN,
              techniques: [],
            })
          }
        >
          Add a difficulty rating
        </Button>
      </div>
    );
  }

  const current = value;
  const update = (patch: Partial<ProductDifficultyFormValues>) => onChange({ ...current, ...patch });

  const ratingsComplete = DIFFICULTY_DIMENSIONS.every((dimension) => isValidRating(current[dimension]));
  const scoreTenths = ratingsComplete ? difficultyScoreTenths(current) : null;
  const level = scoreTenths !== null ? difficultyLevelFor(scoreTenths).label : null;
  const time = isValidEstimate(current.minutesMin, current.minutesMax)
    ? formatEstimatedTime(current.minutesMin, current.minutesMax)
    : null;

  const selected = new Set<string>(current.techniques);
  const atLimit = selected.size >= MAX_TECHNIQUES;

  function setHoursField(which: "min" | "max", raw: string) {
    setHours((previous) => ({ ...previous, [which]: raw }));
    const minutes = raw.trim() === "" ? Number.NaN : (hoursToMinutes(Number(raw)) ?? Number.NaN);
    update(which === "min" ? { minutesMin: minutes } : { minutesMax: minutes });
  }

  function toggleTechnique(slug: TechniqueSlug, checked: boolean) {
    const next = checked ? [...current.techniques, slug] : current.techniques.filter((entry) => entry !== slug);
    update({ techniques: next });
  }

  const techniqueError = messageOf(errors, "techniques");

  return (
    <div className="space-y-6">
      <ToggleRow
        htmlFor="pd-enabled"
        label="Show on the product page"
        description="Turning this off hides the rating from shoppers. Every value below is kept, so it can be switched back on."
        control={
          <Checkbox
            id="pd-enabled"
            checked={current.enabled}
            onCheckedChange={(checked) => update({ enabled: checked === true })}
          />
        }
      />

      <div
        aria-live="polite"
        className="rounded-md border border-border bg-surface-alt/40 px-4 py-3 text-sm"
      >
        {scoreTenths !== null && level ? (
          <p>
            <span className="font-semibold text-foreground tabular-nums">{formatTenths(scoreTenths)} / 10</span>
            <span className="text-muted-foreground"> · {level}</span>
            {time && <span className="text-muted-foreground"> · {time}</span>}
          </p>
        ) : (
          <p className="text-muted-foreground">Choose all six ratings to see the calculated score.</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          A preview. The score is calculated again from the saved ratings — it is never typed or stored.
        </p>
      </div>

      <FormGrid>
        {DIFFICULTY_DIMENSIONS.map((dimension: DifficultyDimension) => {
          const id = `pd-${dimension}`;
          const info = DIFFICULTY_DIMENSION_INFO[dimension];
          const error = messageOf(errors, dimension);
          return (
            <Field
              key={dimension}
              id={id}
              label={`${info.label} (${DIFFICULTY_WEIGHTS[dimension]}%)`}
              hint={info.guide}
              error={error}
            >
              <select
                id={id}
                value={isValidRating(current[dimension]) ? String(current[dimension]) : ""}
                onChange={(event) =>
                  update({ [dimension]: event.target.value ? Number(event.target.value) : Number.NaN })
                }
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy(id, { hint: true, error })}
                className={controlSelect}
              >
                <option value="">Choose…</option>
                {RATINGS.map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}
                  </option>
                ))}
              </select>
            </Field>
          );
        })}
      </FormGrid>

      <FormGrid>
        <Field
          id="pd-hours-min"
          label="Estimated time — from (hours)"
          hint="Half-hour steps, e.g. 1.5"
          error={messageOf(errors, "minutesMin")}
        >
          <Input
            id="pd-hours-min"
            type="number"
            inputMode="decimal"
            min={0.5}
            max={200}
            step={0.5}
            value={hours.min}
            onChange={(event) => setHoursField("min", event.target.value)}
            aria-invalid={Boolean(messageOf(errors, "minutesMin"))}
            aria-describedby={describedBy("pd-hours-min", { hint: true, error: messageOf(errors, "minutesMin") })}
            className={controlInput}
          />
        </Field>
        <Field
          id="pd-hours-max"
          label="Estimated time — to (hours)"
          hint="The same as the minimum for a single figure"
          error={messageOf(errors, "minutesMax")}
        >
          <Input
            id="pd-hours-max"
            type="number"
            inputMode="decimal"
            min={0.5}
            max={200}
            step={0.5}
            value={hours.max}
            onChange={(event) => setHoursField("max", event.target.value)}
            aria-invalid={Boolean(messageOf(errors, "minutesMax"))}
            aria-describedby={describedBy("pd-hours-max", { hint: true, error: messageOf(errors, "minutesMax") })}
            className={controlInput}
          />
        </Field>
      </FormGrid>

      <fieldset className="space-y-3" aria-describedby="pd-techniques-count">
        <legend className="text-[0.8125rem] font-medium text-foreground">Techniques</legend>
        <p id="pd-techniques-count" className="text-xs text-muted-foreground">
          {selected.size} of {MAX_TECHNIQUES} chosen
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.group} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">{group.label}</p>
              {group.techniques.map((technique) => {
                const id = `pd-technique-${technique.slug}`;
                const checked = selected.has(technique.slug);
                return (
                  <label key={technique.slug} htmlFor={id} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      id={id}
                      checked={checked}
                      disabled={!checked && atLimit}
                      onCheckedChange={(next) => toggleTechnique(technique.slug, next === true)}
                    />
                    {technique.label}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
        {techniqueError && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {techniqueError}
          </p>
        )}
      </fieldset>

      {!saved && (
        <Button type="button" variant="ghost" size="pillSm" onClick={() => onChange(null)}>
          Discard this rating
        </Button>
      )}
    </div>
  );
}
