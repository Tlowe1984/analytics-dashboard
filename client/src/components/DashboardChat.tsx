import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DashboardChat() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const askQuestion = trpc.dashboard.askQuestion.useMutation({
    onSuccess: (data) => {
      const answerText = typeof data.answer === 'string' ? data.answer : '';
      setAnswer(answerText);
      setIsExpanded(true);
    },
    onError: (error) => {
      toast.error("Failed to get answer: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    askQuestion.mutate({ question: question.trim() });
  };

  return (
    <div className="w-full">
      <div className="glass-card rounded-2xl p-4 max-w-[2000px] mx-auto">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-semibold text-sm hidden sm:inline">Ask AI</span>
          </div>
          
          <Input
            type="text"
            placeholder="Ask any question about the dashboard data..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 glass-card border-border/50"
            disabled={askQuestion.isPending}
          />
          
          <Button
            type="submit"
            size="sm"
            disabled={askQuestion.isPending || !question.trim()}
            className="flex-shrink-0"
          >
            {askQuestion.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>

        {/* Answer Display */}
        {isExpanded && answer && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">Answer:</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{answer}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsExpanded(false);
                  setAnswer("");
                  setQuestion("");
                }}
                className="flex-shrink-0"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
