import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  tabName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class TabErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[TabErrorBoundary] Error in tab "${this.props.tabName}":`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="glass-panel"
          style={{
            padding: '24px',
            margin: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle color="#ef4444" size={24} />
            <h3 style={{ margin: 0, color: '#ef4444', fontSize: '16px', fontWeight: '800' }}>
              Unable to load {this.props.tabName}
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering this tab.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            <RefreshCw size={14} /> Retry Loading Tab
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
