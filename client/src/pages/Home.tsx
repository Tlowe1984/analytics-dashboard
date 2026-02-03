import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import ToplineView from "@/components/ToplineView";
import PlaceholderSections from "@/components/PlaceholderSections";
import DashboardChat from "@/components/DashboardChat";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { BarChart3, RefreshCw } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const seedData = trpc.dashboard.seedSampleData.useMutation({
    onSuccess: () => {
      toast.success("Sample data loaded successfully!");
      utils.dashboard.getAll.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to load sample data: " + error.message);
    },
  });

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Gradient background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950" />
      
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-400/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Executive Analytics Dashboard</h1>
                <p className="text-xs text-muted-foreground">Real-time program insights</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => seedData.mutate()}
                    disabled={seedData.isPending}
                    className="glass-card border-border/50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${seedData.isPending ? "animate-spin" : ""}`} />
                    Load Sample Data
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{user?.name}</span>
                    <Button variant="outline" size="sm" onClick={() => logout()} className="glass-card border-border/50">
                      Logout
                    </Button>
                  </div>
                </>
              ) : (
                <Button asChild size="sm" className="glass-card">
                  <a href={getLoginUrl()}>Sign In</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-12">
        {/* AI Chat Interface */}
        <div className="px-4 sm:px-6 lg:px-8 max-w-[2000px] mx-auto pt-6 pb-4">
          <DashboardChat />
        </div>

        {/* Dashboard Content */}
        <div className="px-4 sm:px-6 lg:px-8 max-w-[2000px] mx-auto">
          <ToplineView />
        </div>
        <PlaceholderSections />
      </main>

      {/* Footer */}
      <footer className="glass-card border-t mt-12">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>Executive Analytics Dashboard • Built with glassmorphism design</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
