import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Smartphone, Upload } from "lucide-react";
import { toast } from "sonner";

import PageStatusPanel from "@/components/PageStatusPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  downloadApkVersion,
  fetchApkVersions,
  fetchLatestApk,
  uploadApk,
} from "@/lib/api";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";

function formatUploadedAt(value?: string | null) {
  if (!value) {
    return "Not published";
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

interface AndroidAccessPanelProps {
  adminMode?: boolean;
}

export default function AndroidAccessPanel({ adminMode = false }: AndroidAccessPanelProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");

  const latestApkQuery = useQuery({
    queryKey: ["apk", "latest"],
    queryFn: fetchLatestApk,
  });

  const versionsQuery = useQuery({
    queryKey: ["apk", "versions"],
    queryFn: () => fetchApkVersions(6),
    enabled: adminMode,
  });

  useQueryErrorLogger("AndroidAccessPanel:latest-apk", latestApkQuery.error);
  useQueryErrorLogger("AndroidAccessPanel:apk-versions", versionsQuery.error);

  const latestApk = latestApkQuery.data;
  const latestVersionLabel = useMemo(() => latestApk?.version || "Unavailable", [latestApk]);

  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (!latestApk) {
        throw new Error("No Android build is available yet.");
      }

      const { blob, fileName } = await downloadApkVersion(latestApk.id);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(objectUrl);
    },
    onSuccess: () => {
      toast.success("Android build download started.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to download Android build.");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Choose an APK file first.");
      }

      return uploadApk(file, { version: version || undefined });
    },
    onSuccess: () => {
      setFile(null);
      setVersion("");
      void queryClient.invalidateQueries({ queryKey: ["apk"] });
      toast.success("Android build published.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to upload Android build.");
    },
  });

  return (
    <section className="surface-panel p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="section-label">Android access</p>
          <h3 className="mt-2 font-heading text-3xl text-foreground">Download for Android</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Secure mobile access to dashboard, tasks, and Nocturne Mentor. Downloads stay behind an authenticated PlacePrep session.
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-background/45 px-4 py-3 text-sm text-foreground/80">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest version</p>
          <p className="mt-2 font-heading text-3xl text-foreground">{latestVersionLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatUploadedAt(latestApk?.uploadedAt)}</p>
        </div>
      </div>

      {latestApkQuery.isPending && !latestApk && (
        <PageStatusPanel
          eyebrow="Android sync"
          title="Checking for the latest mobile build."
          description="PlacePrep is restoring the latest APK metadata."
          loading
        />
      )}

      {latestApkQuery.isError && (
        <PageStatusPanel
          eyebrow="Android fallback"
          title="Android build data could not be loaded."
          description="The panel stays visible. Retry when you want the latest build signal back."
          actionLabel="Retry"
          onAction={() => void latestApkQuery.refetch()}
          tone="danger"
        />
      )}

      {!latestApkQuery.isPending && !latestApkQuery.isError && (
        <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-foreground">
                <Smartphone className="h-4 w-4" />
                <p className="text-base">Authenticated APK download</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {latestApk
                  ? `Build ${latestApk.version} is ready for download.`
                  : "No Android build has been published yet."}
              </p>
            </div>

            <Button
              type="button"
              className="h-11 gap-2"
              onClick={() => downloadMutation.mutate()}
              disabled={!latestApk || downloadMutation.isPending}
            >
              <Download className="h-4 w-4" />
              {downloadMutation.isPending ? "Preparing..." : "Download Android App"}
            </Button>
          </div>
        </div>
      )}

      {adminMode && (
        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Admin publish</p>
            <div className="mt-4 grid gap-3">
              <Input
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="Version label, for example v1.0.0"
                className="h-11 border-border/80 bg-background/70"
              />
              <Input
                type="file"
                accept=".apk,application/vnd.android.package-archive,application/octet-stream"
                className="h-11 border-border/80 bg-background/70 file:mr-3 file:rounded-full file:border-0 file:bg-primary/12 file:px-3 file:py-2 file:text-sm file:text-foreground"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
              <Button
                type="button"
                className="h-11 gap-2"
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !file}
              >
                <Upload className="h-4 w-4" />
                {uploadMutation.isPending ? "Publishing..." : "Upload Android build"}
              </Button>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-border/80 bg-card/65 p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Version history</p>
            <div className="mt-4 grid gap-3">
              {(versionsQuery.data || []).map((versionItem) => (
                <article
                  key={versionItem.id}
                  className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-foreground">{versionItem.version}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {versionItem.isActive ? "Active" : "Archived"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatUploadedAt(versionItem.uploadedAt)}</p>
                  </div>
                </article>
              ))}

              {versionsQuery.isPending && (
                <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
                  Loading Android version history.
                </div>
              )}

              {!versionsQuery.isPending && !(versionsQuery.data || []).length && (
                <div className="rounded-[1.1rem] border border-border/80 bg-background/45 px-4 py-4 text-sm text-muted-foreground">
                  No Android builds have been uploaded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
