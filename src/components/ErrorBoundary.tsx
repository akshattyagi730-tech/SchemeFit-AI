import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a screen and shows a recoverable message
 * instead of letting the app unmount (which can look like a logout).
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Screen error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="state-block error" role="alert">
          <AlertTriangle size={26} />
          <b>This screen hit an unexpected error</b>
          <span>You are still signed in. Try again, or go back to the dashboard.</span>
          <small>{this.state.error.message}</small>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="button outline" onClick={this.reset}>
              Try again <RotateCcw size={15} />
            </button>
            <button
              className="button soft"
              onClick={() => {
                history.pushState({}, '', '/');
                this.reset();
              }}
            >
              Back to dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
