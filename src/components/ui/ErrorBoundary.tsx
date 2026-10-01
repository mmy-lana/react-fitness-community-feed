import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertIcon } from '../icons/ActionIcons';
import { RotateCcwIcon } from '../icons/ActionIcons';
import { Button } from './Button';
import { resetDemoData } from '../../services/storageStore';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called after the boundary clears itself, e.g. to reset app state. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Last line of defence around the whole app.
 *
 * Without this, any render-time throw unmounts the tree and leaves a blank
 * page with no way back. Here the failure is reported in plain language, the
 * stack is kept for diagnosis, and the athlete can retry or wipe the local
 * dataset that most often causes the failure.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null, componentStack: null });
    this.props.onReset?.();
  };

  private handleResetData = (): void => {
    try {
      resetDemoData();
    } catch (error) {
      console.error('Reset failed while recovering from a render error:', error);
    }
    this.handleRetry();
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <main
        role="alert"
        aria-labelledby="error-boundary-title"
        data-testid="error-boundary"
        className="flex min-h-dvh items-center justify-center bg-surface-900 px-4 py-10 text-ink-primary"
      >
        <div className="w-full max-w-lg rounded-xl border border-sport-run/40 bg-surface-800 p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sport-run/15 text-sport-run">
            <AlertIcon className="h-6 w-6" />
          </span>

          <h1 id="error-boundary-title" className="mt-4 text-lg font-bold">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            The feed stopped rendering. Your activities are still stored on this device — retrying is
            safe, and resetting the demo data starts from the sample feed if the problem persists.
          </p>

          <p className="mt-4 rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 font-mono text-xs break-words text-sport-run">
            {error.message || 'Unknown error'}
          </p>

          {componentStack ? (
            <details className="mt-3 text-xs text-ink-tertiary">
              <summary className="cursor-pointer font-semibold text-ink-secondary">Technical details</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px]">
                {componentStack}
              </pre>
            </details>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={this.handleRetry} iconLeft={<RotateCcwIcon className="h-4 w-4" />}>
              Try again
            </Button>
            <Button variant="danger" onClick={this.handleResetData}>
              Reset demo data
            </Button>
          </div>
        </div>
      </main>
    );
  }
}
