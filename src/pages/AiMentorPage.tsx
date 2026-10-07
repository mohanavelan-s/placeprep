import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import ClearHistoryButton from "@/components/ClearHistoryButton";
import SoftSyncNotice from "@/components/SoftSyncNotice";
import { MentorSkeleton } from "@/components/WorkspaceSkeletons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { useTierGate } from "@/hooks/use-tier-gate";
import { clearMentorHistory, fetchMentorHistory, sendMentorMessage } from "@/lib/api";

function CodeBlock({
  children,
  language,
}: {
  children: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    toast.success("Code copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/80 bg-background/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/25 px-3.5 py-1.5 text-xs text-muted-foreground">
        <span className="font-mono text-[11px] uppercase tracking-wider text-primary/80">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition hover:bg-muted/30 hover:text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-5 text-foreground/90">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function MentorMessageContent({
  content,
  assistant,
}: {
  content: string;
  assistant: boolean;
}) {
  if (!assistant) {
    return (
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/88">
        {content}
      </p>
    );
  }

  return (
    <div className="mt-2 text-sm leading-6 text-foreground/88">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 mb-2.5 text-base font-bold uppercase tracking-wider text-primary border-l-2 border-primary pl-3">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-2 text-sm font-bold uppercase tracking-wider text-foreground border-l-2 border-primary/70 pl-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => {
            const text = String(children);
            const isDirective = text.includes("DIRECTIVE") || text.includes("🎯");
            const isRoadmap = text.includes("ROADMAP") || text.includes("🗺️") || text.includes("AGENDA");
            const isActions = text.includes("ACTION") || text.includes("⚡");
            const isPitfalls = text.includes("PITFALL") || text.includes("⚠️") || text.includes("TRAP");

            let borderStyle = "border-primary/25 bg-primary/10 text-primary";
            if (isDirective) borderStyle = "border-amber-400/30 bg-amber-500/10 text-amber-200";
            if (isRoadmap) borderStyle = "border-sky-400/30 bg-sky-500/10 text-sky-200";
            if (isActions) borderStyle = "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
            if (isPitfalls) borderStyle = "border-rose-400/30 bg-rose-500/10 text-rose-200";

            return (
              <div className={`mt-4 mb-2 flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider ${borderStyle}`}>
                {children}
              </div>
            );
          },
          p: ({ children }) => (
            <p className="my-2 leading-7 text-foreground/90 whitespace-pre-wrap">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 space-y-1.5 pl-4 list-disc marker:text-primary/70">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1.5 pl-4 list-decimal marker:text-primary/70">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-6 text-foreground/88 pl-1">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-r-lg border-l-2 border-primary/60 bg-muted/20 px-3.5 py-2 text-xs italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children }: any) => {
            const match = /language-(\w+)/.exec(className || "");
            const isCodeBlock = !inline && (Boolean(match) || String(children).includes("\n"));

            if (isCodeBlock) {
              return (
                <CodeBlock language={match?.[1]}>
                  {String(children).replace(/\n$/, "")}
                </CodeBlock>
              );
            }

            return (
              <code className="rounded border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-amber-200">
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border/70 bg-card/60">
              <table className="w-full text-left font-mono text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border/70 bg-muted/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/90">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/40 px-3 py-2 text-foreground/80">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function AiMentorPage() {
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();
  const tierGate = useTierGate();
  const [message, setMessage] = useState("");
  const historyQuery = useQuery({
    queryKey: ["mentor-history"],
    queryFn: fetchMentorHistory,
  });
  const endRef = useRef<HTMLDivElement | null>(null);

  useQueryErrorLogger("AiMentorPage:history", historyQuery.error);

  const sendMutation = useMutation({
    mutationFn: () => sendMentorMessage({ message }),
    onSuccess: async (result) => {
      queryClient.setQueryData(["mentor-history"], result.history);
      setMessage("");
      await refreshProfile();
      toast.success(result.usedFallback ? "Fallback mentor reply loaded." : "Nocturne Mentor replied.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to reach Nocturne Mentor.");
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: clearMentorHistory,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["mentor-history"] });
      toast.success(
        result.deleted
          ? `Mentor history cleared from ${result.deleted} saved message${result.deleted === 1 ? "" : "s"}.`
          : "Mentor history was already empty.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to clear mentor history.");
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyQuery.data, sendMutation.data]);

  const history = Array.isArray(historyQuery.data) ? historyQuery.data : [];
  const canMessageMentor = tierGate.canUse("mentor_messages");

  function handleSendMessage() {
    if (!message.trim() || sendMutation.isPending || !canMessageMentor) {
      return;
    }

    sendMutation.mutate();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter"
      || event.shiftKey
      || event.altKey
      || event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    handleSendMessage();
  }

  if (historyQuery.isPending && !history.length) {
    return <MentorSkeleton />;
  }

  return (
    <div className="grid gap-6">
      <section className="surface-panel-strong p-6 md:p-7">
        <p className="section-label">Nocturne Mentor</p>
        <h2 className="mt-2 font-heading text-4xl text-foreground md:text-5xl">
          Strict guidance. No fluff. No spoon-feeding.
        </h2>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="border-b border-border/70 px-6 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-label">Chat</p>
              <h3 className="mt-2 font-heading text-3xl text-foreground">Message history</h3>
            </div>

            <ClearHistoryButton
              title="Clear mentor history?"
              description="This removes your saved Nocturne Mentor conversation history for this account."
              onConfirm={() => clearHistoryMutation.mutate()}
              pending={clearHistoryMutation.isPending}
              disabled={!history.length}
              className="h-10 gap-2 border-border/80 bg-background/70"
            />
          </div>
        </div>

        <div className="max-h-[520px] overflow-y-auto px-6 py-5">
          {historyQuery.isError && (
            <SoftSyncNotice
              title="Saved mentor history is temporarily unavailable."
              description="You can still send a fresh question. Retry if you want the saved thread back."
              actionLabel="Retry"
              onAction={() => void historyQuery.refetch()}
            />
          )}

          <div className="space-y-4">
            {history.map((entry) => (
              <div
                key={entry.id}
                className={`max-w-3xl rounded-2xl border px-4 py-3 ${
                  entry.role === "assistant"
                    ? "border-primary/25 bg-primary/10"
                    : "ml-auto border-border/80 bg-card/70"
                }`}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {entry.role === "assistant" ? "Nocturne Mentor" : "You"}
                </p>
                <MentorMessageContent content={entry.content} assistant={entry.role === "assistant"} />
              </div>
            ))}
            {!history.length && !historyQuery.isPending && (
              <p className="text-sm leading-6 text-muted-foreground">
                {historyQuery.isError
                  ? "Start a fresh thread while the saved history reconnects."
                  : "Start the conversation with a topic, problem, or interview concern."}
              </p>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-border/70 px-6 py-5">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask about DSA, system design, weak areas, or interview strategy..."
            className="min-h-[120px] border-border/80 bg-background/70"
            disabled={!canMessageMentor}
          />
          {!canMessageMentor && tierGate.tier === "free" && (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Free workspaces include 10 mentor messages. Enter a college invite or upgrade later to keep chatting.
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="gap-2"
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMutation.isPending || !canMessageMentor}
            >
              <Send className="h-4 w-4" />
              {sendMutation.isPending ? "Mentor is thinking..." : "Send"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
