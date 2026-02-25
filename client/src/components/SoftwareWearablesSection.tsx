import { Code } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MarkdownText } from './MarkdownText';

export default function SoftwareWearablesSection() {
  const { data: wearablesItems, isLoading } = trpc.dashboard.getWearablesTaggedItems.useQuery();

  // Categorize items into Highlights (wins) and Risks/Opens (exec_summary, help_needed, risks, highlights)
  const highlights = wearablesItems?.filter(item => 
    item.sectionType === 'wins' || item.sectionType === 'highlights'
  ) || [];
  const risks = wearablesItems?.filter(item => 
    item.sectionType === 'exec_summary' || item.sectionType === 'help_needed' || item.sectionType === 'risks'
  ) || [];

  // Helper function to extract title from content
  const extractTitle = (content: string) => {
    // Look for bold text at the start: **[Title]** or **Title:**
    const boldMatch = content.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      return boldMatch[1];
    }
    
    // Look for text before first colon
    const colonMatch = content.match(/^([^:]+):/);
    if (colonMatch) {
      return colonMatch[1];
    }
    
    return null;
  };

  // Helper function to format bullet content (preserve title in bold, rest as is)
  const formatBulletContent = (content: string) => {
    // Remove [Wearables-tag] from the end
    let cleanContent = content.replace(/\s*\[Wearables-tag\]\s*$/, '');
    
    // FOOLPROOF FIX: Remove all **** patterns (double bold markers)
    // This handles cases where Word doc has consecutive bold runs
    cleanContent = cleanContent.replace(/\*\*\*\*/g, '');
    
    // Bold hotspot titles: if content has "Title - Description" format, bold the title
    // Check if there's a " - " separator (hotspot format)
    const separatorMatch = cleanContent.match(/^([^-]+) - (.+)$/);
    if (separatorMatch) {
      const title = separatorMatch[1].trim();
      const description = separatorMatch[2].trim();
      // If title is not already bolded, add bold markdown
      if (!title.startsWith('**')) {
        cleanContent = `**${title}** - ${description}`;
      }
    }
    
    return cleanContent;
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
            // Scroll to detailed updates after hash change
            setTimeout(() => {
              document.getElementById('detailed-updates')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
        >
          Details
        </a>
      </div>
      
      {isLoading ? (
        <div className="ml-7 space-y-2">
          <div className="h-4 bg-muted/20 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-muted/20 rounded w-full animate-pulse" />
        </div>
      ) : (
        <div className="space-y-3 ml-7">
          {/* Highlights */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Highlights</h4>
            <ul className="space-y-1 list-disc list-inside">
              {highlights.length > 0 ? (
                highlights.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-muted-foreground/30" />
                    <div className="text-sm leading-relaxed text-foreground/90">
                      <MarkdownText content={formatBulletContent(item.content)} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground italic">No highlights available</div>
              )}
            </ul>
          </div>
          
          {/* Risks/Opens */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Risks / Opens</h4>
            <ul className="space-y-1 list-disc list-inside">
              {risks.length > 0 ? (
                risks.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-muted-foreground/30" />
                    <div className="text-sm leading-relaxed text-foreground/90">
                      <MarkdownText content={formatBulletContent(item.content)} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground italic">No risks available</div>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
