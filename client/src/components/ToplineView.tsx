import { trpc } from "@/lib/trpc";
import { Sparkles, AlertTriangle, Calendar, Glasses, Watch, Grid3x3, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardItem {
  id: number;
  sectionType: "highlights" | "risks" | "upcoming";
  productCategory: "ai_glasses" | "wrist" | "arg_ssg";
  content: string;
  isNew: number; // 1 if new information (blue text), 0 otherwise
  order: number;
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
            <div key={item.id} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-muted-foreground/30" />
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  item.isNew === 1
                    ? "text-blue-600 dark:text-blue-400 font-medium"
                    : "text-foreground/90"
                )}
              >
                {item.content}
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
    <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-xl p-5 hover:border-border/80 transition-colors">
      {/* Product Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
        <div className="p-2 rounded-lg bg-primary/10">
          <ProductIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold">{product.label}</h3>
          <p className="text-xs text-muted-foreground">Executive Summary</p>
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

export default function ToplineView() {
  const { data: allItems, isLoading } = trpc.dashboard.getAll.useQuery();

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10 animate-pulse">
              <Cpu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Devices</h2>
              <p className="text-xs text-muted-foreground">Product category overview</p>
            </div>
          </div>
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
        </div>
      </div>
    );
  }

  const products: Array<"ai_glasses" | "wrist" | "arg_ssg"> = ["ai_glasses", "wrist", "arg_ssg"];

  return (
    <div className="w-full">
      <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Cpu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Devices Week {String(Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000))}</h2>
            <p className="text-xs text-muted-foreground">Product category overview</p>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <ProductCard key={product} productCategory={product} allItems={allItems || []} />
          ))}
        </div>
      </div>
    </div>
  );
}
