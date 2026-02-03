import { trpc } from "@/lib/trpc";
import { Sparkles, AlertTriangle, Calendar, Glasses, Watch, Grid3x3 } from "lucide-react";
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

function SectionCard({
  sectionType,
  productCategory,
  items,
}: {
  sectionType: "highlights" | "risks" | "upcoming";
  productCategory: "ai_glasses" | "wrist" | "arg_ssg";
  items: DashboardItem[];
}) {
  const section = sectionConfig[sectionType];
  const product = productConfig[productCategory];
  const SectionIcon = section.icon;
  const ProductIcon = product.icon;

  return (
    <div className="glass-card rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", section.bgClass)}>
            <SectionIcon className={cn("w-5 h-5", section.iconClass)} />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground">{section.label}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ProductIcon className="w-4 h-4 text-foreground/70" />
              <p className="text-base font-medium text-foreground">{product.label}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No items yet</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 group">
              <div
                className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
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

export default function ToplineView() {
  const { data: allItems, isLoading } = trpc.dashboard.getAll.useQuery();

  if (isLoading) {
    return (
      <div className="w-full py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
              <div className="h-20 bg-muted/20 rounded-lg mb-4" />
              <div className="space-y-3">
                <div className="h-4 bg-muted/20 rounded" />
                <div className="h-4 bg-muted/20 rounded w-5/6" />
                <div className="h-4 bg-muted/20 rounded w-4/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Group items by section and product
  const groupedItems: Record<string, DashboardItem[]> = {};
  allItems?.forEach((item) => {
    const key = `${item.sectionType}_${item.productCategory}`;
    if (!groupedItems[key]) {
      groupedItems[key] = [];
    }
    groupedItems[key].push(item);
  });

  const sections: Array<"highlights" | "risks" | "upcoming"> = ["highlights", "risks", "upcoming"];
  const products: Array<"ai_glasses" | "wrist" | "arg_ssg"> = ["ai_glasses", "wrist", "arg_ssg"];

  return (
    <div className="w-full py-8">
      {/* Section headers */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto mb-8">
        <h2 className="text-3xl font-bold mb-2">Executive Summary</h2>
        <p className="text-muted-foreground">Topline view across product categories</p>
      </div>

      {/* 3x3 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
        {sections.map((section) =>
          products.map((product) => {
            const key = `${section}_${product}`;
            const items = groupedItems[key] || [];
            return (
              <SectionCard
                key={key}
                sectionType={section}
                productCategory={product}
                items={items}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
