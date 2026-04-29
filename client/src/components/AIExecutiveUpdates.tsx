import { Sparkles, Smartphone, Code, Cpu, Calendar, FileText, FileCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MarkdownText } from './MarkdownText';
import SoftwareWearablesSection from './SoftwareWearablesSection';

export default function AIExecutiveUpdates() {
  const { data: summaries, isLoading } = trpc.dashboard.generateExecutiveSummaries.useQuery();
  const { data: upcomingItems } = trpc.dashboard.getUpcomingItems.useQuery();
  const { data: pdpMilestones } = trpc.dashboard.getPDPMilestonesThisAndNextWeek.useQuery();
  const { data: recentDecisions } = trpc.dashboard.getRecentDecisions.useQuery();
  const { data: devicesSourceMeta } = trpc.dashboard.getSourceFileMeta.useQuery({ section: 'devices' });
  const { data: systemsSourceMeta } = trpc.dashboard.getSourceFileMeta.useQuery({ section: 'systems' });
  
  // Filter upcomingItems to only show upcoming_decision type (reviews)
  const upcomingDecisions = upcomingItems?.filter(item => item.type === 'upcoming_decision') || [];
  
  // Helper function to format week number from date
  const getWeekNumber = (date: Date) => {
    const d = new Date(date);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `W${week}`;
  };

  // Get current week number
  const currentWeek = getWeekNumber(new Date());

  return (
    <div className="bg-background/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-lg">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">WEARABLE WEEK {currentWeek.substring(1)} UPDATES</h2>
          <p className="text-sm text-muted-foreground">AI-generated insights and summaries</p>
        </div>
      </div>

      {/* Grid Layout: 2/3 left + 1/3 right stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content - 2/3 width */}
        <div className="lg:col-span-2 bg-background/40 border border-border/40 rounded-xl p-6 min-h-[300px]">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-3">
                  <div className="h-6 bg-muted/20 rounded w-1/4 animate-pulse" />
                  <div className="h-4 bg-muted/20 rounded w-full animate-pulse" />
                  <div className="h-4 bg-muted/20 rounded w-5/6 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Devices Section */}
              <div>
                <div className="flex items-baseline gap-2 mb-3">
                  <Smartphone className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-bold uppercase">DEVICES</h3>
                  <a 
                    href="#detailed-updates-devices" 
                    className="text-xs text-blue-500 hover:text-blue-600 hover:underline font-medium transition-colors"
                    onClick={() => {
                      // Scroll to detailed updates after hash change
                      setTimeout(() => {
                        document.getElementById('detailed-updates')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                  >
                    Details
                  </a>
                </div>
                {devicesSourceMeta?.sourceFileName && (
                  <div className="ml-7 mb-2 -mt-1">
                    <span className="text-xs text-muted-foreground">Source: </span>
                    {devicesSourceMeta.sourceFileUrl ? (
                      <a href={devicesSourceMeta.sourceFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{devicesSourceMeta.sourceFileName}</a>
                    ) : (
                      <span className="text-xs text-muted-foreground">{devicesSourceMeta.sourceFileName}</span>
                    )}
                  </div>
                )}
                <div className="space-y-3 ml-7">
                  {/* Highlights */}
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Highlights</h4>
                    <ul className="space-y-1 list-disc list-inside">
                      {summaries?.devices?.highlights?.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2" style={{ paddingLeft: `${(typeof item === 'object' ? item.indentLevel : 0) * 1.5}rem` }}>
                          <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-muted-foreground/30" />
                          <div className="text-sm leading-relaxed text-foreground/90">
                            <MarkdownText content={typeof item === 'object' ? item.content : item} />
                          </div>
                        </div>
                      )) || <div className="text-sm text-muted-foreground italic">No highlights available</div>}
                    </ul>
                  </div>
                  {/* Risks/Opens */}
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Risks / Opens</h4>
                    <ul className="space-y-1 list-disc list-inside">
                      {summaries?.devices?.risks?.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2" style={{ paddingLeft: `${(typeof item === 'object' ? item.indentLevel : 0) * 1.5}rem` }}>
                          <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-muted-foreground/30" />
                          <div className="text-sm leading-relaxed text-foreground/90">
                            <MarkdownText content={typeof item === 'object' ? item.content : item} />
                          </div>
                        </div>
                      )) || <div className="text-sm text-muted-foreground italic">No risks available</div>}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Software Section */}
              <SoftwareWearablesSection />

              {/* Systems Section */}
              <div>
                <div className="flex items-baseline gap-2 mb-3">
                  <Cpu className="w-5 h-5 text-orange-500" />
                  <h3 className="text-lg font-bold uppercase">SYSTEMS</h3>
                  <a 
                    href="#detailed-updates-systems" 
                    className="text-xs text-blue-500 hover:text-blue-600 hover:underline font-medium transition-colors"
                    onClick={() => {
                      // Scroll to detailed updates after hash change
                      setTimeout(() => {
                        document.getElementById('detailed-updates')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                  >
                    Details
                  </a>
                </div>
                {systemsSourceMeta?.sourceFileName && (
                  <div className="ml-7 mb-2 -mt-1">
                    <span className="text-xs text-muted-foreground">Source: </span>
                    {systemsSourceMeta.sourceFileUrl ? (
                      <a href={systemsSourceMeta.sourceFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">{systemsSourceMeta.sourceFileName}</a>
                    ) : (
                      <span className="text-xs text-muted-foreground">{systemsSourceMeta.sourceFileName}</span>
                    )}
                  </div>
                )}
                <div className="space-y-3 ml-7">
                  {/* Highlights */}
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Highlights</h4>
                    <ul className="space-y-1 list-disc list-inside">
                      {summaries?.systems?.highlights?.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-muted-foreground/30" />
                          <div className="text-sm leading-relaxed text-foreground/90">
                            <MarkdownText content={item} />
                          </div>
                        </div>
                      )) || <div className="text-sm text-muted-foreground italic">No highlights available</div>}
                    </ul>
                  </div>
                  {/* Risks/Opens */}
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Risks / Opens</h4>
                    <ul className="space-y-1 list-disc list-inside">
                      {summaries?.systems?.risks?.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-muted-foreground/30" />
                          <div className="text-sm leading-relaxed text-foreground/90">
                            <MarkdownText content={item} />
                          </div>
                        </div>
                      )) || <div className="text-sm text-muted-foreground italic">No risks available</div>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Stacked sections */}
        <div className="space-y-4">
          {/* Combined Upcoming Section */}
          <div className="bg-background/40 border border-border/40 rounded-xl p-4 min-h-[140px]">
            {/* Upcoming PDP Milestones Subsection */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">Upcoming PDP Milestones</h3>
                </div>
                <a 
                  href="#pdp-gates" 
                  className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('pdp-gates')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Details
                </a>
              </div>
              {pdpMilestones && pdpMilestones.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {pdpMilestones.map((milestone, idx) => {
                    const weekNum = getWeekNumber(new Date(milestone.milestoneDate));
                    return (
                      <li key={idx} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0 bg-blue-500" />
                        <div className="leading-relaxed">
                          <span className="font-semibold">{weekNum}</span> - {milestone.product} {milestone.milestoneName}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">No PDP milestones this/next week</p>
              )}
            </div>

            {/* Visual Separator */}
            <div className="border-t border-border/30 my-4"></div>

            {/* Upcoming Decisions Subsection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">Upcoming Decisions</h3>
                </div>
                <a 
                  href="#upcoming-decisions" 
                  className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('upcoming-decisions')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Details
                </a>
              </div>
              {upcomingDecisions && upcomingDecisions.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {upcomingDecisions.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0 bg-blue-500" />
                      <div className="leading-relaxed">
                        <span>
                          <span className="font-semibold">{item.week}</span> - {item.reviewType}: {item.topic}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">Upcoming decisions will appear here</p>
              )}
            </div>
          </div>

          {/* Decisions Made Section - Bottom Right */}
          <div className="bg-background/40 border border-border/40 rounded-xl p-4 min-h-[140px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Decisions Made</h3>
              </div>
              <a 
                href="#decisions-made-section" 
                className="text-xs text-blue-500 hover:text-blue-600 hover:underline font-medium"
              >
                Details
              </a>
            </div>
            {recentDecisions && recentDecisions.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {recentDecisions.filter((item: any) => {
                  // Hide entries where the outcome body is empty after stripping the bold forum prefix
                  const body = (item.outcome || '').replace(/^\*\*[^*]+\*\*\s*:?\s*/, '').trim();
                  return body.length >= 10;
                }).map((item: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0 bg-orange-500" />
                    <div className="leading-relaxed">
                      <MarkdownText content={item.outcome} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">Recent decisions will appear here</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
