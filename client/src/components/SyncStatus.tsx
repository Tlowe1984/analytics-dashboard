import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

export default function SyncStatus() {
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const utils = trpc.useUtils();
  
  const syncAll = trpc.sync.syncAll.useMutation({
    onSuccess: (result: any) => {
      setLastSyncTime(new Date());
      
      const allSuccess = result.devices.success && result.software.success && result.systems.success && result.hearing?.success && result.decisions.success && result.milestones?.success && result.upcomingReviews?.success;
      const totalItems = (result.devices.itemsUpdated || 0) + (result.software.itemsUpdated || 0) + (result.systems.itemsUpdated || 0) + (result.hearing?.itemsUpdated || 0) + (result.decisions.itemsUpdated || 0) + (result.milestones?.itemsUpdated || 0) + (result.upcomingReviews?.itemsUpdated || 0);
      
      if (allSuccess) {
        toast.success("Data synced successfully", {
          description: `Updated ${totalItems} items across all dashboards`,
        });
      } else {
        const errors = [];
        if (!result.devices.success) errors.push(`Devices: ${(result.devices as any).error || result.devices.message}`);
        if (!result.software.success) errors.push(`Software: ${(result.software as any).error || result.software.message}`);
        if (!result.systems.success) errors.push(`Systems: ${(result.systems as any).error || result.systems.message}`);
        if (result.hearing && !result.hearing.success) errors.push(`Hearing: ${(result.hearing as any).error || result.hearing.message}`);
        if (!result.decisions.success) errors.push(`Decisions: ${(result.decisions as any).error || result.decisions.message}`);
        if (result.milestones && !result.milestones.success) errors.push(`Milestones: ${(result.milestones as any).error || result.milestones.message}`);
        if (result.upcomingReviews && !result.upcomingReviews.success) errors.push(`Upcoming Reviews: ${(result.upcomingReviews as any).error || result.upcomingReviews.message}`);
        
        toast.error("Sync completed with errors", {
          description: errors.join("; "),
        });
      }
      
      // Invalidate ALL data queries to refresh UI (including top tiles)
      utils.dashboard.getAll.invalidate();
      utils.dashboard.generateExecutiveSummaries.invalidate();
      utils.dashboard.getUpcomingItems.invalidate();
      utils.dashboard.getPDPMilestonesThisAndNextWeek.invalidate();
      utils.dashboard.getRecentDecisions.invalidate();
      utils.dashboard.getLastUpdated.invalidate();
      utils.dashboard.getDevicesLastUpdated.invalidate();
      utils.dashboard.getSoftwareLastUpdated.invalidate();
      utils.dashboard.getSystemsLastUpdated.invalidate();
      utils.dashboard.getSourceDocumentUrl.invalidate();
      utils.software.getAll.invalidate();
      utils.systems.getAll.invalidate();
      utils.decisions.getAll.invalidate();
      utils.milestones.getUpcoming.invalidate();
      utils.milestones.getReleaseDates.invalidate();
      utils.milestones.getGTMMilestones.invalidate();
      utils.upcomingReviews.getAll.invalidate();
      utils.hearing.getAll.invalidate();
      utils.ai.getAll.invalidate();
    },
    onError: (error) => {
      toast.error("Sync failed", {
        description: error.message,
      });
    },
  });

  // No auto-sync - manual refresh only for daily updates

  const handleManualSync = () => {
    syncAll.mutate({ forceRefresh: true });
  };

  return (
    <div className="flex items-center gap-3">
      {/* Last Sync Time */}
      {lastSyncTime && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>
            Last synced {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
          </span>
        </div>
      )}
      
      {/* Manual Sync Button - Admin Only */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleManualSync}
        disabled={syncAll.isPending}
        className="gap-1.5 text-xs px-2 py-1 h-7"
      >
        <RefreshCw className={`w-3 h-3 ${syncAll.isPending ? "animate-spin" : ""}`} />
        {syncAll.isPending ? "Syncing..." : "Admin Only Refresh"}
      </Button>
    </div>
  );
}
