import { trpc } from "@/lib/trpc";
import { Sparkles, AlertTriangle, Calendar, Glasses, Watch, Grid3x3, Cpu, Code, Layers, Trophy, FileText } from "lucide-react";
import { SystemsTab } from "./SystemsTab";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownText } from "./MarkdownText";

interface DashboardItem {
  id: number;
  sectionType: "highlights" | "risks" | "upcoming";
  productCategory: "ai_glasses" | "wrist" | "arg_ssg" | "in_market";
  content: string;
  isNew: number; // 1 if new information (blue text), 0 otherwise
  order: number;
  indentLevel?: number; // Indentation level for nested bullets
}

const sectionConfig = {
  highlights: {
    icon: Sparkles,
    label: "HIGHLIGHTS",
    color: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-500/10",
  },
  risks: {
    icon: AlertTriangle,
    label: "RISKS / OPENS",
    color: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-500/10",
  },
  upcoming: {
    icon: Calendar,
    label: "UPCOMING",
    color: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10",
  },
};

const productConfig = {
  ai_glasses: {
    icon: Glasses,
    label: "AI GLASSES",
  },
  wrist: {
    icon: Watch,
    label: "WRIST",
  },
  arg_ssg: {
    icon: Grid3x3,
    label: "ARG / SSG",
  },
  in_market: {
    icon: Layers,
    label: "IN-MARKET",
  },
};

function SectionContent({
  sectionType,
  items,
}: {
  sectionType: "highlights" | "risks" | "upcoming";
  items: DashboardItem[];
}) {
  const section = sectionConfig[sectionType];
  const SectionIcon = section.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("p-1 rounded", section.bgClass)}>
          <SectionIcon className={cn("w-3.5 h-3.5", section.color)} />
        </div>
        <h4 className="font-bold text-sm tracking-wide">{section.label}</h4>
      </div>

      <div className="space-y-1.5 pl-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No items yet</p>
        ) : (
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
        )}
      </div>
    </div>
  );
}

function ProductCard({
  productCategory,
  allItems,
}: {
  productCategory: "ai_glasses" | "wrist" | "arg_ssg" | "in_market";
  allItems: DashboardItem[];
}) {
  const product = productConfig[productCategory];
  const ProductIcon = product.icon;

  // Filter items for this product category
  const highlightItems = allItems.filter(
    (item) => item.productCategory === productCategory && item.sectionType === "highlights"
  );
  const riskItems = allItems.filter(
    (item) => item.productCategory === productCategory && item.sectionType === "risks"
  );
  const upcomingItems = allItems.filter(
    (item) => item.productCategory === productCategory && item.sectionType === "upcoming"
  );

  return (
    <div className="bg-background/40 border border-border/50 rounded-xl p-3 sm:p-5 space-y-2 sm:space-y-3 h-full">
      {/* Product Header */}
      <div className="flex items-center gap-2 sm:gap-3 pb-2 sm:pb-3 border-b border-border/30">
        <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
          <ProductIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-sm sm:text-base">{product.label}</h3>
          <p className="text-xs text-muted-foreground hidden sm:block">PROGRAM UPDATES</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <SectionContent sectionType="highlights" items={highlightItems} />
        <div className="border-t border-border/20 pt-4">
          <SectionContent sectionType="risks" items={riskItems} />
        </div>
        <div className="border-t border-border/20 pt-4">
          <SectionContent sectionType="upcoming" items={upcomingItems} />
        </div>
      </div>
    </div>
  );
}

function InMarketCard({ allItems }: { allItems: DashboardItem[] }) {
  const product = productConfig.in_market;
  const ProductIcon = product.icon;

  // Filter items for in_market category
  const highlightItems = allItems.filter(
    (item) => item.productCategory === "in_market" && item.sectionType === "highlights"
  );
  const riskItems = allItems.filter(
    (item) => item.productCategory === "in_market" && item.sectionType === "risks"
  );

  return (
    <div className="bg-background/40 border border-border/50 rounded-xl p-3 sm:p-5 space-y-2 sm:space-y-3 h-full">
      {/* Product Header */}
      <div className="flex items-center gap-2 sm:gap-3 pb-2 sm:pb-3 border-b border-border/30">
        <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
          <ProductIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-sm sm:text-base">{product.label}</h3>
          <p className="text-xs text-muted-foreground hidden sm:block">PROGRAM UPDATES</p>
        </div>
      </div>

      {/* Sections - Only Highlights and Risks */}
      <div className="space-y-3">
        <SectionContent sectionType="highlights" items={highlightItems} />
        <div className="border-t border-border/20 pt-4">
          <SectionContent sectionType="risks" items={riskItems} />
        </div>
      </div>
    </div>
  );
}

function DevicesTab({ sourceDocumentUrl }: { sourceDocumentUrl?: string }) {
  const { data: allItems, isLoading } = trpc.dashboard.getAll.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-background/40 border border-border/50 rounded-xl p-5 animate-pulse">
            <div className="h-12 bg-muted/20 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-4 bg-muted/20 rounded w-3/4" />
              <div className="h-4 bg-muted/20 rounded" />
              <div className="h-4 bg-muted/20 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const products: Array<"ai_glasses" | "wrist" | "arg_ssg" | "in_market"> = ["ai_glasses", "wrist", "arg_ssg", "in_market"];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a
          href={sourceDocumentUrl || "https://fburl.com/devicegrowthpr"} 
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          📄 View Source Document
        </a>
      </div>
      {/* In-Market tile above the other three */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <InMarketCard allItems={allItems || []} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {["ai_glasses", "wrist", "arg_ssg"].map((product) => (
          <ProductCard key={product} productCategory={product as "ai_glasses" | "wrist" | "arg_ssg"} allItems={allItems || []} />
        ))}
      </div>
    </div>
  );
}

const softwareSectionConfig = {
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

function SoftwareTab({ category, sourceDocumentUrl }: { category: "software_ie" | "software_ai" | "software_hearing"; sourceDocumentUrl?: string }) {
  // Query data for each section separately
  const { data: winsItems, isLoading: winsLoading } = trpc.software.getBySection.useQuery({ softwareCategory: category, sectionType: "wins" });
  const { data: execSummaryItems, isLoading: execLoading } = trpc.software.getBySection.useQuery({ softwareCategory: category, sectionType: "exec_summary" });
  const { data: decisionsItems, isLoading: decisionsLoading } = trpc.software.getBySection.useQuery({ softwareCategory: category, sectionType: "decisions" });
  
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

  // Items are already filtered by category and section from the queries

  const renderTile = (
    sectionType: "wins" | "exec_summary" | "decisions",
    items: typeof winsItems
  ) => {
    const section = softwareSectionConfig[sectionType];
    const SectionIcon = section.icon;

    // Special rendering for decisions
    if (sectionType === "decisions") {
      // Group decisions by category
      const pillarDecisions = items?.filter(item => item.category === "Pillar") || [];
      const fyiDecisions = items?.filter(item => item.category === "FYI") || [];

      return (
        <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className={cn("p-2 rounded", section.bgClass)}>
              <SectionIcon className={cn("w-5 h-5", section.color)} />
            </div>
            <h3 className="font-bold text-base tracking-wide">{section.label}</h3>
          </div>
          <div className="space-y-3">
            {items && items.length > 0 ? (
              <>
                {pillarDecisions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">PILLAR DECISIONS</h4>
                    <div className="space-y-3">
                      {pillarDecisions.map((item) => (
                        <div key={item.id} className="border-l-2 border-orange-500/30 pl-3 space-y-1">
                          <div className="text-sm font-medium text-foreground">
                            <MarkdownText content={item.topic || ""} />
                          </div>
                          {item.decisionOutcome && (
                            <div className="text-xs text-muted-foreground">
                              <MarkdownText content={item.decisionOutcome} />
                            </div>
                          )}
                          {item.dri && (
                            <div className="text-xs text-muted-foreground/70">
                              DRI: <MarkdownText content={item.dri} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {fyiDecisions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">FYI SUB-PILLAR DECISIONS</h4>
                    <div className="space-y-3">
                      {fyiDecisions.map((item) => (
                        <div key={item.id} className="border-l-2 border-blue-500/30 pl-3 space-y-1">
                          <div className="text-sm font-medium text-foreground">
                            <MarkdownText content={item.topic || ""} />
                          </div>
                          {item.decisionOutcome && (
                            <div className="text-xs text-muted-foreground">
                              <MarkdownText content={item.decisionOutcome} />
                            </div>
                          )}
                          {item.dri && (
                            <div className="text-xs text-muted-foreground/70">
                              DRI: <MarkdownText content={item.dri} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">No items yet</p>
            )}
          </div>
        </div>
      );
    }

    // Default rendering for wins and exec_summary
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
  };;

  // Render decisions as a structured table
  const renderDecisionsTable = () => {
    if (!decisionsItems || decisionsItems.length === 0) {
      return (
        <div className="bg-card/50 border border-border/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3 text-foreground">DECISIONS</h3>
          <p className="text-xs text-muted-foreground italic">No decisions yet</p>
        </div>
      );
    }

    return (
      <div className="bg-card/50 border border-border/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3 text-foreground">DECISIONS</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-2 font-semibold text-foreground/80">Topic / Decision Doc</th>
                <th className="text-left py-2 px-2 font-semibold text-foreground/80">DRI</th>
                <th className="text-left py-2 px-2 font-semibold text-foreground/80">Decision Makers</th>
                <th className="text-left py-2 px-2 font-semibold text-foreground/80">Decision Outcome</th>
              </tr>
            </thead>
            <tbody>
              {decisionsItems.map((item, idx) => (
                <tr key={idx} className="border-b border-border/30 last:border-0">
                  <td className="py-2 px-2 align-top">
                    <MarkdownText content={item.topic || item.decision_doc || '-'} />
                  </td>
                  <td className="py-2 px-2 align-top">
                    <MarkdownText content={item.dri || '-'} />
                  </td>
                  <td className="py-2 px-2 align-top">
                    <MarkdownText content={item.decisionMakers || '-'} />
                  </td>
                  <td className="py-2 px-2 align-top">
                    <MarkdownText content={item.decisionOutcome || '-'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a
          href={sourceDocumentUrl || "https://docs.google.com/document/d/1J_Q7MoO7q3VmpxZEujzNZx209YooeX_pGNaOMFxmgR0/edit"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          📄 View Source Document
        </a>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderTile("wins", winsItems)}
        {renderTile("exec_summary", execSummaryItems)}
      </div>
      <div className="mt-4">
        {renderDecisionsTable()}
      </div>
    </div>
  );
}



export default function ToplineView() {
  // State for active tab - initialize from URL hash if present
  const [activeTab, setActiveTab] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'detailed-updates-devices') return 'devices';
    if (hash === 'detailed-updates-software') return 'software';
    if (hash === 'detailed-updates-systems') return 'systems';
    return 'devices';
  });

  // Listen for hash changes to update tab
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'detailed-updates-devices') setActiveTab('devices');
      else if (hash === 'detailed-updates-software') setActiveTab('software');
      else if (hash === 'detailed-updates-systems') setActiveTab('systems');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Get the most recent update timestamp from all dashboard items
  const { data: lastUpdatedData } = trpc.dashboard.getLastUpdated.useQuery();
  const lastUpdated = lastUpdatedData?.updatedAt;

  // Get source document URL
  const { data: sourceDocumentUrl } = trpc.dashboard.getSourceDocumentUrl.useQuery();

  return (
    <div id="detailed-updates" className="w-full">
      <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-6">
        {/* Section Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10">
              <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold">DETAILED UPDATES</h2>
          </div>
          <p className="text-xs text-muted-foreground ml-0 sm:ml-11">
            Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            }) : 'Loading...'} • <span className="text-blue-600 dark:text-blue-400 font-medium">Blue text = New information</span>
          </p>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" id="detailed-updates-tabs">
          <TabsList className="flex flex-wrap w-full gap-2 mb-6 h-auto bg-transparent p-0">
            <TabsTrigger 
              value="devices" 
              className="text-xs sm:text-sm px-3 sm:px-4 py-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-300"
            >
              Devices
            </TabsTrigger>
            <TabsTrigger 
              value="software_ie" 
              className="text-xs sm:text-sm px-3 sm:px-4 py-2 data-[state=active]:bg-green-100 data-[state=active]:text-green-900 dark:data-[state=active]:bg-green-900/30 dark:data-[state=active]:text-green-300"
            >
              <span className="hidden sm:inline">Experiences & Interfaces</span>
              <span className="sm:hidden">I+E</span>
            </TabsTrigger>
            <TabsTrigger 
              value="software_ai" 
              className="text-xs sm:text-sm px-3 sm:px-4 py-2 data-[state=active]:bg-green-100 data-[state=active]:text-green-900 dark:data-[state=active]:bg-green-900/30 dark:data-[state=active]:text-green-300"
            >
              AI
            </TabsTrigger>
            <TabsTrigger 
              value="software_hearing" 
              className="text-xs sm:text-sm px-3 sm:px-4 py-2 data-[state=active]:bg-green-100 data-[state=active]:text-green-900 dark:data-[state=active]:bg-green-900/30 dark:data-[state=active]:text-green-300"
            >
              Hearing
            </TabsTrigger>
            <TabsTrigger 
              value="systems" 
              className="text-xs sm:text-sm px-3 sm:px-4 py-2 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-900 dark:data-[state=active]:bg-orange-900/30 dark:data-[state=active]:text-orange-300"
            >
              Systems
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="devices">
            <DevicesTab sourceDocumentUrl={sourceDocumentUrl} />
          </TabsContent>
          
          <TabsContent value="software_ie">
            <SoftwareTab category="software_ie" sourceDocumentUrl={sourceDocumentUrl} />
          </TabsContent>
          
          <TabsContent value="software_ai">
            <SoftwareTab category="software_ai" sourceDocumentUrl={sourceDocumentUrl} />
          </TabsContent>
          
          <TabsContent value="software_hearing">
            <SoftwareTab category="software_hearing" sourceDocumentUrl={sourceDocumentUrl} />
          </TabsContent>
          
          <TabsContent value="systems">
            <SystemsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
