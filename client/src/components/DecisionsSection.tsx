import { trpc } from "@/lib/trpc";
import { FileText, ExternalLink } from "lucide-react";
import { MarkdownText } from "./MarkdownText";

export default function DecisionsSection() {
  const { data: decisions, isLoading } = trpc.decisions.getAll.useQuery();

  const GOOGLE_DOC_URL = "https://drive.google.com/drive/folders/[YOUR_FOLDER_ID]"; // Link to Wearables Everything folder

  if (isLoading) {
    return (
      <div className="w-full py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[2000px] mx-auto">
          <div className="glass-card rounded-2xl p-8">
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
    <div className="w-full py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[2000px] mx-auto">
        <div className="glass-card rounded-2xl p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Decisions</h2>
                <p className="text-sm text-muted-foreground">Strategic decisions from the last month</p>
              </div>
            </div>
            <a
              href={GOOGLE_DOC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors glass-card rounded-lg"
            >
              View Source Document
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Table */}
          {decisions && decisions.length > 0 ? (
            <div className="overflow-x-auto">
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
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No decisions found from the last month</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
