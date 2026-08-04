import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

const RELOAD_FLAG = "app:chunk-reload";

function isChunkLoadError(error: Error) {
  const message = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    message.includes("dynamically imported module") ||
    message.includes("chunkloaderror") ||
    message.includes("failed to fetch dynamically") ||
    message.includes("importing a module script failed") ||
    message.includes("unexpected token '<'")
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error boundary caught:", error, info.componentStack);

    // A stale deploy leaves the browser asking for chunks that no longer exist.
    // Reload once to pick up the new build instead of showing a blank page.
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    }
  }

  private handleRetry = () => {
    sessionStorage.removeItem(RELOAD_FLAG);
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page failed to load. Try again, or reload the app to fetch the latest version.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
