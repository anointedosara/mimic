"use client";

import React from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  /** When this value changes, a caught error is cleared and children re-render. */
  resetKey?: unknown;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors in a subtree so one throwing phase never blanks the
 * whole screen. Auto-recovers when `resetKey` changes (e.g. a new snapshot
 * arrives), so the UI heals itself without a manual page refresh.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary] recovered from render error:", error);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="glass grid min-h-[40vh] place-items-center rounded-3xl p-8 text-center">
            <div>
              <p className="font-display text-lg font-bold">This view hiccupped</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                Your game is safe on the server. Reloading the latest state…
              </p>
              <Button
                variant="gradient"
                className="mt-4"
                onClick={() => this.setState({ hasError: false })}
              >
                <RotateCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
