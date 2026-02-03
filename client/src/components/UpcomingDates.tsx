import { trpc } from "@/lib/trpc";
import { Calendar, Cpu, Code, CheckCircle2, Rocket } from "lucide-react";
import { format, getWeek, isPast } from "date-fns";

export default function UpcomingDates() {
  const pdpGates = trpc.milestones.getUpcoming.useQuery({ milestoneType: "pdp_gates", limit: 8 });
  const swMilestones = trpc.milestones.getUpcoming.useQuery({ milestoneType: "sw_milestones", limit: 8 });
  const hwDates = trpc.milestones.getUpcoming.useQuery({ milestoneType: "hw_dates", limit: 8 });
  const releaseDates = trpc.milestones.getReleaseDates.useQuery({ limit: 8 });

  const sections = [
    {
      title: "PDP Gates",
      type: "pdp_gates" as const,
      icon: Calendar,
      data: pdpGates.data || [],
      isLoading: pdpGates.isLoading,
      color: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-blue-400",
    },
    {
      title: "Software Milestones",
      type: "sw_milestones" as const,
      icon: Code,
      data: swMilestones.data || [],
      isLoading: swMilestones.isLoading,
      color: "from-purple-500/20 to-pink-500/20",
      iconColor: "text-purple-400",
    },
    {
      title: "Hardware Dates",
      type: "hw_dates" as const,
      icon: Cpu,
      data: hwDates.data || [],
      isLoading: hwDates.isLoading,
      color: "from-orange-500/20 to-red-500/20",
      iconColor: "text-orange-400",
    },
    {
      title: "Software Releases (Next Month)",
      type: "release_dates" as const,
      icon: Rocket,
      data: releaseDates.data || [],
      isLoading: releaseDates.isLoading,
      color: "from-green-500/20 to-emerald-500/20",
      iconColor: "text-green-400",
    },
  ];

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Upcoming Dates</h2>
        <p className="text-sm text-muted-foreground">Program milestones and key dates</p>
      </div>

      {/* Four Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="glass-card p-6 rounded-xl border border-white/10"
            >
              {/* Section Title */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${section.color}`}>
                  <Icon className={`w-5 h-5 ${section.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
              </div>

              {/* Milestones List */}
              {section.isLoading ? (
                <div className="space-y-1.5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-white/5 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : section.data.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No upcoming milestones</p>
              ) : (
                <div className="space-y-1.5">
                  {section.data.map((milestone) => {
                    const milestoneDate = new Date(milestone.milestoneDate);
                    const year = milestoneDate.getFullYear();
                    const weekNum = getWeek(milestoneDate, { weekStartsOn: 1 });
                    const isComplete = isPast(milestoneDate);
                    
                    // Format date with week number for 2026 dates
                    const dateDisplay = year === 2026 
                      ? `W${weekNum} (${format(milestoneDate, "MMM d")})`
                      : format(milestoneDate, "MMM d, yyyy");
                    
                    return (
                      <div
                        key={milestone.id}
                        className={`group hover:bg-white/5 p-2 rounded-lg transition-colors ${
                          isComplete ? "opacity-70" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 flex items-start gap-2">
                            {isComplete && section.type === "pdp_gates" && (
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold mb-1 truncate ${
                                isComplete ? "text-foreground/70" : "text-foreground"
                              }`}>
                                {milestone.product}
                              </p>
                              <p className="text-xs text-muted-foreground">{milestone.milestoneName}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className={`text-xs font-mono whitespace-nowrap ${
                              isComplete ? "text-foreground/50" : "text-foreground/80"
                            }`}>
                              {dateDisplay}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
