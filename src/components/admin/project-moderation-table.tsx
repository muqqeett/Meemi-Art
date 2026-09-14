"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Check, ExternalLink, EyeOff, ImageOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/admin/admin-primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { approveProject, hideProject, rejectProject } from "@/lib/actions/admin/projects";
import type { AdminProjectRow } from "@/lib/queries/admin-projects";
import { PROJECT_REJECTION_REASON_MAX } from "@/lib/validations/commerce";

/**
 * The project moderation table.
 *
 * Client-side only for the dialogs and pending state. Rows come from the
 * server; each action sends a project id (and, for a rejection, the reason)
 * to the moderation actions, which check the admin role against the database
 * and enforce the transition table. `router.refresh()` then re-reads the
 * queue rather than this component patching its own copy.
 *
 * Approve and hide are one click, as for reviews: both are recorded and the
 * project can be moderated again. Reject asks for the reason the customer
 * will see.
 */

const MIN_REASON = 3;

function statusTone(status: ProjectStatus) {
  if (status === "APPROVED") return "positive" as const;
  if (status === "REJECTED") return "critical" as const;
  if (status === "HIDDEN") return "neutral" as const;
  return "pending" as const;
}

const SUCCESS = {
  approve: "Project approved. It stays private — project photos aren't shown publicly yet.",
  reject: "Project rejected. The customer can see your reason.",
  hide: "Project hidden.",
} as const;

export function ProjectModerationTable({ projects }: { projects: AdminProjectRow[] }) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<AdminProjectRow | null>(null);
  const [reason, setReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  function run(kind: keyof typeof SUCCESS, action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        if (kind === "reject") setRejectError(result.error ?? "That didn't work.");
        else toast.error(result.error ?? "That didn't work.");
        return;
      }
      if (kind === "reject") {
        setRejecting(null);
        setReason("");
      }
      toast.success(SUCCESS[kind]);
      router.refresh();
    });
  }

  const trimmed = reason.trim();
  const reasonProblem =
    trimmed.length === 0
      ? "A reason is required."
      : trimmed.length < MIN_REASON
        ? `Use at least ${MIN_REASON} characters.`
        : trimmed.length > PROJECT_REJECTION_REASON_MAX
          ? `Keep it to ${PROJECT_REJECTION_REASON_MAX} characters.`
          : null;

  return (
    <>
      <div className="admin-card overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="admin-table admin-table-stack sm:min-w-[960px]">
            <caption className="sr-only">Customer projects</caption>
            <thead>
              <tr>
                <th scope="col">Photo</th>
                <th scope="col">Product</th>
                <th scope="col">Maker</th>
                <th scope="col">Caption</th>
                <th scope="col">Status</th>
                <th scope="col">Submitted</th>
                <th scope="col" className="text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {projects.map((project) => {
                const label = `${project.product.name} project${project.displayName ? ` by ${project.displayName}` : ""}`;
                return (
                  <tr key={project.id}>
                    <td data-label="Photo">
                      <div className="flex size-16 items-center justify-center overflow-hidden rounded-md bg-surface-alt">
                        {project.previewUrl ? (
                          // A signed URL for the still-private original, for this admin
                          // screen only. Deliberately not next/image: its optimiser would
                          // re-serve the photo from a public, cacheable URL.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={project.previewUrl}
                            alt={`Photo of the ${label}`}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="flex flex-col items-center text-muted-foreground" title="Preview unavailable">
                            <ImageOff className="size-4" aria-hidden />
                            <span className="sr-only">Preview unavailable</span>
                          </span>
                        )}
                      </div>
                      <span className="mt-1 block text-[0.6875rem] text-muted-foreground tabular-nums">
                        {project.width} × {project.height}
                      </span>
                    </td>

                    <td data-label="Product">
                      <Link
                        href={`/products/${project.product.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-royal-600"
                      >
                        {project.product.name}
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    </td>

                    <td data-label="Maker">
                      {project.displayName ? (
                        <span className="font-medium text-foreground">{project.displayName}</span>
                      ) : (
                        <span className="text-muted-foreground">No display name</span>
                      )}
                    </td>

                    <td data-label="Caption" className="max-w-sm sm:max-w-sm">
                      {project.caption ? (
                        <span className="line-clamp-3 text-xs whitespace-pre-line text-foreground">{project.caption}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No caption</span>
                      )}
                    </td>

                    <td data-label="Status">
                      <StatusBadge tone={statusTone(project.status)}>{project.status.toLowerCase()}</StatusBadge>
                      {project.status === "REJECTED" && project.rejectionReason && (
                        <span className="mt-1 block max-w-56 text-xs whitespace-pre-line text-muted-foreground">
                          {project.rejectionReason}
                        </span>
                      )}
                    </td>

                    <td data-label="Submitted" className="text-muted-foreground">
                      <time dateTime={project.createdAt}>
                        {new Date(project.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </time>
                    </td>

                    <td data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-0.5">
                        {project.canApprove && (
                          <Button
                            variant="ghost"
                            size="icon-lg"
                            disabled={pending}
                            onClick={() => run("approve", () => approveProject(project.id))}
                            className="text-muted-foreground hover:text-success"
                            aria-label={`Approve the ${label}`}
                            title="Approve"
                          >
                            <Check aria-hidden />
                          </Button>
                        )}
                        {project.canHide && (
                          <Button
                            variant="ghost"
                            size="icon-lg"
                            disabled={pending}
                            onClick={() => run("hide", () => hideProject(project.id))}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Hide the ${label}`}
                            title="Hide"
                          >
                            <EyeOff aria-hidden />
                          </Button>
                        )}
                        {project.canReject && (
                          <Button
                            variant="ghost"
                            size="icon-lg"
                            disabled={pending}
                            onClick={() => {
                              setReason("");
                              setRejectError(null);
                              setRejecting(project);
                            }}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Reject the ${label}`}
                            title="Reject with a reason"
                          >
                            <Ban aria-hidden />
                          </Button>
                        )}
                        {!project.canApprove && !project.canHide && !project.canReject && (
                          <span className="text-xs text-muted-foreground">No actions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && !pending && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!rejecting || reasonProblem) return;
              const target = rejecting;
              setRejectError(null);
              run("reject", () => rejectProject(target.id, reason));
            }}
          >
            <DialogHeader>
              <DialogTitle>Reject this project?</DialogTitle>
              <DialogDescription>
                The {rejecting?.product.name} project stays private. The customer sees your reason and can edit
                the project to send it back for review.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor={`${id}-reason`}>
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id={`${id}-reason`}
                value={reason}
                rows={4}
                maxLength={PROJECT_REJECTION_REASON_MAX}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. The photo is too dark to see the finished piece."
                aria-invalid={Boolean(rejectError)}
                aria-describedby={`${id}-reason-help`}
                required
              />
              <div id={`${id}-reason-help`} className="flex justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{reasonProblem ?? "Plain text, shown to the customer."}</span>
                <span className="text-muted-foreground tabular-nums">
                  {reason.length}/{PROJECT_REJECTION_REASON_MAX}
                </span>
              </div>
            </div>

            {rejectError && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {rejectError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="pill" onClick={() => setRejecting(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" size="pill" disabled={pending || Boolean(reasonProblem)}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Reject project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
