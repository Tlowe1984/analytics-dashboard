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
    label: "Highlights",
    color: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-500/10",
  },
  risks: {
    icon: AlertTriangle,
    label: "Risks / Opens",
    color: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-500/10",
  },
  upcoming: {
    icon: Calendar,
    label: "Upcoming",
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

function ProductSection({
  productCategory,
  sectionType,
  items,
}: {
  productCategory: "ai_glasses" | "wrist" | "arg_ssg";
  sectionType: "highlights" | "risks" | "upcoming";
  items: DashboardItem[];
}) {
  const product = productConfig[productCategory];
  const section = sectionConfig[sectionType];
  const SectionIcon = section.icon;

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 py-1">
          <div className="flex items-center gap-2 min-w-[140px] flex-shrink-0">
            <span className="text-sm font-medium text-muted-foreground">
              {product.label}
            </span>
          </div>
          <div className="flex items-start gap-2 flex-1">
            <div className={cn("p-1 rounded", section.bgClass)}>
              <SectionIcon className={cn("w-3 h-3", section.color)} />
            </div>
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
        </div>
      ))}
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
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted/20 rounded w-1/4 animate-pulse" />
                <div className="space-y-1.5">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-4 bg-muted/20 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const products: Array<"ai_glasses" | "wrist" | "arg_ssg"> = ["ai_glasses", "wrist", "arg_ssg"];
  const sections: Array<"highlights" | "risks" | "upcoming"> = ["highlights", "risks", "upcoming"];

  return (
    <div className="w-full">
      <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Cpu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Devices</h2>
            <p className="text-xs text-muted-foreground">Product category overview</p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((sectionType) => {
            const section = sectionConfig[sectionType];
            const SectionIcon = section.icon;
            
            // Get all items for this section across all products
            const sectionItems = allItems?.filter(item => item.sectionType === sectionType) || [];
            
            if (sectionItems.length === 0) return null;

            return (
              <div key={sectionType}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("p-1.5 rounded-lg", section.bgClass)}>
                    <SectionIcon className={cn("w-4 h-4", section.color)} />
                  </div>
                  <h3 className="font-semibold text-sm">{section.label}</h3>
                </div>
                <div className="space-y-0">
                  {products.map((product) => {
                    const productItems = sectionItems.filter(
                      (item) => item.productCategory === product
                    );
                    return (
                      <ProductSection
                        key={product}
                        productCategory={product}
                        sectionType={sectionType}
                        items={productItems}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
