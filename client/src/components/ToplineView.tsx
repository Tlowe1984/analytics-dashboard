import { trpc } from "@/lib/trpc";
import { Sparkles, AlertTriangle, Calendar, Glasses, Watch, Grid3x3, Cpu, Code, Layers, Trophy, FileText } from "lucide-react";
import { SystemsTab } from "./SystemsTab";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownText } from "./MarkdownText";

interface DashboardItem {
  id: number;
  sectionType: "highlights" | "risks" | "upcoming";
  productCategory: "ai_glasses" | "wrist" | "arg_ssg";
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
    label: "AI Glasses",
  },
  wrist: {
    icon: Watch,
    label: "Wrist",
  },
  arg_ssg: {
    icon: Grid3x3,
    label: "ARG / SSG",
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
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  item.isNew === 1
                    ? "text-blue-600 dark:text-blue-400 font-medium"
                    : "text-foreground/90"
                )}
              >
                <MarkdownText content={item.content} />
              </p>
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
  productCategory: "ai_glasses" | "wrist" | "arg_ssg";
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
    <div className="bg-background/40 border border-border/50 rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4 h-full">
      {/* Product Header */}
      <div className="flex items-center gap-2 sm:gap-3 pb-2 sm:pb-3 border-b border-border/30">
        <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
          <ProductIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-sm sm:text-base">{product.label}</h3>
          <p className="text-xs text-muted-foreground hidden sm:block">Executive Summary</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
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

function DevicesTab() {
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

  const products: Array<"ai_glasses" | "wrist" | "arg_ssg"> = ["ai_glasses", "wrist", "arg_ssg"];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a
          href="https://fburl.com/devicegrowthpr" 
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          📄 View Source Document
        </a>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <ProductCard key={product} productCategory={product} allItems={allItems || []} />
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

function SoftwareTab() {
  const { data: allItems, isLoading } = trpc.software.getAll.useQuery();

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

  const winsItems = allItems?.filter(item => item.sectionType === "wins") || [];
  const execSummaryItems = allItems?.filter(item => item.sectionType === "exec_summary") || [];
  const decisionsItems = allItems?.filter(item => item.sectionType === "decisions") || [];

  const renderTile = (
    sectionType: "wins" | "exec_summary" | "decisions",
    items: typeof allItems
  ) => {
    const section = softwareSectionConfig[sectionType];
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
                <p
                  className={cn(
                    "text-sm leading-relaxed",
                    item.isNew === 1
                      ? "text-blue-600 dark:text-blue-400 font-medium"
                      : "text-foreground/90"
                  )}
                >
                  <MarkdownText content={item.content} />
                </p>
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
          href="https://docs.google.com/document/d/1J_Q7MoO7q3VmpxZEujzNZx209YooeX_pGNaOMFxmgR0/edit?tab=t.ii083dwt776o"
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



export default function ToplineView() {
  return (
    <div className="w-full">
      <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-2xl p-3 sm:p-6">
        {/* Section Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10">
            <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Exec Summary Week {String(Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000))}</h2>
            <p className="text-xs text-muted-foreground hidden sm:block">Product category overview</p>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="devices" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="devices" className="text-xs sm:text-sm px-2 sm:px-4">
              <span className="hidden sm:inline">Devices</span>
              <span className="sm:hidden">Devices</span>
            </TabsTrigger>
            <TabsTrigger value="software" className="text-xs sm:text-sm px-2 sm:px-4">
              <span className="hidden sm:inline">Software (I+E, AI, Hearing)</span>
              <span className="sm:hidden">Software</span>
            </TabsTrigger>
            <TabsTrigger value="systems" className="text-xs sm:text-sm px-2 sm:px-4">
              <span className="hidden sm:inline">Systems</span>
              <span className="sm:hidden">Systems</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="devices">
            <DevicesTab />
          </TabsContent>
          
          <TabsContent value="software">
            <SoftwareTab />
          </TabsContent>
          
          <TabsContent value="systems">
            <SystemsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
