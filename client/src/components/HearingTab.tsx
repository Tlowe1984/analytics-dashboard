import { trpc } from "@/lib/trpc";
import { Trophy, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownText } from "./MarkdownText";

const hearingSectionConfig = {
  wins: {
    icon: Trophy,
    label: "WINS",
    color: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-500/10",
  },
  exec_summary: {
    icon: FileText,
    label: "EXEC SUMMARY",
    color: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10",
  },
  decisions: {
    icon: AlertTriangle,
    label: "DECISIONS",
    color: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-500/10",
  },
};

export function HearingTab({ sourceDocumentUrl }: { sourceDocumentUrl?: string }) {
  // Query data for each section separately
  const { data: winsItems, isLoading: winsLoading } = trpc.hearing.getBySection.useQuery({ sectionType: "wins" });
  const { data: execSummaryItems, isLoading: execLoading } = trpc.hearing.getBySection.useQuery({ sectionType: "exec_summary" });
  const { data: decisionsItems, isLoading: decisionsLoading } = trpc.hearing.getBySection.useQuery({ sectionType: "decisions" });
  
  const isLoading = winsLoading || execLoading || decisionsLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-background/40 border border-border/50 rounded-xl p-5 animate-pulse">
            <div className="h-6 bg-muted/20 rounded mb-4 w-1/4" />
            <div className="space-y-3">
              <div className="h-4 bg-muted/20 rounded" />
              <div className="h-4 bg-muted/20 rounded w-5/6" />
              <div className="h-4 bg-muted/20 rounded w-4/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const renderTile = (
    sectionType: "wins" | "exec_summary" | "decisions",
    items: typeof winsItems
  ) => {
    const section = hearingSectionConfig[sectionType];
    const SectionIcon = section.icon;

    return (
      <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className={cn("p-2 rounded", section.bgClass)}>
            <SectionIcon className={cn("w-5 h-5", section.color)} />
          </div>
          <h3 className="font-bold text-base tracking-wide">{section.label}</h3>
        </div>
        <div className="space-y-2.5">
          {items && items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="flex items-start gap-2" style={{ paddingLeft: `${(item.indentLevel || 0) * 1.5}rem` }}>
                <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-muted-foreground/30" />
                <div
                  className={cn(
                    "text-sm leading-relaxed",
                    item.isNew === 1
                      ? "text-blue-600 dark:text-blue-400 font-medium"
                      : "text-foreground/90"
                  )}
                >
                  <MarkdownText content={item.content} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">No items yet</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a
          href={sourceDocumentUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          📄 View Source Document
        </a>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {renderTile("wins", winsItems)}
        {renderTile("exec_summary", execSummaryItems)}
        {renderTile("decisions", decisionsItems)}
      </div>
    </div>
  );
}
