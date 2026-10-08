import { useState } from "react";
import { toast } from "sonner";
import { Bot, Check, Copy, Cpu, Globe, Key, ShieldCheck, Sparkles, Terminal } from "lucide-react";
import PlacePrepLogo from "@/components/PlacePrepLogo";
import { Button } from "@/components/ui/button";
import { getBackendBaseUrl } from "@/lib/api";

interface McpGatewayPanelProps {
  publicUrl?: string;
}

export default function McpGatewayPanel({
  publicUrl,
}: McpGatewayPanelProps) {
  const [activeTab, setActiveTab] = useState<"claude" | "chatgpt" | "cursor" | "tools">("claude");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const configuredPublicUrl = (import.meta as any).env?.VITE_MCP_PUBLIC_URL || (import.meta as any).env?.VITE_API_PUBLIC_URL;
  const backendBaseUrl = getBackendBaseUrl();
  const effectiveBaseUrl = (publicUrl || configuredPublicUrl || backendBaseUrl).replace(/\/+$/, "");

  const mcpUrl = `${effectiveBaseUrl}/mcp`;
  const logoPngUrl = `${effectiveBaseUrl}/logo.png`;
  const logoSvgUrl = `${effectiveBaseUrl}/logo.svg`;
  const authUrl = `${effectiveBaseUrl}/oauth/authorize`;
  const tokenUrl = `${effectiveBaseUrl}/oauth/token`;
  const scopes = "placeprep.profile.read placeprep.tasks.read placeprep.tasks.write placeprep.progress.read";

  const copyToClipboard = (text: string, label: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const claudeConfigJson = JSON.stringify(
    {
      mcpServers: {
        placeprep: {
          url: mcpUrl,
        },
      },
    },
    null,
    2
  );

  const registeredTools = [
    {
      name: "get_profile",
      desc: "Retrieve student's placement readiness profile, target role, placement date, streak, and topic strengths.",
    },
    {
      name: "get_progress_summary",
      desc: "Retrieve readiness analytics, consistency metrics, completed task counts, and mentor instructions.",
    },
    {
      name: "get_tasks",
      desc: "List placement preparation tasks with optional filters by date, status, category (DSA, Core, System Design).",
    },
    {
      name: "get_task",
      desc: "Inspect full details of a specific preparation task by its unique task UUID.",
    },
    {
      name: "create_task",
      desc: "Persist a new placement preparation task directly onto the student's dashboard.",
    },
    {
      name: "update_task_status",
      desc: "Update completion state ('pending', 'in_progress', 'completed', 'skipped') and logged minutes.",
    },
    {
      name: "delete_task",
      desc: "Permanently remove a completed or cancelled preparation task.",
    },
  ];

  return (
    <section className="surface-panel p-6 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <PlacePrepLogo compact={true} />
            <div>
              <p className="section-label">Model Context Protocol</p>
              <h3 className="mt-1 font-heading text-3xl text-foreground">AI Host &amp; Agent Gateway</h3>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Connect Claude Desktop, ChatGPT Custom GPT, Cursor, and agentic LLMs to PlacePrep.
            Protected by user-scoped OAuth 2.1 PKCE bearer tokens.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start rounded-2xl border border-border/80 bg-background/60 p-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-400 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            MCP Gateway Live
          </span>
          <span className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-1.5 font-medium text-red-300 border border-red-500/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            OAuth 2.1 PKCE
          </span>
        </div>
      </div>

      {/* Visual Identity & Logo preview */}
      <div className="mt-6 rounded-2xl border border-red-950/40 bg-gradient-to-r from-red-950/20 via-background/40 to-background/20 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="PlacePrep Red P Logo"
              className="h-12 w-12 rounded-xl border border-red-900/60 shadow-lg shadow-red-950/50"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">PlacePrep Visual Identity Asset</p>
              <p className="text-xs text-muted-foreground">
                High-resolution Red &ldquo;P&rdquo; mark configured for MCP server discovery, OAuth consent, and AI avatars.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs border-border/80 bg-background/60"
              onClick={() => copyToClipboard(logoPngUrl, "PNG Logo URL", "logo-png")}
            >
              {copiedKey === "logo-png" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Copy PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs border-border/80 bg-background/60"
              onClick={() => copyToClipboard(logoSvgUrl, "SVG Logo URL", "logo-svg")}
            >
              {copiedKey === "logo-svg" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Copy SVG
            </Button>
          </div>
        </div>
      </div>

      {/* Connection Endpoint Bar */}
      <div className="mt-4 rounded-xl border border-border/80 bg-background/50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Remote MCP Streamable Endpoint</p>
            <code className="mt-1 block truncate font-mono text-sm text-foreground">{mcpUrl}</code>
          </div>
          <Button
            type="button"
            className="h-9 shrink-0 gap-2 text-xs"
            onClick={() => copyToClipboard(mcpUrl, "MCP Endpoint URL", "mcp-url")}
          >
            {copiedKey === "mcp-url" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            Copy Endpoint
          </Button>
        </div>
      </div>

      {/* Configuration Tabs */}
      <div className="mt-6">
        <div className="flex gap-2 border-b border-border/80 pb-2">
          <button
            type="button"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "claude"
                ? "bg-red-500/15 text-red-300 border border-red-500/30"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("claude")}
          >
            <Bot className="h-3.5 w-3.5" />
            Claude Desktop
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "chatgpt"
                ? "bg-red-500/15 text-red-300 border border-red-500/30"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("chatgpt")}
          >
            <Sparkles className="h-3.5 w-3.5" />
            ChatGPT Actions
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "cursor"
                ? "bg-red-500/15 text-red-300 border border-red-500/30"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("cursor")}
          >
            <Terminal className="h-3.5 w-3.5" />
            Cursor &amp; Windsurf
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "tools"
                ? "bg-red-500/15 text-red-300 border border-red-500/30"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("tools")}
          >
            <Cpu className="h-3.5 w-3.5" />
            Registered Tools (7)
          </button>
        </div>

        {/* Tab 1: Claude Desktop */}
        {activeTab === "claude" && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Add PlacePrep to your <code className="text-foreground">claude_desktop_config.json</code> under <code className="text-foreground">mcpServers</code>:
            </p>
            <div className="relative rounded-xl border border-border/80 bg-background/80 p-4">
              <pre className="overflow-x-auto font-mono text-xs text-foreground/90 leading-5">
                {claudeConfigJson}
              </pre>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-3 top-3 h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => copyToClipboard(claudeConfigJson, "Claude Config JSON", "claude-json")}
              >
                {copiedKey === "claude-json" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                Copy JSON
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              When Claude initializes the connection, PlacePrep will prompt for single-click authorization via OAuth 2.1 PKCE.
            </p>
          </div>
        )}

        {/* Tab 2: ChatGPT Actions */}
        {activeTab === "chatgpt" && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Configure OAuth 2.0 in your Custom GPT Action or GPT Builder settings:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Authentication Type</span>
                <p className="mt-1 font-medium text-foreground text-sm">OAuth 2.0 (PKCE)</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Client Authentication</span>
                <p className="mt-1 font-medium text-foreground text-sm">None (Public Client PKCE S256)</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Authorization URL</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(authUrl, "Authorization URL", "auth-url")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedKey === "auth-url" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <p className="mt-1 font-mono text-xs text-foreground truncate">{authUrl}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Token URL</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(tokenUrl, "Token URL", "token-url")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedKey === "token-url" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <p className="mt-1 font-mono text-xs text-foreground truncate">{tokenUrl}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background/60 p-3 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Scope</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(scopes, "Scopes", "scopes")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedKey === "scopes" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <p className="mt-1 font-mono text-xs text-foreground">{scopes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Cursor & Windsurf */}
        {activeTab === "cursor" && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              In Cursor or Windsurf MCP Settings (<code className="text-foreground">Features &gt; MCP Servers</code>):
            </p>
            <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-3">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Server Type</span>
                <p className="mt-1 font-medium text-sm text-foreground">SSE / Remote HTTP</p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Server Name</span>
                <p className="mt-1 font-medium text-sm text-foreground">placeprep</p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">URL</span>
                <p className="mt-1 font-mono text-xs text-foreground">{mcpUrl}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Registered Tools */}
        {activeTab === "tools" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {registeredTools.map((tool) => (
              <div key={tool.name} className="rounded-xl border border-border/80 bg-background/60 p-3.5">
                <div className="flex items-center justify-between">
                  <code className="font-mono text-xs font-semibold text-red-400">{tool.name}</code>
                  <span className="rounded bg-background/90 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Tool
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{tool.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
