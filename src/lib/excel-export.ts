import * as XLSX from 'xlsx'

export interface ExcelSheet {
  name: string
  rows: Record<string, unknown>[]
}

export function exportToExcel(sheets: ExcelSheet[], filename: string): void {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
