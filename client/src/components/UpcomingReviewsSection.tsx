import { Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function UpcomingReviewsSection() {
  const { data: reviews, isLoading } = trpc.upcomingReviews.getAll.useQuery();

  if (isLoading) {
    return (
      <div className="bg-background/40 border border-border/50 rounded-xl p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div className="h-7 bg-muted/20 rounded w-48" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/20 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="bg-background/40 border border-border/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold">Upcoming Decisions</h2>
        </div>
        <p className="text-muted-foreground text-sm">No upcoming reviews in the next 14 days</p>
      </div>
    );
  }

  return (
    <div className="bg-background/40 border border-border/50 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Calendar className="w-5 h-5 text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold">Upcoming Decisions</h2>
        <span className="ml-auto text-sm text-muted-foreground">Next 14 days</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Review Type</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Week</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Topic</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Description</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Owner</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review, index) => (
              <tr key={review.id} className={index !== reviews.length - 1 ? "border-b border-border/30" : ""}>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    review.reviewType === "Wearables Review" ? "bg-purple-500/10 text-purple-500" :
                    review.reviewType === "Product Review" ? "bg-blue-500/10 text-blue-500" :
                    "bg-green-500/10 text-green-500"
                  }`}>
                    {review.reviewType}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm">{review.week}</td>
                <td className="py-3 px-4 text-sm font-medium">{review.topic}</td>
                <td className="py-3 px-4 text-sm text-muted-foreground">{review.description || "—"}</td>
                <td className="py-3 px-4 text-sm">{review.owner || "TBD"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
