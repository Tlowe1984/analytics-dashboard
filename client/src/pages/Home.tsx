import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import ToplineView from "@/components/ToplineView";
import PlaceholderSections from "@/components/PlaceholderSections";
import DecisionsSection from "@/components/DecisionsSection";
import { UpcomingReviewsSection } from "@/components/UpcomingReviewsSection";
import DashboardChat from "@/components/DashboardChat";
import UpcomingDates from "@/components/UpcomingDates";
import SyncStatus from "@/components/SyncStatus";
import AIExecutiveUpdates from "@/components/AIExecutiveUpdates";
import { BarChart3 } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();


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
      <header className="glass-card border-b sticky top-0 z-50">
        <div className="px-3 sm:px-6 lg:px-8 max-w-[2000px] mx-auto py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold">Wearable Live Dashboard</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Real-time program insights • <span className="text-blue-600 dark:text-blue-400 font-medium">Blue text = New information</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {isAuthenticated ? (
                <>
                  <SyncStatus />
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline">{user?.name}</span>
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
      <main className="pb-8 sm:pb-12">
        {/* AI Chat Interface */}
        <div className="px-3 sm:px-6 lg:px-8 max-w-[2000px] mx-auto pt-4 sm:pt-6 pb-3 sm:pb-4">
          <DashboardChat />
        </div>

        {/* Dashboard Content */}
        <div className="px-3 sm:px-6 lg:px-8 max-w-[2000px] mx-auto space-y-4 sm:space-y-8">
          <AIExecutiveUpdates />
          <ToplineView />
          <UpcomingDates />
        </div>
        <div className="px-3 sm:px-6 lg:px-8 max-w-[2000px] mx-auto space-y-4 sm:space-y-8">
          <DecisionsSection />
          <UpcomingReviewsSection />
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
