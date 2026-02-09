/**
 * Panel Error Boundary Component
 *
 * Catches React render errors in panel components and displays a compact fallback UI.
 * Designed for use within panel layouts (not full-screen).
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  /** Child components to render */
  children: ReactNode;
  /** Name of the panel for contextual error messages */
  panelName: string;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Custom fallback UI */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for panel-level errors with compact fallback UI
 */
export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`PanelErrorBoundary (${this.props.panelName}) caught an error:`, error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-full flex-col items-center justify-center bg-neutral-800 p-4">
          <div className="max-w-sm rounded-lg border border-red-500/30 bg-neutral-900 p-4 text-center">
            <div className="mb-3 flex justify-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="mb-2 text-sm font-semibold text-white">
              {this.props.panelName} Error
            </h2>
            <p className="mb-3 text-xs text-neutral-400">
              An error occurred in this panel.
            </p>
            {this.state.error && (
              <details className="mb-3 text-left">
                <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">
                  Details
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-neutral-800 p-2 text-xs text-red-400 max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="rounded bg-neutral-700 px-3 py-1 text-xs text-white transition-colors hover:bg-neutral-600"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PanelErrorBoundary;
