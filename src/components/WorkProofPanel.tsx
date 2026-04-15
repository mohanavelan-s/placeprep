import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, FolderUp, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ClearHistoryButton from "@/components/ClearHistoryButton";
import PageStatusPanel from "@/components/PageStatusPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { clearUploadedProofHistory, fetchUploadedImages, uploadImage } from "@/lib/api";

function formatProofDate(value?: string | null) {
  if (!value) {
    return "Just now";
  }

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

export default function WorkProofPanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [proofDate, setProofDate] = useState(() => new Date().toISOString().slice(0, 10));

  const proofsQuery = useQuery({
    queryKey: ["uploads", "proofs"],
    queryFn: () => fetchUploadedImages({ limit: 12 }),
  });

  useQueryErrorLogger("WorkProofPanel:proofs", proofsQuery.error);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Choose a proof image before uploading.");
      }

      return uploadImage(file, {
        caption: caption.trim() || undefined,
        proofDate: proofDate || undefined,
      });
    },
    onSuccess: async () => {
      setFile(null);
      setCaption("");
      await queryClient.invalidateQueries({ queryKey: ["uploads", "proofs"] });
      toast.success("Proof uploaded.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to upload proof.");
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: clearUploadedProofHistory,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["uploads", "proofs"] });
      toast.success(
        result.deleted
          ? `Proof history cleared from ${result.deleted} uploaded item${result.deleted === 1 ? "" : "s"}.`
          : "Proof history was already empty.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to clear proof history.");
    },
  });

  return (
    <section className="surface-panel p-6 md:p-7">
      <div className="mb-6">
        <p className="section-label">Proof of work</p>
        <h3 className="mt-2 font-heading text-3xl text-foreground">
          Drop a visual record after you finish.
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Upload screenshots or photographs of completed work so admins can see the trail, not just the numbers.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
          <div className="flex items-center gap-2 text-foreground">
            <Camera className="h-4 w-4 text-primary" />
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Upload proof</p>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />

            <div className="flex min-h-14 items-center justify-between gap-3 rounded-[1.2rem] border border-border/80 bg-background/70 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {file?.name || "No proof image chosen"}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Screenshot or photo
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {file && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 px-3"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    Clear
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 border-border/80 bg-card/60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderUp className="h-4 w-4" />
                  {file ? "Replace image" : "Choose image"}
                </Button>
              </div>
            </div>

            <Input
              type="date"
              value={proofDate}
              onChange={(event) => setProofDate(event.target.value)}
              className="h-11 border-border/80 bg-background/70"
            />

            <Textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="What did you finish? Example: Solved 2 DP questions and revised OS paging notes."
              className="min-h-[130px] border-border/80 bg-background/70"
            />

            <Button
              type="button"
              className="h-11 gap-2"
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              {uploadMutation.isPending ? "Uploading..." : "Upload proof shot"}
            </Button>
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Recent uploads</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your latest screenshots and photographs stay visible here.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 border-border/80 bg-background/70"
                onClick={() => void proofsQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>

              <ClearHistoryButton
                title="Clear proof history?"
                description="This removes saved proof uploads for this account. Profile avatars will be kept."
                onConfirm={() => clearHistoryMutation.mutate()}
                pending={clearHistoryMutation.isPending}
                disabled={!(proofsQuery.data || []).length}
                className="h-10 gap-2 border-border/80 bg-background/70"
              />
            </div>
          </div>

          {proofsQuery.isPending && !proofsQuery.data && (
            <div className="mt-4">
              <PageStatusPanel
                eyebrow="Proof sync"
                title="Loading your recent proof uploads."
                description="PlacePrep is restoring screenshots and work photographs."
                loading
              />
            </div>
          )}

          {proofsQuery.isError && (
            <div className="mt-4">
              <PageStatusPanel
                eyebrow="Proof fallback"
                title="Proof history could not be loaded."
                description="You can still upload a new proof shot. Retry when you want the gallery back."
                actionLabel="Retry"
                onAction={() => void proofsQuery.refetch()}
                tone="danger"
              />
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(proofsQuery.data || []).map((proof) => (
              <a
                key={proof.id}
                href={proof.secureUrl}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-[1.05rem] border border-border/80 bg-background/45 transition hover:border-primary/30"
              >
                <div className="aspect-[5/4] overflow-hidden bg-black/20">
                  <img
                    src={proof.secureUrl}
                    alt={proof.caption || "Proof upload"}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="space-y-2 px-3 py-3">
                  <p className="line-clamp-2 text-sm text-foreground">
                    {proof.caption || "Proof upload"}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {formatProofDate(proof.proofDate || proof.createdAt)}
                  </p>
                </div>
              </a>
            ))}
          </div>

          {!proofsQuery.isPending && !proofsQuery.isError && !(proofsQuery.data || []).length && (
            <div className="mt-4 rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
              No proof uploads yet. Your first completed-work screenshot will appear here.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
