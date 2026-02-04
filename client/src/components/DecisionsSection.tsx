import { trpc } from "@/lib/trpc";
import { FileText, ExternalLink } from "lucide-react";
import { MarkdownText } from "./MarkdownText";

export default function DecisionsSection() {
  const { data: decisions, isLoading } = trpc.decisions.getAll.useQuery();

  const GOOGLE_DOC_URL = "https://docs.google.com/document/d/1b0LPlOC9hw8l9og6sENOtzjCALQb38hFRyl7anfpVnY/edit?tab=t.0";

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
    <div className="w-full py-8 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-[2000px] mx-auto">
        <div className="glass-card rounded-2xl p-4 sm:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-bold">Decisions</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Strategic decisions from the last month</p>
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

          {/* Content */}
          {decisions && decisions.length > 0 ? (
            <>
              {/* Desktop Table View - hidden on mobile */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-semibold text-sm">Week</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">DRI</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Forum</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-sm">Decision Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.map((decision) => (
                      <tr key={decision.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium whitespace-nowrap">{decision.week}</td>
                        <td className="py-3 px-4 text-sm whitespace-nowrap">{decision.dri}</td>
                        <td className="py-3 px-4 text-sm">{decision.forum || "—"}</td>
                        <td className="py-3 px-4 text-sm">{decision.status || "—"}</td>
                        <td className="py-3 px-4 text-sm"><MarkdownText content={decision.decisionOutcome} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View - hidden on desktop */}
              <div className="md:hidden space-y-3">
                {decisions.map((decision) => (
                  <div key={decision.id} className="bg-background/40 border border-border/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Week {decision.week}</span>
                      {decision.status && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {decision.status}
                        </span>
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
                          <span className="text-xs text-foreground">{decision.forum}</span>
                        </div>
                      )}
                      
                      <div className="pt-1 border-t border-border/30">
                        <span className="text-xs font-medium text-muted-foreground block mb-1">Decision:</span>
                        <div className="text-xs text-foreground/90 leading-relaxed">
                          <MarkdownText content={decision.decisionOutcome} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 sm:py-12">
              <p className="text-sm text-muted-foreground">No decisions found from the last month</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
