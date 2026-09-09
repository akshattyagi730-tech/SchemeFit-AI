import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useLang } from '../i18n';

interface State {
  error: Error | null;
}

function Fallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t } = useLang();
  return (
    <div className="state-block error" role="alert">
      <AlertTriangle size={26} />
      <b>{t('state.screenError')}</b>
      <span>{t('state.stillSignedIn')}</span>
      <small>{error.message}</small>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="button outline" onClick={onReset}>
          {t('common.tryAgain')} <RotateCcw size={15} />
        </button>
        <button
          className="button soft"
          onClick={() => {
            history.pushState({}, '', '/');
            onReset();
          }}
        >
          {t('common.backToDashboard')}
        </button>
      </div>
    </div>
  );
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
    if (this.state.error) return <Fallback error={this.state.error} onReset={this.reset} />;
    return this.props.children;
  }
}
