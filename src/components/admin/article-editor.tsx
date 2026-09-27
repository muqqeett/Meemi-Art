"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Save, AlertCircle, HelpCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AUTHORING_HELP } from "@/lib/content/authoring";
import { TECHNIQUES, TECHNIQUE_GROUP_LABELS, type TechniqueGroup } from "@/lib/difficulty/techniques";
import type { AdminResult } from "@/lib/actions/admin/guard";
import { cn } from "@/lib/utils";

/**
 * The article editor.
 *
 * One form for creating and editing, because the fields are identical and two
 * forms would drift. It submits the body as the text an editor wrote — the
 * server parses it into blocks, so the browser never decides what becomes
 * markup — and lets the server own the slug clash, the word floor and every
 * other rule. Field errors come back from the same validation the action uses.
 *
 * Publishing is deliberately not here. It lives on the list and the preview,
 * so saving a draft can never publish by accident.
 */

export type ArticleFormValues = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  topicId: string;
  coverImageUrl: string;
  coverImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  teaches: string[];
  tags: string;
  productIds: string[];
};

export const EMPTY_ARTICLE: ArticleFormValues = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  topicId: "",
  coverImageUrl: "",
  coverImageAlt: "",
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  teaches: [],
  tags: "",
  productIds: [],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function ArticleEditor({
  initial,
  topics,
  products,
  onSubmit,
  submitLabel,
  cancelHref = "/admin/content/articles",
}: {
  initial: ArticleFormValues;
  topics: { id: string; name: string }[];
  products: { id: string; name: string }[];
  onSubmit: (values: {
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    topicId: string | null;
    coverImageUrl: string | null;
    coverImageAlt: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    canonicalUrl: string | null;
    teaches: string[];
    tags: string[];
    productIds: string[];
  }) => Promise<AdminResult<{ id: string }> | AdminResult>;
  submitLabel: string;
  cancelHref?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [showHelp, setShowHelp] = useState(false);

  const set = <K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const words = useMemo(() => values.body.split(/\s+/).filter(Boolean).length, [values.body]);

  const grouped = useMemo(() => {
    const map = new Map<TechniqueGroup, typeof TECHNIQUES[number][]>();
    for (const technique of TECHNIQUES) {
      const list = map.get(technique.group) ?? [];
      list.push(technique);
      map.set(technique.group, list);
    }
    return [...map.entries()];
  }, []);

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await onSubmit({
        title: values.title,
        slug: values.slug || slugify(values.title),
        excerpt: values.excerpt,
        body: values.body,
        topicId: values.topicId || null,
        coverImageUrl: values.coverImageUrl || null,
        coverImageAlt: values.coverImageAlt || null,
        seoTitle: values.seoTitle || null,
        seoDescription: values.seoDescription || null,
        canonicalUrl: values.canonicalUrl || null,
        teaches: values.teaches,
        tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        productIds: values.productIds,
      });

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      const created = (result.data as { id?: string } | undefined)?.id;
      router.push(created ? `/admin/content/articles/${created}/edit` : "/admin/content/articles");
      router.refresh();
    });
  }

  const field = (key: string) =>
    errors[key] ? (
      <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        {errors[key]}
      </p>
    ) : null;

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <section className="admin-card space-y-5 p-5">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={values.title}
            onChange={(event) => {
              const title = event.target.value;
              setValues((current) => ({
                ...current,
                title,
                // The slug follows the title until it has been set by hand.
                slug: current.slug === "" || current.slug === slugify(current.title) ? slugify(title) : current.slug,
              }));
            }}
            required
          />
          {field("title")}
        </div>

        <div>
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={values.slug} onChange={(event) => set("slug", event.target.value)} required />
          <p className="text-body mt-1 text-xs">/blog/{values.slug || "…"}</p>
          {field("slug")}
        </div>

        <div>
          <Label htmlFor="excerpt">Summary</Label>
          <Textarea
            id="excerpt"
            value={values.excerpt}
            onChange={(event) => set("excerpt", event.target.value)}
            rows={3}
            required
          />
          <p className="text-body mt-1 text-xs tabular-nums">
            {values.excerpt.length}/320 — used on the card, in search results and as the meta description.
          </p>
          {field("excerpt")}
        </div>
      </section>

      <section className="admin-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Label htmlFor="body">Article</Label>
          <div className="flex items-center gap-3">
            <span className="text-body text-xs tabular-nums">{words} words</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowHelp((open) => !open)}>
              <HelpCircle aria-hidden />
              Formatting
            </Button>
          </div>
        </div>

        {showHelp && (
          <div className="mb-4 overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <caption className="sr-only">Authoring syntax</caption>
              <tbody className="divide-y divide-border">
                {AUTHORING_HELP.map((entry) => (
                  <tr key={entry.syntax}>
                    <td className="w-1/3 px-3 py-2 font-mono text-foreground">{entry.syntax}</td>
                    <td className="text-body px-3 py-2">{entry.makes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Textarea
          id="body"
          value={values.body}
          onChange={(event) => set("body", event.target.value)}
          rows={24}
          className="font-mono text-[0.8125rem] leading-relaxed"
          required
        />
        {field("body")}
      </section>

      <section className="admin-card space-y-5 p-5">
        <h2 className="admin-rubric">Connections</h2>

        <div>
          <Label htmlFor="topic">Topic</Label>
          <select
            id="topic"
            value={values.topicId}
            onChange={(event) => set("topicId", event.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <option value="">No topic</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-foreground">Techniques this explains</legend>
          <p className="text-body mt-1 text-xs">
            Patterns tagged with the same techniques are linked from the article automatically.
          </p>
          <div className="mt-3 space-y-3">
            {grouped.map(([group, techniques]) => (
              <div key={group}>
                <p className="admin-eyebrow">{TECHNIQUE_GROUP_LABELS[group]}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
                  {techniques.map((technique) => (
                    <label key={technique.slug} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={values.teaches.includes(technique.slug)}
                        onCheckedChange={(checked) =>
                          set(
                            "teaches",
                            checked
                              ? [...values.teaches, technique.slug]
                              : values.teaches.filter((slug) => slug !== technique.slug),
                          )
                        }
                      />
                      {technique.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {field("teaches")}
        </fieldset>

        {products.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Featured patterns</legend>
            <p className="text-body mt-1 text-xs">
              Optional. These are shown first, before any matched by technique.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {products.map((product) => (
                <label key={product.id} className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={values.productIds.includes(product.id)}
                    onCheckedChange={(checked) =>
                      set(
                        "productIds",
                        checked
                          ? [...values.productIds, product.id]
                          : values.productIds.filter((id) => id !== product.id),
                      )
                    }
                  />
                  {product.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={values.tags}
            onChange={(event) => set("tags", event.target.value)}
            placeholder="beginner, amigurumi"
          />
          <p className="text-body mt-1 text-xs">Comma separated. Used for grouping, not shown as links.</p>
        </div>
      </section>

      <section className="admin-card space-y-5 p-5">
        <h2 className="admin-rubric">Cover and search</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="coverImageUrl">Cover image URL</Label>
            <Input
              id="coverImageUrl"
              value={values.coverImageUrl}
              onChange={(event) => set("coverImageUrl", event.target.value)}
              placeholder="https://res.cloudinary.com/…"
            />
            <p className="text-body mt-1 text-xs">Optional. Articles read perfectly well without one.</p>
          </div>
          <div>
            <Label htmlFor="coverImageAlt">Cover alt text</Label>
            <Input
              id="coverImageAlt"
              value={values.coverImageAlt}
              onChange={(event) => set("coverImageAlt", event.target.value)}
            />
            <p className="text-body mt-1 text-xs">Required if there is a cover image.</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="seoTitle">SEO title</Label>
            <Input id="seoTitle" value={values.seoTitle} onChange={(event) => set("seoTitle", event.target.value)} />
            <p className="text-body mt-1 text-xs tabular-nums">
              {values.seoTitle.length}/70 — falls back to the title.
            </p>
          </div>
          <div>
            <Label htmlFor="seoDescription">SEO description</Label>
            <Input
              id="seoDescription"
              value={values.seoDescription}
              onChange={(event) => set("seoDescription", event.target.value)}
            />
            <p className="text-body mt-1 text-xs tabular-nums">
              {values.seoDescription.length}/180 — falls back to the summary.
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="canonicalUrl">Canonical URL</Label>
          <Input
            id="canonicalUrl"
            value={values.canonicalUrl}
            onChange={(event) => set("canonicalUrl", event.target.value)}
          />
          <p className="text-body mt-1 text-xs">
            Leave empty. Set this only if the article was first published somewhere else.
          </p>
          {field("canonicalUrl")}
        </div>
      </section>

      <div className={cn("flex flex-wrap items-center gap-3")}>
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {submitLabel}
        </Button>
        <Link href={cancelHref} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </Link>
      </div>
    </form>
  );
}
