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
    onSuccess: (result) => {
      setLastSyncTime(new Date());
      
      if (result.execSummary.success && result.milestones.success) {
        toast.success("Data synced successfully", {
          description: `Updated ${result.milestones.itemsUpdated || 0} milestones`,
        });
      } else {
        const errors = [];
        if (!result.execSummary.success) errors.push(`Exec Summary: ${result.execSummary.message}`);
        if (!result.milestones.success) errors.push(`Milestones: ${result.milestones.message}`);
        
        toast.error("Sync completed with errors", {
          description: errors.join("; "),
        });
      }
      
      // Invalidate queries to refresh UI
      utils.dashboard.getAll.invalidate();
      utils.milestones.getUpcoming.invalidate();
    },
    onError: (error) => {
      toast.error("Sync failed", {
        description: error.message,
      });
    },
  });

  // No auto-sync - manual refresh only for daily updates

  const handleManualSync = () => {
    syncAll.mutate();
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
      
      {/* Manual Sync Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleManualSync}
        disabled={syncAll.isPending}
        className="gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${syncAll.isPending ? "animate-spin" : ""}`} />
        {syncAll.isPending ? "Syncing..." : "Refresh Data"}
      </Button>
      

    </div>
  );
}
