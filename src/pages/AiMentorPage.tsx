import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";

import PageStatusPanel from "@/components/PageStatusPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQueryErrorLogger } from "@/hooks/use-query-error-logger";
import { fetchMentorHistory, sendMentorMessage } from "@/lib/api";

export default function AiMentorPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const historyQuery = useQuery({
    queryKey: ["mentor-history"],
    queryFn: fetchMentorHistory,
  });
  const endRef = useRef<HTMLDivElement | null>(null);

  useQueryErrorLogger("AiMentorPage:history", historyQuery.error);

  const sendMutation = useMutation({
    mutationFn: () => sendMentorMessage({ message }),
    onSuccess: (result) => {
      queryClient.setQueryData(["mentor-history"], result.history);
      setMessage("");
      toast.success(result.usedFallback ? "Fallback mentor reply loaded." : "Nocturne Mentor replied.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to reach Nocturne Mentor.");
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyQuery.data, sendMutation.data]);

  const history = Array.isArray(historyQuery.data) ? historyQuery.data : [];

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
          <p className="section-label">Chat</p>
          <h3 className="mt-2 font-heading text-3xl text-foreground">Message history</h3>
        </div>

        <div className="max-h-[520px] overflow-y-auto px-6 py-5">
          {historyQuery.isPending && !history.length && (
            <PageStatusPanel
              eyebrow="Mentor sync"
              title="Loading message history."
              description="Nocturne Mentor is restoring your earlier conversations."
              loading
            />
          )}

          {historyQuery.isError && (
            <PageStatusPanel
              eyebrow="Mentor fallback"
              title="Message history could not be loaded."
              description="You can still send a fresh question. Retry if you want the saved thread back."
              actionLabel="Retry"
              onAction={() => void historyQuery.refetch()}
              tone="danger"
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
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/88">
                  {entry.content}
                </p>
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
            placeholder="Ask about DSA, system design, weak areas, or interview strategy..."
            className="min-h-[120px] border-border/80 bg-background/70"
          />
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="gap-2"
              onClick={() => sendMutation.mutate()}
              disabled={!message.trim() || sendMutation.isPending}
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
