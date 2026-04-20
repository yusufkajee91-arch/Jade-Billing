import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const dir = '/Users/yusufkajee/Desktop/App Development/Development/dcco-billing/Documentation/Recon'
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx')).sort()

for (const file of files) {
  const full = path.join(dir, file)
  try {
    const wb = XLSX.readFile(full, { cellDates: true })
    const out = { file, sheets: [] }
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false })
      const rowCount = rows.length
      const firstFew = rows.slice(0, 3)
      out.sheets.push({ sheetName, rowCount, firstFew })
    }
    console.log('='.repeat(80))
    console.log('FILE:', file)
    for (const s of out.sheets) {
      console.log(`  Sheet: "${s.sheetName}" (${s.rowCount} rows)`)
      s.firstFew.forEach((r, i) => console.log(`    [${i}]`, JSON.stringify(r).slice(0, 500)))
    }
  } catch (e) {
    console.log('ERR', file, e.message)
  }
}
