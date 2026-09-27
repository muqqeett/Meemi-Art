import type { Metadata } from "next";
import { FolderTree, Plus, Trash2 } from "lucide-react";

import { AdminPageHeader, AdminSection, AdminTableCard } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTopicAction, deleteTopicAction } from "@/lib/actions/admin/article-forms";
import { listTopics } from "@/lib/queries/admin-articles";

export const metadata: Metadata = { title: "Content topics" };

/**
 * Topics group articles and, later, tutorials.
 *
 * Plain server forms — there is nothing here that needs client JavaScript. A
 * topic that still has content cannot be deleted; the action refuses and says
 * why rather than orphaning anything.
 */
export default async function AdminTopicsPage({ searchParams }: PageProps<"/admin/content/topics">) {
  const raw = await searchParams;
  const error = Array.isArray(raw.error) ? raw.error[0] : raw.error;
  const topics = await listTopics();

  return (
    <div className="max-w-3xl">
      <AdminPageHeader
        eyebrow="Content"
        title="Topics"
        description="One vocabulary shared by articles and tutorials, so a reader can move between them. A topic appears publicly only once something published sits under it."
      />

      {error && (
        <p role="alert" className="mb-5 rounded-md border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      )}

      {topics.length === 0 ? (
        <AdminTableCard>
          <EmptyState
            variant="inline"
            icon={FolderTree}
            title="No topics yet"
            description="Articles do not need a topic, but topics are what group them for readers once there are a few."
          />
        </AdminTableCard>
      ) : (
        <AdminTableCard>
          <table className="admin-table admin-table-stack sm:min-w-[620px]">
            <caption className="sr-only">Content topics</caption>
            <thead>
              <tr>
                <th scope="col">Topic</th>
                <th scope="col" className="text-right">Articles</th>
                <th scope="col" className="text-right">Tutorials</th>
                <th scope="col">Remove</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.id}>
                  <td data-label="Topic">
                    <span className="block font-medium text-foreground">{topic.name}</span>
                    <span className="block text-xs text-muted-foreground">/blog/topic/{topic.slug}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{topic.description}</span>
                  </td>
                  <td data-label="Articles" className="text-right tabular-nums text-muted-foreground">
                    {topic.articles}
                  </td>
                  <td data-label="Tutorials" className="text-right tabular-nums text-muted-foreground">
                    {topic.tutorials}
                  </td>
                  <td data-label="Remove">
                    <form action={deleteTopicAction}>
                      <input type="hidden" name="id" value={topic.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={topic.articles > 0 || topic.tutorials > 0}
                        aria-label={`Delete ${topic.name}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableCard>
      )}

      <AdminSection title="Add a topic" description="Name it after what a reader is trying to learn, not after a product category." className="mt-6">
        <form action={createTopicAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required minLength={3} maxLength={60} />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={90} />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" required minLength={20} maxLength={240} />
          </div>
          <div className="w-32">
            <Label htmlFor="sortOrder">Order</Label>
            <Input id="sortOrder" name="sortOrder" type="number" min={0} max={999} defaultValue={0} />
          </div>
          <Button type="submit" variant="brand" size="sm">
            <Plus aria-hidden />
            Add topic
          </Button>
        </form>
      </AdminSection>
    </div>
  );
}
