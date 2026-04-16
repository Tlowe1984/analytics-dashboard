import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

const ROWS_PER_PAGE = 10;

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-sm">—</span>;

  const lower = status.toLowerCase();
  const isBlocked = lower.includes("blocked");
  const isLive = lower.includes("live");
  const isAsync = lower.includes("async");

  if (isBlocked) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        Blocked
      </span>
    );
  }
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Live
      </span>
    );
  }
  if (isAsync) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
        Async
      </span>
    );
  }
  return <span className="text-sm text-foreground">{status}</span>;
}

export function PdpStatusSection() {
  const { data: rows = [], isLoading } = trpc.pdpStatus.getAll.useQuery();
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const pageRows = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">PDP Status</h2>
            <p className="text-xs text-muted-foreground">Product Development Process gate tracker</p>
          </div>
        </div>
        {rows.length > 0 && (
          <span className="text-xs text-muted-foreground">{rows.length} gates total</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">No PDP status data available.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "38%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-semibold text-foreground">PDP Gate</th>
                  <th className="text-left py-2 px-3 font-semibold text-foreground">Status / Plan</th>
                  <th className="text-left py-2 px-3 font-semibold text-foreground">Critical Topics</th>
                  <th className="text-left py-2 px-3 font-semibold text-foreground">Link</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    {/* PDP Gate — bold week/date prefix only */}
                    <td className="py-2.5 px-3 align-top">
                      {row.pdpGate ? (() => {
                        const match = row.pdpGate.match(/^(W\d+(?:\s+\d{4})?)\s+(.+)$/);
                        if (match) {
                          return (
                            <span>
                              <span className="font-bold text-foreground">{match[1]}</span>
                              {" "}
                              <span className="font-normal text-foreground">{match[2]}</span>
                            </span>
                          );
                        }
                        return <span className="font-normal text-foreground">{row.pdpGate}</span>;
                      })() : "—"}
                    </td>
                    {/* Status/Plan */}
                    <td className="py-2.5 px-3 align-top">
                      <StatusBadge status={row.statusPlan} />
                      {row.statusPlan && !["blocked","live","async","tbd"].some(k => row.statusPlan!.toLowerCase().includes(k)) && null}
                    </td>
                    {/* Critical Topics */}
                    <td className="py-2.5 px-3 align-top text-foreground leading-snug">
                      {row.criticalTopics || <span className="text-muted-foreground">—</span>}
                    </td>
                    {/* Link */}
                    <td className="py-2.5 px-3 align-top">
                      {row.linkUrl ? (
                        <a
                          href={row.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs truncate max-w-full"
                          title={row.linkText || row.linkUrl}
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{row.linkText || "Open"}</span>
                        </a>
                      ) : row.linkText ? (
                        <span className="text-xs text-muted-foreground">{row.linkText}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Showing {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, rows.length)} of {rows.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      i === page
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
