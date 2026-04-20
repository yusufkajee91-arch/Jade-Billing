import pg from 'pg'
import 'dotenv/config'
const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

// Relink invoice_line_items.fee_entry_id to matching new fee_entries
// Match on: invoice.matter_id + entry_date + amount_cents + description (narration)
console.log('Relinking invoice_line_items → fee_entries…')
const updated = await q(`
  UPDATE invoice_line_items ili
  SET fee_entry_id = fe.id
  FROM invoices inv, fee_entries fe
  WHERE ili.invoice_id = inv.id
    AND fe.matter_id = inv.matter_id
    AND fe.entry_date = ili.entry_date
    AND fe.total_cents = ili.total_cents
    AND fe.narration = ili.description
    AND ili.fee_entry_id IS NULL
  RETURNING ili.id
`)
console.log(`  relinked ${updated.length} line items`)

const stats = await q(`
  SELECT 'total line items' k, COUNT(*)::int n FROM invoice_line_items
  UNION ALL SELECT 'with fee_entry link', COUNT(*) FROM invoice_line_items WHERE fee_entry_id IS NOT NULL
  UNION ALL SELECT 'orphaned', COUNT(*) FROM invoice_line_items WHERE fee_entry_id IS NULL
`)
for (const r of stats) console.log(`  ${r.k.padEnd(22)} ${r.n}`)

await client.end()
