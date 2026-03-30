import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Plus } from "lucide-react";
import { toast } from "sonner";

import PageStatusPanel from "@/components/PageStatusPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInvite, fetchInvites } from "@/lib/api";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";

function formatInviteDate(value: string) {
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function AdminInvitePanel() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<"admin" | "user">("user");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [label, setLabel] = useState("");

  const invitesQuery = useQuery({
    queryKey: ["invites"],
    queryFn: () => fetchInvites(12),
  });

  useQueryErrorLogger("AdminInvitePanel:invites", invitesQuery.error);

  const createMutation = useMutation({
    mutationFn: () =>
      createInvite({
        role,
        expiresInDays: Number(expiresInDays || 7),
        label: label || undefined,
      }),
    onSuccess: async (invite) => {
      void queryClient.invalidateQueries({ queryKey: ["invites"] });
      setLabel("");
      try {
        await navigator.clipboard.writeText(invite.inviteLink);
        toast.success("Invite created and copied.");
      } catch {
        toast.success("Invite created.");
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to generate invite.");
    },
  });

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied.");
    } catch (error) {
      console.error("[AdminInvitePanel] Failed to copy invite link.", error);
      toast.error("Unable to copy invite link.");
    }
  }

  return (
    <section className="surface-panel p-6 md:p-7">
      <div className="mb-6">
        <p className="section-label">Admin invites</p>
        <h3 className="mt-2 font-heading text-3xl text-foreground">Control who gets in.</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          PlacePrep is private by default. Generate a time-bound invite, copy the link, and hand access to exactly the right person.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <div className="rounded-[1.4rem] border border-border/80 bg-card/60 p-5">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Generate invite</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Select value={role} onValueChange={(value) => setRole(value as "admin" | "user")}>
              <SelectTrigger className="h-11 border-border/80 bg-background/70">
                <SelectValue placeholder="Choose role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User access</SelectItem>
                <SelectItem value="admin">Admin access</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
              className="h-11 border-border/80 bg-background/70"
              placeholder="Expires in 7 days"
              inputMode="numeric"
            />

            <div className="md:col-span-2">
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="h-11 border-border/80 bg-background/70"
                placeholder="Optional label: Backend cohort / Hiring team / Review access"
              />
            </div>
          </div>

          <Button
            type="button"
            className="mt-4 h-11 gap-2"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? "Generating..." : "Generate invite"}
          </Button>
        </div>

        <div className="rounded-[1.4rem] border border-border/80 bg-card/60 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent invites</p>
              <p className="mt-2 text-sm leading-6 text-foreground/80">
                Latest shared access links and their status.
              </p>
            </div>
          </div>

          {invitesQuery.isPending && !invitesQuery.data && (
            <div className="mt-4 rounded-[1.2rem] border border-border/80 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
              Loading invite history.
            </div>
          )}

          {invitesQuery.isError && (
            <div className="mt-4">
              <PageStatusPanel
                eyebrow="Invite fallback"
                title="Invite history is offline."
                description="You can still generate a new invite. Retry when you need the stored list back."
                actionLabel="Retry"
                onAction={() => void invitesQuery.refetch()}
                tone="danger"
              />
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {(invitesQuery.data || []).map((invite) => (
              <article
                key={invite.id}
                className="rounded-[1.15rem] border border-border/80 bg-background/45 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-foreground">{invite.code}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {invite.role} / {invite.status}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      Expires {formatInviteDate(invite.expiresAt)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 gap-2 border-border/80 bg-background/70"
                    onClick={() => void handleCopy(invite.inviteLink)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>

                {invite.metadata?.label && (
                  <p className="mt-3 text-sm text-foreground/75">{String(invite.metadata.label)}</p>
                )}

                <a
                  href={invite.inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
                >
                  <Link2 className="h-4 w-4" />
                  Open invite link
                </a>
              </article>
            ))}
          </div>

          {!invitesQuery.isPending && !invitesQuery.isError && !(invitesQuery.data || []).length && (
            <div className="mt-4 rounded-[1.2rem] border border-border/80 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
              No invites have been created yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
