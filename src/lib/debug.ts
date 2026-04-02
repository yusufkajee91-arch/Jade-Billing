/**
 * Comprehensive debugging utility for DCCO Billing.
 *
 * Server-side: logs are written to the terminal (stdout) running `npm run dev`.
 * Client-side: logs are written to the browser console.
 *
 * Every log line is prefixed with a namespace so you can quickly filter:
 *   [API:fee-entries] POST …
 *   [PAGE:dashboard] render …
 *   [COMPONENT:fee-entry-form] mount …
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',  // gray
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
}
const RESET = '\x1b[0m'

function timestamp(): string {
  return new Date().toISOString()
}

function isServer(): boolean {
  return typeof window === 'undefined'
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack}`
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.stringify(a, null, 2)
        } catch {
          return String(a)
        }
      }
      return String(a)
    })
    .join(' ')
}

function _log(level: LogLevel, namespace: string, ...args: unknown[]) {
  const ts = timestamp()
  const msg = formatArgs(args)

  if (isServer()) {
    const color = COLORS[level]
    const levelLabel = level.toUpperCase().padEnd(5)
    console[level === 'debug' ? 'log' : level](
      `${color}${ts} [${levelLabel}] [${namespace}]${RESET} ${msg}`,
    )
  } else {
    const style =
      level === 'error'
        ? 'color: #e74c3c; font-weight: bold'
        : level === 'warn'
        ? 'color: #f39c12; font-weight: bold'
        : level === 'info'
        ? 'color: #3498db'
        : 'color: #95a5a6'
    console[level === 'debug' ? 'log' : level](
      `%c[${namespace}]`,
      style,
      ...args,
    )
  }
}

/** Create a scoped logger for a specific namespace */
export function createLogger(namespace: string) {
  return {
    debug: (...args: unknown[]) => _log('debug', namespace, ...args),
    info: (...args: unknown[]) => _log('info', namespace, ...args),
    warn: (...args: unknown[]) => _log('warn', namespace, ...args),
    error: (...args: unknown[]) => _log('error', namespace, ...args),
  }
}

// ─── Pre-built loggers for common namespaces ──────────────────────────────────

/** Logger for API route handlers */
export function apiLogger(routeName: string) {
  return createLogger(`API:${routeName}`)
}

/** Logger for server page components */
export function pageLogger(pageName: string) {
  return createLogger(`PAGE:${pageName}`)
}

/** Logger for client components */
export function componentLogger(componentName: string) {
  return createLogger(`COMPONENT:${componentName}`)
}

/** Logger for lib utilities */
export function libLogger(libName: string) {
  return createLogger(`LIB:${libName}`)
}
