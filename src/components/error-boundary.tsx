import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { ApiMessages } from "@/lib/api-messages";

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
};

type State = { hasError: boolean };

/**
 * Lightweight error boundary. Never renders error details — only a safe,
 * user-friendly message and a Retry button. Prevents blank white screens
 * when a route/page throws during render.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Log to console only (never surface to user)
    console.error("[ErrorBoundary]", error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border bg-card p-6 text-center shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold">
            {this.props.fallbackTitle ?? "Something went wrong."}
          </h2>
          <p className="text-sm text-muted-foreground">
            {this.props.fallbackMessage ?? ApiMessages.UNKNOWN}
          </p>
          <Button
            size="sm"
            onClick={() => {
              this.reset();
              try {
                window.location.reload();
              } catch {
                /* ignore */
              }
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }
}