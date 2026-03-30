import React from "react";

import { Button } from "@/components/ui/button";

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export default class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[RouteErrorBoundary] Route render failed.", error, errorInfo);
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="surface-panel mx-auto w-full max-w-5xl p-6 md:p-8">
          <p className="section-label">Route recovery</p>
          <h2 className="mt-2 font-heading text-4xl text-foreground">This view hit a render failure.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/78">
            PlacePrep kept the shell alive. Reload the view or switch pages while we recover.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" onClick={() => this.setState({ hasError: false })}>
              Retry view
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Reload app
            </Button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
