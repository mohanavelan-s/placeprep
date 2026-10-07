import React from "react";
import { Database, Table as TableIcon } from "lucide-react";

const SQL_TYPES = new Set([
  "int",
  "integer",
  "smallint",
  "bigint",
  "tinyint",
  "varchar",
  "char",
  "text",
  "string",
  "date",
  "datetime",
  "timestamp",
  "time",
  "year",
  "decimal",
  "numeric",
  "float",
  "double",
  "real",
  "boolean",
  "bool",
  "enum",
  "json",
  "blob",
]);

interface TableBlockData {
  type: "table";
  title?: string | null;
  header: string[];
  rows: string[][];
}

interface TextBlockData {
  type: "text";
  content: string;
}

type BlockData = TableBlockData | TextBlockData;

function parseTableBlock(lines: string[]): { header: string[]; rows: string[][] } | null {
  const tableLines = lines.filter((l) => l.includes("|") && !/^\s*[+\-:=|]+\s*$/.test(l));
  if (tableLines.length < 1) return null;

  const parseRow = (l: string) =>
    l
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const header = parseRow(tableLines[0]);
  if (!header.length || header.every((h) => !h)) return null;

  const rows: string[][] = [];
  for (let i = 1; i < tableLines.length; i++) {
    const row = parseRow(tableLines[i]);
    if (row.length) {
      rows.push(row);
    }
  }

  return { header, rows };
}

export function segmentProblemContent(content: string): BlockData[] {
  if (!content) return [];
  const lines = content.split("\n");
  const blocks: BlockData[] = [];
  let currentText: string[] = [];
  let currentTable: string[] = [];
  let tableTitle: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBorder = /^\s*\+[-+:=]+\+\s*$/.test(line) || /^\s*\|[-|:=]+\|\s*$/.test(line);
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);

    if (isBorder || isTableRow) {
      if (currentTable.length === 0 && currentText.length > 0) {
        const lastLine = currentText[currentText.length - 1].trim();
        if (/^(table:?|input:?|output:?|explanation:?|[a-z0-9_]+\s+table:?)/i.test(lastLine)) {
          tableTitle = currentText.pop()?.trim() || null;
        }
      }
      if (currentText.length > 0) {
        const textStr = currentText.join("\n").trim();
        if (textStr) {
          blocks.push({ type: "text", content: textStr });
        }
        currentText = [];
      }
      currentTable.push(line);
    } else {
      if (currentTable.length > 0) {
        const parsed = parseTableBlock(currentTable);
        if (parsed) {
          blocks.push({ type: "table", title: tableTitle, ...parsed });
        } else {
          blocks.push({ type: "text", content: currentTable.join("\n") });
        }
        currentTable = [];
        tableTitle = null;
      }
      currentText.push(line);
    }
  }

  if (currentTable.length > 0) {
    const parsed = parseTableBlock(currentTable);
    if (parsed) {
      blocks.push({ type: "table", title: tableTitle, ...parsed });
    } else {
      blocks.push({ type: "text", content: currentTable.join("\n") });
    }
  }

  if (currentText.length > 0) {
    const trimmed = currentText.join("\n").trim();
    if (trimmed) {
      blocks.push({ type: "text", content: trimmed });
    }
  }

  return blocks;
}

export function SqlTableCard({
  title,
  header,
  rows,
}: {
  title?: string | null;
  header: string[];
  rows: string[][];
}) {
  const isSchema = header.some((h) => /column|type/i.test(h));

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/70 bg-card/75 shadow-sm">
      {title && (
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-3.5 py-2">
          {isSchema ? (
            <Database className="h-3.5 w-3.5 text-primary/80" />
          ) : (
            <TableIcon className="h-3.5 w-3.5 text-sky-400/80" />
          )}
          <span className="font-mono text-xs font-semibold text-foreground/90 tracking-wide">
            {title}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-background/50 text-muted-foreground">
              {header.map((col, index) => (
                <th
                  key={`${col}-${index}`}
                  className="px-3.5 py-2 font-semibold tracking-wider text-foreground/90 uppercase text-[11px]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="transition-colors hover:bg-muted/15">
                {row.map((cell, cIdx) => {
                  const lower = cell.toLowerCase().trim();
                  const isType = SQL_TYPES.has(lower);
                  const isNull = lower === "null";

                  return (
                    <td key={cIdx} className="px-3.5 py-2 text-foreground/80 whitespace-nowrap">
                      {isType ? (
                        <span className="inline-block rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium text-sky-300">
                          {cell}
                        </span>
                      ) : isNull ? (
                        <span className="italic text-muted-foreground/60">null</span>
                      ) : (
                        <span>{cell}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProblemContentRenderer({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const blocks = React.useMemo(() => segmentProblemContent(content), [content]);

  if (!blocks.length) {
    return null;
  }

  // If there are no tables detected, render standard monospace/sans text
  const hasTables = blocks.some((b) => b.type === "table");
  if (!hasTables) {
    return (
      <div className={`whitespace-pre-wrap font-sans text-sm leading-7 text-foreground/86 ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`space-y-3 font-sans text-sm leading-7 text-foreground/86 ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === "table") {
          return (
            <SqlTableCard
              key={idx}
              title={block.title}
              header={block.header}
              rows={block.rows}
            />
          );
        }

        return (
          <div key={idx} className="whitespace-pre-wrap leading-7">
            {block.content}
          </div>
        );
      })}
    </div>
  );
}

export function FormattedTestCaseData({
  value,
  fallback = "No data",
}: {
  value?: string | null;
  fallback?: string;
}) {
  const str = String(value || "").trim();
  if (!str) {
    return <span className="text-muted-foreground/60">{fallback}</span>;
  }

  // Check if string contains table format
  if (str.includes("|") && (str.includes("+") || str.includes("-"))) {
    const blocks = segmentProblemContent(str);
    const hasTable = blocks.some((b) => b.type === "table");
    if (hasTable) {
      return (
        <div className="overflow-x-auto">
          {blocks.map((b, i) =>
            b.type === "table" ? (
              <SqlTableCard key={i} title={b.title} header={b.header} rows={b.rows} />
            ) : (
              <div key={i} className="font-mono text-xs text-foreground/80 whitespace-pre-wrap">
                {b.content}
              </div>
            )
          )}
        </div>
      );
    }
  }

  // Pretty-print JSON if it is a JSON array/object
  if ((str.startsWith("[") && str.endsWith("]")) || (str.startsWith("{") && str.endsWith("}"))) {
    try {
      const parsed = JSON.parse(str);
      // If it is an array of objects (like SQL result rows):
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null) {
        const keys = Object.keys(parsed[0]);
        const rows = parsed.map((item) => keys.map((k) => String(item[k] ?? "null")));
        return <SqlTableCard header={keys} rows={rows} />;
      }
      return (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/80">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      // Fall through to plain text
    }
  }

  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-foreground/80">
      {str}
    </pre>
  );
}
