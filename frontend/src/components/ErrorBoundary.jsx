import React from 'react';
import { posthog } from '../analytics';

/**
 * Error Boundary component that catches JavaScript errors
 * anywhere in child component tree and reports them to PostHog
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Store error details in state
    this.setState({ error, errorInfo });

    // Report error to PostHog
    posthog.capture('js_error', {
      error: error?.message || 'Unknown error',
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });

    // Also log to console for development
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={styles.container}>
          <div style={styles.content}>
            <div style={styles.icon}>⚠️</div>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.message}>
              We're sorry, but something unexpected happened. Our team has been notified.
            </p>
            <button style={styles.button} onClick={this.handleReload}>
              Reload Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details</summary>
                <pre style={styles.pre}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '20px'
  },
  content: {
    textAlign: 'center',
    maxWidth: '500px'
  },
  icon: {
    fontSize: '64px',
    marginBottom: '20px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '12px'
  },
  message: {
    fontSize: '16px',
    color: '#64748b',
    marginBottom: '24px'
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '500',
    color: 'white',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  details: {
    marginTop: '24px',
    textAlign: 'left'
  },
  summary: {
    cursor: 'pointer',
    color: '#64748b',
    marginBottom: '8px'
  },
  pre: {
    background: '#1e293b',
    color: '#e2e8f0',
    padding: '16px',
    borderRadius: '8px',
    overflow: 'auto',
    fontSize: '12px',
    maxHeight: '300px'
  }
};

export default ErrorBoundary;
