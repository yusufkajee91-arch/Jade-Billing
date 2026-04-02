'use client'

import { useEffect } from 'react'
import { componentLogger } from '@/lib/debug'

const log = componentLogger('AppErrorPage')

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    log.error('Unhandled page error:', error.message)
    log.error('Error digest:', error.digest)
    log.error('Full stack:', error.stack)
  }, [error])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: '#fdf2f2',
          border: '1px solid #e74c3c',
          borderRadius: 16,
          padding: 32,
          maxWidth: 500,
          width: '100%',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif, serif)',
            fontSize: 22,
            fontWeight: 400,
            color: '#c0392b',
            margin: '0 0 12px',
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-noto-sans, sans-serif)',
            fontSize: 14,
            color: '#666',
            margin: '0 0 16px',
          }}
        >
          An error occurred while loading this page. Check the browser console for details.
        </p>

        {process.env.NODE_ENV !== 'production' && (
          <details style={{ marginBottom: 16, textAlign: 'left' }}>
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
                maxHeight: 250,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ''}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              fontFamily: 'var(--font-noto-sans, sans-serif)',
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '10px 24px',
              borderRadius: 40,
              border: 'none',
              background: '#B08B82',
              color: '#fff',
              cursor: 'pointer',
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
              padding: '10px 24px',
              borderRadius: 40,
              border: '1px solid #ccc',
              background: '#fff',
              color: '#666',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  )
}
