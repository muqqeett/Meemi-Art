"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectTextErrors } from "@/components/projects/project-text-rules";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { deleteMyProject, updateMyProject } from "@/lib/actions/projects";
import { PROJECT_CAPTION_MAX, PROJECT_DISPLAY_NAME_MAX } from "@/lib/validations/commerce";

/**
 * Edit and delete for one of the customer's own projects.
 *
 * Each dialog sends only what the actions accept: the project id and, for an
 * edit, the words. The server resolves the owner from the session and refuses
 * anyone else's project, so these buttons decide nothing. Nothing is removed
 * from the page until the server confirms — the list then refreshes from the
 * database.
 */
export function ProjectCardActions({
  projectId,
  productName,
  status,
  caption,
  displayName,
}: {
  projectId: string;
  productName: string;
  status: ProjectStatus;
  caption: string | null;
  displayName: string | null;
}) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draftCaption, setDraftCaption] = useState(caption ?? "");
  const [draftName, setDraftName] = useState(displayName ?? "");
  const [error, setError] = useState<string | null>(null);

  const textErrors = projectTextErrors({ caption: draftCaption, displayName: draftName });

  function openEdit() {
    setDraftCaption(caption ?? "");
    setDraftName(displayName ?? "");
    setError(null);
    setEditing(true);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (textErrors.caption || textErrors.displayName) return;
    setError(null);
    startTransition(async () => {
      const result = await updateMyProject({ projectId, caption: draftCaption, displayName: draftName });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      toast.success("Changes saved. Your project is back in review.");
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMyProject({ projectId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDeleting(false);
      toast.success("Project deleted.");
      router.refresh();
    });
  }

  const errorNote = error && (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {error}
    </p>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={openEdit} aria-label={`Edit your ${productName} project`}>
          <Pencil aria-hidden />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setError(null);
            setDeleting(true);
          }}
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete your ${productName} project`}
        >
          <Trash2 aria-hidden />
          Delete
        </Button>
      </div>

      <Dialog open={editing} onOpenChange={(open) => !pending && setEditing(open)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Edit your project</DialogTitle>
              <DialogDescription>
                {status === "PENDING"
                  ? "You can change your display name and caption. The photo stays the same."
                  : "Saving sends your project back for review. The photo stays the same."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor={`${id}-name`}>Display name</Label>
              <Input
                id={`${id}-name`}
                value={draftName}
                maxLength={PROJECT_DISPLAY_NAME_MAX}
                onChange={(event) => setDraftName(event.target.value)}
                aria-invalid={Boolean(textErrors.displayName)}
                aria-describedby={`${id}-name-help`}
                autoComplete="off"
              />
              <div id={`${id}-name-help`} className="flex justify-between gap-3 text-xs">
                <span className={textErrors.displayName ? "text-destructive" : "text-muted-foreground"}>
                  {textErrors.displayName ?? "Optional. Leave blank to remove it."}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {draftName.length}/{PROJECT_DISPLAY_NAME_MAX}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${id}-caption`}>Caption</Label>
              <Textarea
                id={`${id}-caption`}
                value={draftCaption}
                maxLength={PROJECT_CAPTION_MAX}
                rows={4}
                onChange={(event) => setDraftCaption(event.target.value)}
                aria-invalid={Boolean(textErrors.caption)}
                aria-describedby={`${id}-caption-count`}
              />
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-destructive">{textErrors.caption}</span>
                <span id={`${id}-caption-count`} className="text-muted-foreground tabular-nums">
                  {draftCaption.length}/{PROJECT_CAPTION_MAX}
                </span>
              </div>
            </div>

            {errorNote}

            <DialogFooter>
              <Button type="button" variant="outline" size="pill" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="brand"
                size="pill"
                disabled={pending || Boolean(textErrors.caption || textErrors.displayName)}
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={(open) => !pending && setDeleting(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              Your {productName} project and its photo will be removed permanently. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>

          {errorNote}

          <DialogFooter>
            <Button variant="outline" size="pill" onClick={() => setDeleting(false)} disabled={pending}>
              Keep it
            </Button>
            <Button variant="destructive" size="pill" onClick={remove} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
