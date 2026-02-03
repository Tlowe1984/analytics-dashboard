import { Monitor, Zap, Server, CalendarDays, CheckCircle2 } from "lucide-react";

const placeholderSections = [
  {
    id: "device",
    title: "Device View",
    description: "Hardware metrics and device performance analytics",
    icon: Monitor,
  },
  {
    id: "experience",
    title: "Experience & Interface View",
    description: "User experience metrics and interface analytics",
    icon: Zap,
  },
  {
    id: "system",
    title: "System View",
    description: "System architecture and technical infrastructure",
    icon: Server,
  },
  {
    id: "dates",
    title: "Upcoming Dates",
    description: "Key milestones and important deadlines",
    icon: CalendarDays,
  },
  {
    id: "decisions",
    title: "Decisions",
    description: "Strategic decisions and action items",
    icon: CheckCircle2,
  },
];

export default function PlaceholderSections() {
  return (
    <div className="w-full py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1600px] mx-auto">
        <h2 className="text-2xl font-bold mb-8">Additional Dashboard Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {placeholderSections.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.id}
                className="glass-card rounded-2xl p-8 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                  <div className="pt-2">
                    <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                      Coming Soon
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
