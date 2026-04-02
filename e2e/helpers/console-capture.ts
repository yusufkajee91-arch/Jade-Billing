import { test as base, expect } from '@playwright/test'

type ConsoleEntry = {
  type: string
  text: string
  location?: string
}

const IGNORED_ERROR_PATTERNS = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of 4\d\d/i,
]

function shouldIgnore(text: string) {
  return IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(text))
}

export const test = base.extend<{
  browserConsoleCapture: void
}>({
  browserConsoleCapture: [async ({ page }, use, testInfo) => {
    const consoleErrors: ConsoleEntry[] = []
    const pageErrors: string[] = []

    page.on('console', (message) => {
      if (message.type() !== 'error') return

      const text = message.text()
      if (shouldIgnore(text)) return

      const location = message.location()
      const formattedLocation =
        location.url && location.lineNumber !== undefined
          ? `${location.url}:${location.lineNumber + 1}`
          : location.url || undefined

      consoleErrors.push({
        type: message.type(),
        text,
        location: formattedLocation,
      })
    })

    page.on('pageerror', (error) => {
      const text = error.stack || error.message
      if (shouldIgnore(text)) return
      pageErrors.push(text)
    })

    await use()

    if (consoleErrors.length === 0 && pageErrors.length === 0) {
      return
    }

    const reportLines = [
      ...consoleErrors.map((entry, index) =>
        `${index + 1}. [console.${entry.type}] ${entry.text}${entry.location ? ` (${entry.location})` : ''}`),
      ...pageErrors.map((entry, index) =>
        `${consoleErrors.length + index + 1}. [pageerror] ${entry}`),
    ]

    await testInfo.attach('browser-console-errors', {
      body: reportLines.join('\n\n'),
      contentType: 'text/plain',
    })

    throw new Error(
      `Unexpected browser console errors detected:\n${reportLines.join('\n\n')}`,
    )
  }, { auto: true }],
})

export { expect }
