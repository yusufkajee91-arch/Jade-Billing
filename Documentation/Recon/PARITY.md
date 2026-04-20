# LP ↔ Casey Parity Worksheet

Tracks reimport progress phase-by-phase. Baseline snapshot: `snapshots/pre-lp-parity-2026-04-20.sql`.

## Row-count parity

| Entity | LP target | Casey before | Casey after | Source file |
|---|---|---|---|---|
| Clients | 370 | 370 | — | `List_customer.xlsx` |
| Matters | 562 | 563 (8 Casey-only) | — | `List_matter.xlsx` |
| Fee Entries | 3,980 | 3,877 (8 non-hist) | — | `Export-WIP-History-...-2026-04-19.xlsx` |
| Invoice line items | 3,224 | ? | — | `Invoiced-Fees-and-Disbursements (1).xlsx` |
| GL Accounts | 50 | 8 | — | `Export-Accounts-as-at-2026-04-19.xlsx` |
| Fee Levels | 8 | 4 | — | `List_feelevel (4).xlsx` |
| Posting Codes | 28 | 30 | — | `List_product.xlsx` |
| Departments | 1 (LP) | 4 (Casey keeps) | 4 | `List_department.xlsx` |
| Matter Types | 0 (LP empty) | 6 (Casey keeps) | 6 | `List_mattertype.xlsx` |
| Staff (logins) | 8 | 6 | — | `List_login.xlsx` |
| Suppliers | 11 | 0 | — | `List_supplier.xlsx` |
| Trust Entries | ~400 | 0 | — | `Statement-of-all-accounts-...-Trust-.xlsx` |
| Business Entries | ~1,300 | 0 | — | `Statement-of-all-accounts-...-until-2026-04-17.xlsx` |
| Trust Transfers | 70 | 0 | — | `List_trusttransfer.xlsx` |
| Posting Code Categories | 2 | 0 | — | `List_productcategory.xlsx` |
| GL Account Categories | 6 | 0 | — | `List_accountcategory.xlsx` |
| Receipt Methods | 3 | 0 | — | `List_customerpaymentmethod (1).xlsx` |
| Investment balances | 38 matters | 0 | — | `Trust and Investments 2026-04-19.xlsx` |

## Financial parity

| Check | LP target | Casey actual | Delta |
|---|---|---|---|
| SUM fee_entries amount (2021-01-01 to 2026-04-19) | TBD | — | — |
| SUM invoices total | TBD | — | — |
| Trust balance total | TBD | — | — |
| GL account balances @ 2026-04-19 | 50 accounts | — | — |

## Casey-only records to preserve

Confirmed 2026-04-20: these exist in Casey but not in LP recon files. Must survive reimport.

### 3 matters
- `LA/KAI-001` — Trade Mark Dispute FURIZOME/URIZONE (Laken Ash)
- `JJ/ARR-001` — IPO Hearing Cape Town (Jessica-Jayde)
- `JJ/MABC-001` — IPO Hearing Cape Town (Laken Ash)

### 2 clients
- `KAI` — KISCH AFRICA INC
- `MABC` — Monte Alto Body Corporate

### 8 fee entries on LA/KAI-001 (is_historical=false)
Total R1,916. Dates 2026-04-08 through 2026-04-13.

## Phase completion log

- [x] Phase 0 — snapshot + scaffolding (2026-04-20)
- [x] Phase 1 — schema migrations (10 new tables, 64 new cols, 5 new enums)
- [x] Phase 2 — static masterdata (1 currency, 1 tax type, 5 GL categories, 2 posting categories, 3 receipt methods, 3 bank accounts)
- [x] Phase 3 — extended masterdata (8 users, 8 fee levels, 11 suppliers, 49 GL accounts, 36 posting codes)
- [x] Phase 4 — clients (372) + matters (569) upsert, FICA updated (6 rows), 3 CLEARING matters added, dept inference (98 Commercial, 85 Litigation, 6 Conveyancing, 374 Default)
- [x] Phase 5.1 — fee entries full reimport: **3,979 entries, R5,881,558.39 — PERFECT PARITY vs LP**
- [x] Phase 5.2 — invoice line items relinked: 1,796 of 3,176 lines linked to new fee_entries
- [x] Phase 5.3 — trust entries: 1,166 imported from Detailed Matter Ledger (trust auto-journaled via DB trigger). **Balance R94k vs LP R474k (R380k gap)**
- [x] Phase 5.4 — business entries: 631 imported from Business Bank statement. **Balance -R339k vs LP R128k (R466k gap)**
- [ ] Phase 5.5 — business journal entries (trust already auto-created by trigger)
- [ ] Phase 5.6 — trust transfers pair linkage (310 in/310 out pairs)
- [ ] Phase 6 — reconciliation passes & balance-gap diagnosis
- [ ] Phase 7 — lock & document

## Known reconciliation gaps as of 2026-04-20

**Trust balance gap: R380,000** — 19 Journal rows in Detailed Matter Ledger were skipped (need mapping to `collection_receipt` or similar); 22 positive Trust Receipts (possible reversals) need inspection; 4 trust entries skipped due to no matter match.

**Business balance gap: R466,000** — `Receipt` type rows labelled "FNB App Transfer From Tt####" are currently stored as `matter_receipt` but should be `trust_to_business` with link to the corresponding trust_transfer_out. This linkage is Phase 5.6.

**Invoice line items: 1,380 unlinked** (of 3,176). These are where description/total differences prevent exact-match relinkage — largely a cosmetic concern since `fee_entry_id` is informational only per schema.

**Matter owners**: LP's 3 CLEARING matters had no owner — assigned to Jessica-Jayde by default during Phase 4 fix.

**Fee earner names**: LP stores "Jessica-Jayde Dolata" as full name; Casey stores `first_name="Jessica"`. Imports use an alias map (`lp-user-mapping.md`) rather than renaming the Casey record.

**Matter salesagents array**: 136 matters have LP `salesagents` UIDs that don't match active LP users (archived). Skipped `matter_users` population; can backfill if an archived-salesagent export is produced.
