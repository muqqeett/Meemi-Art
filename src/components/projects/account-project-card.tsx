import Image from "next/image";
import Link from "next/link";
import { Camera } from "lucide-react";

import { ProjectCardActions } from "@/components/projects/project-card-actions";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import type { AccountProject } from "@/lib/queries/customer-projects";

/**
 * One of the customer's own projects.
 *
 * The photo is shown only from `imageUrl`, the public delivery reference —
 * and that is null until approved photos can be published. Until then the
 * card says the photo is kept private rather than building a storage URL.
 * Customer words are rendered as text, never as markup.
 */
const STATUS_NOTE = {
  PENDING: "We'll review your photo soon.",
  APPROVED: "Approved. Project photos aren't shown on pattern pages yet.",
  REJECTED: "Not approved this time. Edit it to send it back for review, or delete it and share another photo.",
  HIDDEN: "Hidden from the shop. Edit it to send it back for review.",
} as const;

export function AccountProjectCard({ project }: { project: AccountProject }) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row">
      <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-alt">
        {project.imageUrl ? (
          <Image
            src={project.imageUrl}
            alt={`Your ${project.product.name} project`}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-1 px-2 text-center text-muted-foreground">
            <Camera className="size-5" aria-hidden />
            <span className="text-[0.6875rem] leading-tight">Photo kept private</span>
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h4 className="font-medium text-foreground">
            {project.product.isActive ? (
              <Link href={`/products/${project.product.slug}`} className="hover:text-brand-600">
                {project.product.name}
              </Link>
            ) : (
              project.product.name
            )}
          </h4>
          <ProjectStatusBadge status={project.status} />
        </div>

        <p className="text-body text-xs">
          Shared{" "}
          <time dateTime={project.createdAt.toISOString()}>
            {project.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
          </time>
          {" · "}
          {project.displayName ? `Shown as “${project.displayName}”` : "No display name"}
        </p>

        {project.caption ? (
          <p className="text-sm whitespace-pre-line text-foreground">{project.caption}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No caption</p>
        )}

        <p className="text-xs text-muted-foreground">{STATUS_NOTE[project.status]}</p>

        {project.status === "REJECTED" && project.rejectionReason && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm whitespace-pre-line text-rose-800">
            <span className="font-medium">Reason: </span>
            {project.rejectionReason}
          </p>
        )}
      </div>

      <div className="shrink-0 sm:self-start">
        <ProjectCardActions
          projectId={project.id}
          productName={project.product.name}
          status={project.status}
          caption={project.caption}
          displayName={project.displayName}
        />
      </div>
    </li>
  );
}
