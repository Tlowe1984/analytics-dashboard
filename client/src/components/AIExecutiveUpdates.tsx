import { Sparkles, Calendar, FileCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AIExecutiveUpdates() {
  const { data: devicesSummary, isLoading } = trpc.dashboard.generateDevicesSummary.useQuery();
  return (
    <div className="bg-background/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-lg">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold">AI Executive Updates</h2>
          <p className="text-xs text-muted-foreground">AI-generated insights and summaries</p>
        </div>
      </div>

      {/* Grid Layout: 2/3 left + 1/3 right stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content - 2/3 width */}
        <div className="lg:col-span-2 bg-background/40 border border-border/40 rounded-xl p-5 min-h-[300px]">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-6 bg-muted/20 rounded w-3/4 animate-pulse" />
              <div className="h-6 bg-muted/20 rounded w-5/6 animate-pulse" />
              <div className="h-6 bg-muted/20 rounded w-4/6 animate-pulse" />
            </div>
          ) : (
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-2.5 flex-shrink-0 bg-primary" />
                <p className="text-base leading-relaxed">
                  <span className="font-bold">Devices:</span> {devicesSummary?.summary || "Loading summary..."}
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-2.5 flex-shrink-0 bg-primary" />
                <p className="text-base leading-relaxed">
                  <span className="font-bold">Software:</span> <span className="text-muted-foreground italic">Coming soon</span>
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-2.5 flex-shrink-0 bg-primary" />
                <p className="text-base leading-relaxed">
                  <span className="font-bold">Systems:</span> <span className="text-muted-foreground italic">Coming soon</span>
                </p>
              </li>
            </ul>
          )}
        </div>

        {/* Right Side - Stacked sections */}
        <div className="space-y-4">
          {/* Upcoming Section - Top Right */}
          <div className="bg-background/40 border border-border/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded bg-blue-500/10">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-sm">UPCOMING</h3>
            </div>
            <p className="text-xs text-muted-foreground italic">Upcoming items will appear here</p>
          </div>

          {/* Decisions Section - Bottom Right */}
          <div className="bg-background/40 border border-border/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded bg-orange-500/10">
                <FileCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-bold text-sm">DECISIONS</h3>
            </div>
            <p className="text-xs text-muted-foreground italic">Recent decisions will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
