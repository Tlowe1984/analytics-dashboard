import { Code } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MarkdownText } from './MarkdownText';

export default function SoftwareWearablesSection() {
  // Use software.getWearablesTagged which queries ALL sources (Software, AI, Systems, Hearing, Devices)
  // dashboard.getWearablesTaggedItems only returns Software-source items
  const { data: wearablesItems, isLoading } = trpc.software.getWearablesTagged.useQuery();
  const { data: softwareSourceMeta } = trpc.dashboard.getSourceFileMeta.useQuery({ section: 'software_ie' });

  // Route items to the correct tab based on their source heading title:
  // "Wins" / "Launches" → Highlights
  // "Exec Summary" / "Executive Summary" → Executive Summary
  // "Risks/Opens" / "Help Needed" / "Hotspots" (exec_summary from hotspot table) → Risks/Opens
  const highlights = wearablesItems?.filter(item => {
    const s = item.sectionType as string;
    return s === 'wins';
  }) || [];

  const execSummary = wearablesItems?.filter(item => {
    const s = item.sectionType as string;
    // exec_summary from text bullets (not hotspots) → Executive Summary
    // Hotspots are stored as exec_summary but come from source "Software" with hotspot content
    // We distinguish by checking if the source is not a hotspot (hotspots have bold title + " - " format)
    if (s !== 'exec_summary') return false;
    // Hotspot items have the pattern "**Title** - Description" — route those to Risks/Opens
    const isHotspot = /^\*\*[^*]+\*\* - .+/.test(item.content);
    return !isHotspot;
  }) || [];

  const risks = wearablesItems?.filter(item => {
    const s = item.sectionType as string;
    if (s === 'help_needed' || s === 'risks') return true;
    // Hotspot items (exec_summary with bold-title-dash format) → Risks/Opens
    if (s === 'exec_summary') {
      const isHotspot = /^\*\*[^*]+\*\* - .+/.test(item.content);
      return isHotspot;
    }
    return false;
  }) || [];

  // Helper function to format bullet content (remove [Wearables-tag] tag)
  const formatBulletContent = (content: string) => {
    let cleanContent = content.replace(/\s*\[Wearables-tag\]\s*$/i, '');
    cleanContent = cleanContent.replace(/\*\*\*\*/g, '');
    return cleanContent;
  };

  const renderItems = (items: typeof wearablesItems) => {
    if (!items || items.length === 0) {
      return <div className="text-sm text-muted-foreground italic">None this week</div>;
    }
    return (
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-muted-foreground/30" />
            <div className="text-sm leading-relaxed text-foreground/90">
              <MarkdownText content={formatBulletContent(item.content)} />
            </div>
          </div>
        ))}
      </ul>
    );
  };

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <Code className="w-5 h-5 text-green-500" />
        <h3 className="text-lg font-bold uppercase">SOFTWARE</h3>
        <a 
          href="#detailed-updates-software" 
          className="text-xs text-blue-500 hover:text-blue-600 hover:underline font-medium transition-colors"
          onClick={() => {
            setTimeout(() => {
              document.getElementById('detailed-updates')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
        >
          Details
        </a>
      </div>
      {softwareSourceMeta?.sourceFileName && (
        <div className="ml-7 mb-2 -mt-1">
          <span className="text-xs text-muted-foreground">Source: </span>
          {softwareSourceMeta.sourceFileUrl ? (
            <a href={softwareSourceMeta.sourceFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{softwareSourceMeta.sourceFileName}</a>
          ) : (
            <span className="text-xs text-muted-foreground">{softwareSourceMeta.sourceFileName}</span>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="ml-7 space-y-2">
          <div className="h-4 bg-muted/20 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-muted/20 rounded w-full animate-pulse" />
        </div>
      ) : (
        <div className="space-y-3 ml-7">
          {/* Highlights — from Wins/Launches heading */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Highlights</h4>
            {renderItems(highlights)}
          </div>

          {/* Executive Summary — from Exec Summary heading */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Executive Summary</h4>
            {renderItems(execSummary)}
          </div>
          
          {/* Risks/Opens — from Risks/Opens, Help Needed, and Hotspots */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Risks / Opens</h4>
            {renderItems(risks)}
          </div>
        </div>
      )}
    </div>
  );
}
