'use client'

import { Component, type ReactNode } from 'react'
import { componentLogger } from '@/lib/debug'

interface Props {
  children: ReactNode
  /** Name used in logs and the fallback UI */
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

const log = componentLogger('ErrorBoundary')

/**
 * Catches render errors in any descendant component tree.
 * Displays a recoverable error panel with debug info in dev mode.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const name = this.props.name ?? 'Unknown'
    log.error(`[${name}] Caught render error:`, error.message)
    log.error(`[${name}] Component stack:`, info.componentStack)
    log.error(`[${name}] Full error:`, error)
  }

  render() {
    if (this.state.hasError) {
      const name = this.props.name ?? 'this section'
      const isDev = process.env.NODE_ENV !== 'production'
      return (
        <div
          style={{
            margin: 16,
            padding: 24,
            borderRadius: 12,
            border: '1px solid #e74c3c',
            background: '#fdf2f2',
          }}
        >
          <h3
            style={{
              margin: '0 0 8px',
              fontFamily: 'var(--font-noto-sans, sans-serif)',
              fontSize: 16,
              color: '#c0392b',
            }}
          >
            Something went wrong in {name}
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-noto-sans, sans-serif)',
              fontSize: 13,
              color: '#666',
              margin: '0 0 16px',
            }}
          >
            An error occurred while rendering this section. You can try reloading or
            navigating away and back.
          </p>
          {isDev && this.state.error && (
            <details style={{ marginBottom: 16 }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontFamily: 'var(--font-noto-sans, sans-serif)',
                  fontSize: 12,
                  color: '#888',
                }}
              >
                Error details (dev only)
              </summary>
              <pre
                style={{
                  marginTop: 8,
                  padding: 12,
                  background: '#1a1a1a',
                  color: '#f1f1f1',
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: 300,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              fontFamily: 'var(--font-noto-sans, sans-serif)',
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid #c0392b',
              background: '#fff',
              color: '#c0392b',
              cursor: 'pointer',
              marginRight: 8,
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              fontFamily: 'var(--font-noto-sans, sans-serif)',
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid #888',
              background: '#fff',
              color: '#666',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
