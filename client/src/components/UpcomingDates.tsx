import { trpc } from "@/lib/trpc";
import { Calendar, Cpu, Code } from "lucide-react";
import { format } from "date-fns";

export default function UpcomingDates() {
  const pdpGates = trpc.milestones.getUpcoming.useQuery({ milestoneType: "pdp_gates", limit: 8 });
  const swMilestones = trpc.milestones.getUpcoming.useQuery({ milestoneType: "sw_milestones", limit: 8 });
  const hwDates = trpc.milestones.getUpcoming.useQuery({ milestoneType: "hw_dates", limit: 8 });

  const sections = [
    {
      title: "Upcoming PDP Gates",
      icon: Calendar,
      data: pdpGates.data || [],
      isLoading: pdpGates.isLoading,
      color: "from-purple-500/20 to-purple-600/20",
      iconColor: "text-purple-400",
    },
    {
      title: "Key Software Milestones",
      icon: Code,
      data: swMilestones.data || [],
      isLoading: swMilestones.isLoading,
      color: "from-blue-500/20 to-blue-600/20",
      iconColor: "text-blue-400",
    },
    {
      title: "Hardware Dates",
      icon: Cpu,
      data: hwDates.data || [],
      isLoading: hwDates.isLoading,
      color: "from-green-500/20 to-green-600/20",
      iconColor: "text-green-400",
    },
  ];

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Upcoming Dates</h2>
        <p className="text-sm text-white/60">Program milestones and key dates</p>
      </div>

      {/* Three Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <h3 className="text-lg font-semibold text-white">{section.title}</h3>
              </div>

              {/* Milestones List */}
              {section.isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-white/5 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : section.data.length === 0 ? (
                <p className="text-sm text-white/40 italic">No upcoming milestones</p>
              ) : (
                <div className="space-y-3">
                  {section.data.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="group hover:bg-white/5 p-3 rounded-lg transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 mb-1 truncate">
                            {milestone.milestoneName}
                          </p>
                          <p className="text-xs text-white/50">{milestone.product}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs font-mono text-white/70">
                            {format(new Date(milestone.milestoneDate), "MMM d")}
                          </p>
                          <p className="text-xs text-white/40">
                            {format(new Date(milestone.milestoneDate), "yyyy")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
