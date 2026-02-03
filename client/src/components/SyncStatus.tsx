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
      
      const allSuccess = result.devices.success && result.software.success && result.systems.success && result.decisions.success;
      const totalItems = (result.devices.itemsUpdated || 0) + (result.software.itemsUpdated || 0) + (result.systems.itemsUpdated || 0) + (result.decisions.itemsUpdated || 0);
      
      if (allSuccess) {
        toast.success("Data synced successfully", {
          description: `Updated ${totalItems} items across all dashboards`,
        });
      } else {
        const errors = [];
        if (!result.devices.success) errors.push(`Devices: ${result.devices.error || result.devices.message}`);
        if (!result.software.success) errors.push(`Software: ${result.software.error || result.software.message}`);
        if (!result.systems.success) errors.push(`Systems: ${result.systems.error || result.systems.message}`);
        if (!result.decisions.success) errors.push(`Decisions: ${result.decisions.error || result.decisions.message}`);
        
        toast.error("Sync completed with errors", {
          description: errors.join("; "),
        });
      }
      
      // Invalidate all data queries to refresh UI
      utils.dashboard.getAll.invalidate();
      utils.software.getAll.invalidate();
      utils.systems.getAll.invalidate();
      utils.decisions.getAll.invalidate();
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
