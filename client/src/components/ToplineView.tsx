import { trpc } from "@/lib/trpc";
import { Sparkles, AlertTriangle, Calendar, Glasses, Watch, Grid3x3, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardItem {
  id: number;
  sectionType: "highlights" | "risks" | "upcoming";
  productCategory: "ai_glasses" | "wrist" | "arg_ssg";
  content: string;
  order: number;
}

const sectionConfig = {
  highlights: {
    icon: Sparkles,
    label: "Highlights",
    color: "var(--highlight-color)",
    bgClass: "bg-green-500/10",
    iconClass: "text-green-600 dark:text-green-400",
  },
  risks: {
    icon: AlertTriangle,
    label: "Risks / Opens",
    color: "var(--risk-color)",
    bgClass: "bg-orange-500/10",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  upcoming: {
    icon: Calendar,
    label: "Upcoming",
    color: "var(--upcoming-color)",
    bgClass: "bg-blue-500/10",
    iconClass: "text-blue-600 dark:text-blue-400",
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-lg", section.bgClass)}>
          <SectionIcon className={cn("w-4 h-4", section.iconClass)} />
        </div>
        <h4 className="font-semibold text-sm">{section.label}</h4>
      </div>

      <div className="space-y-2 pl-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No items yet</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 group">
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: section.color }}
              />
              <p className="text-sm text-foreground/90 leading-relaxed group-hover:text-foreground transition-colors">
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
    <div className="glass-card rounded-2xl p-8 hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
      {/* Product Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
        <div className="p-3 rounded-xl bg-primary/10">
          <ProductIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold">{product.label}</h3>
          <p className="text-xs text-muted-foreground">Executive Summary</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        <SectionContent sectionType="highlights" items={highlightItems} />
        <div className="border-t border-border/30 pt-6">
          <SectionContent sectionType="risks" items={riskItems} />
        </div>
        <div className="border-t border-border/30 pt-6">
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
        <div className="devices-section rounded-3xl p-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-8 animate-pulse">
                <div className="h-16 bg-muted/20 rounded-lg mb-6" />
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="h-6 bg-muted/20 rounded w-1/3" />
                    <div className="h-4 bg-muted/20 rounded" />
                    <div className="h-4 bg-muted/20 rounded w-5/6" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-6 bg-muted/20 rounded w-1/3" />
                    <div className="h-4 bg-muted/20 rounded" />
                    <div className="h-4 bg-muted/20 rounded w-5/6" />
                  </div>
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
      {/* Devices Section Container */}
      <div className="devices-section rounded-3xl p-8">
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-blue-500/10">
            <Cpu className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Devices</h2>
            <p className="text-sm text-muted-foreground">Product category overview</p>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product} productCategory={product} allItems={allItems || []} />
          ))}
        </div>
      </div>
    </div>
  );
}
