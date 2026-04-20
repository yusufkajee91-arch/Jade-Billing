# LP Login → Casey User ID Mapping

Used by Phase 5 transactional imports to set `created_by` and `capturer_id` on historical rows.

## Direct mappings (LP firm users that already exist in Casey)

| LP `login_name` | LP `login_uid` | Casey `users.id` | Casey email | Notes |
|---|---|---|---|---|
| Jessica-Jayde Dolata | LGN_SYS_1_2233138458943 | `09bdbcb0-c7eb-473e-9d70-6e8a2d1646bd` | Jess@dcco.law | Firm principal |
| Laken-Ash | LGN_SYS_1_54870893396609 | `6efb0867-2943-4e80-a4d2-8423777d6be1` | associate@dcco.law | Associate |
| Gisele Mans | LGN_SYS_1_78142580483494 | `419d3942-e255-4201-bdee-73db7e223e0a` | gisele@dcco.law | LP shows `archived=1` — active in Casey |
| Maxine Clement | LGN_SYS_1_96853137468553 | `d3834986-1bdf-496e-ad2f-246cbf5fc9f8` | maxine@dcco.law | LP email `@mcattorneys.net`; Casey uses `@dcco.law` |

## New Casey users to create (LP firm logins not yet in Casey)

| LP `login_name` | LP `login_uid` | Proposed Casey email | Proposed role | Notes |
|---|---|---|---|---|
| Assistant | LGN_SYS_1_55226531787957 | `info@dcco.law` | `assistant` | Generic shared login in LP |

## Map to 'LP Import' system user (LP-external or non-firm logins)

Create a new system user: `email=lp-import@dcco.law`, `role=admin`, `is_active=false`, `first_name=LP`, `last_name=Import`.

Any LP entry posted by the following logins → `created_by = lp-import system user`:

| LP `login_name` | LP `login_uid` | Reason |
|---|---|---|
| Chris Geale | LGN_SYS_1_71147219824834 | LP vendor (chris@lawpracticeza.com), not firm staff |
| Shaan Stander | LGN_JES_1_64863667040017 | External (shaan@actrp.co.za) |
| System | LGN_SYSTEM | LP auto-posted rows |

## Casey users with no LP equivalent

| Casey `users.id` | Email | Notes |
|---|---|---|
| `seed-admin-user` | admin@dcco.law | Casey seed admin; not referenced by LP data |
| `bdc1387f-6974-4a2a-bc6a-1a81dbba281c` | earner@dcco.law | Placeholder/test fee earner; not in LP |

## Implementation

`scripts/lp-user-map.mjs` exports a function:

```js
export function mapLpLoginToCaseyUserId(lpLoginUid, lpLoginName) { ... }
```

Returns Casey `users.id` string, creating+returning the `lp-import` user ID on any unmapped login.
