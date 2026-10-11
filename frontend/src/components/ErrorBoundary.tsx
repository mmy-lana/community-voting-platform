import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called when the user clicks Retry (e.g. query refetch). */
  onRetry?: () => void;
  title?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

/**
 * Local error boundary widget. Wrap any panel; on render errors it shows a
 * compact widget with a Retry button that invokes `onRetry` (typically a
 * TanStack Query refetch) and clears the error state.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo) {
    // Telemetry capture of render errors is handled globally in lib/telemetry.
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        data-testid="error-boundary"
        role="alert"
        className="rounded-[--radius-card] border border-border bg-surface p-6 text-center space-y-3"
      >
        <h3 className="text-title font-semibold text-ink">{this.props.title ?? 'Something went wrong'}</h3>
        {this.state.message ? (
          <p className="text-body text-slate-600">{this.state.message}</p>
        ) : null}
        <button
          type="button"
          data-testid="error-boundary-retry"
          onClick={this.handleRetry}
          className="inline-flex min-h-[44px] min-w-[44px] items-center rounded-[--radius-control] bg-accent px-4 text-body-lg font-medium text-white hover:bg-accent-strong"
        >
          Retry
        </button>
      </div>
    );
  }
}
