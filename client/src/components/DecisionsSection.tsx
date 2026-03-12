import { trpc } from "@/lib/trpc";
import { FileText, ExternalLink, Search, X } from "lucide-react";
import { MarkdownText } from "./MarkdownText";
import { useState, useMemo } from "react";

// Normalize forum values to canonical display names
function normalizeForumLabel(forum: string): string {
  const f = forum.toLowerCase().trim();
  if (f.includes("device") && f.includes("growth")) return "Devices & Growth";
  if (f.includes("experience") || f.includes("i&e") || f.includes("i+e")) return "Experiences & Interfaces";
  if (f.includes("system")) return "Systems Review";
  if ((f.includes("wearable") || f.includes("wearables")) && f.includes("review")) return "Wearables Review";
  if (f.includes("ai glasses") || f.includes("arg") || f.includes("ssg")) return "AI Glasses / ARG / SSG";
  if (f.includes("mz")) return "MZ Review";
  if (f.includes("demo")) return "Demo";
  if (f.includes("design")) return "Design Review";
  return forum;
}

// Normalize status values
function normalizeStatus(status: string): string {
  const s = status.toLowerCase().trim();
  if (s === "decisions" || s === "decision" || s === "approved") return "Decisions";
  if (s === "inform") return "Inform";
  if (s === "discussed") return "Discussed";
  return status;
}

export default function DecisionsSection() {
  const { data: decisions, isLoading } = trpc.decisions.getAll.useQuery();
  const GOOGLE_DOC_URL = "https://docs.google.com/document/d/1b0LPlOC9hw8l9og6sENOtzjCALQb38hFRyl7anfpVnY/edit?tab=t.0";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [forumFilter, setForumFilter] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Get unique normalized forum values for the filter dropdown
  const forumOptions = useMemo(() => {
    if (!decisions) return [];
    const normalized = decisions
      .map(d => d.forum ? normalizeForumLabel(d.forum) : null)
      .filter((f): f is string => !!f);
    return ["All", ...Array.from(new Set(normalized)).sort()];
  }, [decisions]);

  const statusOptions = ["All", "Decisions", "Inform", "Discussed", "Other"];

  // Apply filters and search
  const filtered = useMemo(() => {
    if (!decisions) return [];
    return decisions.filter(d => {
      // Status filter
      if (statusFilter !== "All") {
        const norm = normalizeStatus(d.status || "");
        if (norm !== statusFilter) return false;
      }
      // Forum filter
      if (forumFilter !== "All") {
        const norm = d.forum ? normalizeForumLabel(d.forum) : "";
        if (norm !== forumFilter) return false;
      }
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (d.decisionOutcome || "").toLowerCase().includes(q) ||
          (d.dri || "").toLowerCase().includes(q) ||
          (d.forum || "").toLowerCase().includes(q) ||
          (d.week || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [decisions, statusFilter, forumFilter, search]);

  if (isLoading) {
    return (
      <div className="w-full py-8 sm:py-12 px-3 sm:px-6 lg:px-8">
        <div className="max-w-[2000px] mx-auto">
          <div className="glass-card rounded-2xl p-4 sm:p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-muted rounded w-full mb-2"></div>
              <div className="h-4 bg-muted rounded w-full mb-2"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="decisions-made-section" className="w-full py-8 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-[2000px] mx-auto">
        <div className="glass-card rounded-2xl p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-bold">Decisions Made</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Strategic decisions from the last 20 weeks
                  {filtered.length !== decisions?.length && (
                    <span className="ml-2 text-purple-600 dark:text-purple-400 font-medium">
                      · {filtered.length} of {decisions?.length} shown
                    </span>
                  )}
                </p>
              </div>
            </div>
            <a
              href={GOOGLE_DOC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors glass-card rounded-lg w-fit"
            >
              View Source Document
              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
            </a>
          </div>

          {/* Search + Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search decisions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-purple-500/40 placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-purple-500/40 min-w-[140px]"
            >
              {statusOptions.map(s => (
                <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>
              ))}
            </select>

            {/* Forum Filter */}
            <select
              value={forumFilter}
              onChange={e => setForumFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-purple-500/40 min-w-[170px]"
            >
              {forumOptions.map(f => (
                <option key={f} value={f}>{f === "All" ? "All Forums" : f}</option>
              ))}
            </select>
          </div>

          {/* Scrollable Table */}
          {filtered.length > 0 ? (
            <div className="overflow-y-auto" style={{ maxHeight: "480px" }}>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-semibold text-sm w-[6%]">Week</th>
                      <th className="text-left py-3 px-2 font-semibold text-sm w-[9%]">DRI</th>
                      <th className="text-left py-3 px-2 font-semibold text-sm w-[12%]">Forum</th>
                      <th className="text-left py-3 px-2 font-semibold text-sm w-[7%]">Status</th>
                      <th className="text-left py-3 px-2 font-semibold text-sm w-[66%]">Decision Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((decision) => {
                      const isExpanded = expandedId === decision.id;
                      const normStatus = normalizeStatus(decision.status || "");
                      const statusColor =
                        normStatus === "Decisions" ? "text-green-600 dark:text-green-400" :
                        normStatus === "Inform" ? "text-blue-600 dark:text-blue-400" :
                        normStatus === "Discussed" ? "text-amber-600 dark:text-amber-400" :
                        "text-muted-foreground";
                      return (
                        <tr
                          key={decision.id}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : decision.id)}
                        >
                          <td className="py-3 px-2 text-sm font-medium whitespace-nowrap align-top">{decision.week}</td>
                          <td className="py-3 px-2 text-sm align-top">{decision.dri}</td>
                          <td className="py-3 px-2 text-xs align-top text-muted-foreground">{decision.forum ? normalizeForumLabel(decision.forum) : "—"}</td>
                          <td className={`py-3 px-2 text-xs font-medium align-top ${statusColor}`}>{normStatus || "—"}</td>
                          <td className="py-3 px-2 text-sm align-top">
                            {isExpanded ? (
                              <MarkdownText content={decision.decisionOutcome} />
                            ) : (
                              <p className="line-clamp-2 text-sm text-foreground/90">
                                {decision.decisionOutcome?.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filtered.map((decision) => {
                  const isExpanded = expandedId === decision.id;
                  const normStatus = normalizeStatus(decision.status || "");
                  return (
                    <div
                      key={decision.id}
                      className="bg-background/40 border border-border/50 rounded-lg p-3 space-y-2 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : decision.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">{decision.week}</span>
                        {normStatus && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{normStatus}</span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-medium text-muted-foreground min-w-[50px]">DRI:</span>
                          <span className="text-xs text-foreground">{decision.dri}</span>
                        </div>
                        {decision.forum && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-medium text-muted-foreground min-w-[50px]">Forum:</span>
                            <span className="text-xs text-foreground">{normalizeForumLabel(decision.forum)}</span>
                          </div>
                        )}
                        <div className="pt-1 border-t border-border/30">
                          {isExpanded ? (
                            <div className="text-xs text-foreground/90 leading-relaxed">
                              <MarkdownText content={decision.decisionOutcome} />
                            </div>
                          ) : (
                            <p className="text-xs text-foreground/90 line-clamp-2">
                              {decision.decisionOutcome?.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 sm:py-12">
              <p className="text-sm text-muted-foreground">
                {decisions && decisions.length > 0
                  ? "No decisions match your search or filters."
                  : "No decisions found from the last 20 weeks."}
              </p>
              {(search || statusFilter !== "All" || forumFilter !== "All") && (
                <button
                  onClick={() => { setSearch(""); setStatusFilter("All"); setForumFilter("All"); }}
                  className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
