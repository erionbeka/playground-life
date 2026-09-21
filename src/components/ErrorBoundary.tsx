import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Playground Life encountered an error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card/90 p-8 text-center shadow-xl backdrop-blur-md">
            <p aria-hidden="true" className="mb-3 text-5xl">🛠️</p>
            <h1 className="mb-2 font-display text-2xl font-extrabold text-foreground">Something took a tumble</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              We hit an unexpected snag. Nothing was broken — a fresh start usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="touch-target w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-lg transition hover:brightness-105"
            >
              Start fresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
