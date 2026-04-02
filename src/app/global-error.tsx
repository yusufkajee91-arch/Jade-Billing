'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GLOBAL ERROR]', error.message)
    console.error('[GLOBAL ERROR] Digest:', error.digest)
    console.error('[GLOBAL ERROR] Stack:', error.stack)
  }, [error])

  return (
    <html>
      <body
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          background: '#F1EDEA',
          margin: 0,
          padding: 32,
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e74c3c',
            borderRadius: 16,
            padding: 32,
            maxWidth: 500,
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: 20, color: '#c0392b', margin: '0 0 12px' }}>
            Application Error
          </h2>
          <p style={{ fontSize: 14, color: '#666', margin: '0 0 16px' }}>
            A critical error occurred. Check the browser console and server logs for details.
          </p>
          <pre
            style={{
              textAlign: 'left',
              padding: 12,
              background: '#1a1a1a',
              color: '#f1f1f1',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: 200,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: 16,
            }}
          >
            {error.message}
            {error.digest ? `\nDigest: ${error.digest}` : ''}
          </pre>
          <button
            onClick={reset}
            style={{
              fontSize: 12,
              padding: '10px 24px',
              borderRadius: 40,
              border: 'none',
              background: '#B08B82',
              color: '#fff',
              cursor: 'pointer',
              marginRight: 8,
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            style={{
              fontSize: 12,
              padding: '10px 24px',
              borderRadius: 40,
              border: '1px solid #ccc',
              background: '#fff',
              color: '#666',
              cursor: 'pointer',
            }}
          >
            Go Home
          </button>
        </div>
      </body>
    </html>
  )
}
