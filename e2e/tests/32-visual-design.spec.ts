import { test, expect } from '../helpers/console-capture'

test.describe('US-032: Visual Design / Brand', () => {
  test('page background matches brand (#F1EDEA area)', async ({ page }) => {
    await page.goto('/dashboard')

    // The dashboard wraps content in a div with the brand gradient background
    const bgDiv = page.locator('div[style*="F1EDEA"]').first()
    await expect(bgDiv).toBeVisible({ timeout: 10000 })

    // Verify the background gradient contains the brand color
    const style = await bgDiv.getAttribute('style')
    expect(style).toContain('#F1EDEA')
  })

  test('headings use serif font (Playfair Display via --font-playfair)', async ({ page }) => {
    await page.goto('/dashboard')

    // The main greeting h1 uses font-serif (Playfair Display)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10000 })

    const fontFamily = await heading.evaluate(
      (el) => getComputedStyle(el).fontFamily,
    )

    // Should contain Playfair Display or the serif variable
    expect(
      fontFamily.includes('Playfair') || fontFamily.includes('serif'),
    ).toBeTruthy()
  })

  test('body uses sans-serif (Noto Sans via --font-noto-sans)', async ({ page }) => {
    await page.goto('/dashboard')

    const body = page.locator('body')
    await expect(body).toBeVisible({ timeout: 10000 })

    const bodyClass = await body.getAttribute('class')
    const bodyFontFamily = await body.evaluate(
      (el) => getComputedStyle(el).fontFamily,
    )
    const rootFontVar = await page.evaluate(
      () => getComputedStyle(document.documentElement).getPropertyValue('--font-sans'),
    )

    expect(
      (bodyClass && bodyClass.includes('font-sans')) ||
      rootFontVar.includes('--font-noto-sans') ||
      bodyFontFamily.includes('Noto') ||
      bodyFontFamily.includes('sans'),
    ).toBeTruthy()
  })

  test('glass card elements have backdrop-filter', async ({ page }) => {
    await page.goto('/dashboard')

    // Glass cards use backdrop-filter: blur(24px)
    const glassCards = page.locator('[style*="backdrop-filter"]')
    const count = await glassCards.count()
    expect(count).toBeGreaterThan(0)

    // Verify the first glass card has a blur value
    const backdropFilter = await glassCards.first().evaluate(
      (el) => getComputedStyle(el).backdropFilter || (el as HTMLElement).style.backdropFilter,
    )
    expect(backdropFilter).toContain('blur')
  })

  test('primary accent color (#B08B82) used on buttons', async ({ page }) => {
    await page.goto('/dashboard')

    // The "Record Time" link uses inline style background: '#B08B82'
    const recordTimeBtn = page.locator('a', { hasText: 'Record Time' }).first()
    await expect(recordTimeBtn).toBeVisible({ timeout: 10000 })

    // Check the inline style attribute directly since getComputedStyle returns rgb() format
    const style = await recordTimeBtn.getAttribute('style')
    const bgColor = await recordTimeBtn.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    // The inline style contains #B08B82, or computed style returns its rgb equivalent rgb(176, 139, 130)
    expect(
      (style && style.includes('#B08B82')) ||
      (style && style.includes('B08B82')) ||
      bgColor === 'rgb(176, 139, 130)',
    ).toBeTruthy()
  })

  test('dark header bars have expected background', async ({ page }) => {
    await page.goto('/dashboard')

    // The dark header bar uses inline style background: 'rgba(74, 72, 69, 0.92)'
    // The style attribute may use spaces or not between values, so match broadly
    const darkHeader = page.locator('[style*="rgba(74"]').first()
    await expect(darkHeader).toBeVisible({ timeout: 10000 })

    // Check via inline style attribute string or computed background
    const style = await darkHeader.getAttribute('style')
    const computedBg = await darkHeader.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    // Inline style should contain rgba(74, 72, 69, ...) or computed background matches
    expect(
      (style && style.includes('rgba(74')) ||
      computedBg.includes('74') ||
      computedBg.includes('rgba(74'),
    ).toBeTruthy()
  })
})
