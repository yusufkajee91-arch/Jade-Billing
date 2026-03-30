/**
 * Shared utilities for LawPractice ZA data import routes.
 */

interface UserForMatch {
  id: string
  firstName: string
  lastName: string
  role?: string
}

/**
 * Fuzzy-match a name string from LawPractice ZA to a user in the system.
 *
 * Strategy:
 * 1. "System" or empty → admin user
 * 2. Exact full-name match (case-insensitive)
 * 3. First name/word match — take the first word of input, check if any
 *    user's full name contains it
 * 4. Any word match — check if any word (>2 chars) from input appears
 *    in any user's full name
 * 5. Fallback to admin user
 */
export function matchFeeEarner(
  rawName: string | null | undefined,
  users: UserForMatch[],
  fallbackId: string,
): string {
  if (!rawName || rawName.trim() === '') return fallbackId

  const name = rawName.trim()

  // "System" → admin
  if (name.toLowerCase() === 'system') {
    return users.find(u => u.role === 'admin')?.id ?? fallbackId
  }

  const nameLower = name.toLowerCase()

  // Build full name strings once
  const usersWithFull = users.map(u => ({
    ...u,
    fullName: `${u.firstName} ${u.lastName}`.toLowerCase(),
  }))

  // 1. Exact full-name match
  const exact = usersWithFull.find(u => u.fullName === nameLower)
  if (exact) return exact.id

  // 2. First word match — split input on spaces and hyphens, take first token
  const words = nameLower.split(/[\s\-]+/).filter(w => w.length > 0)
  const firstName = words[0]
  if (firstName && firstName.length > 2) {
    const match = usersWithFull.find(u => u.fullName.includes(firstName))
    if (match) return match.id
  }

  // 3. Any word match — any word >2 chars
  for (const word of words) {
    if (word.length <= 2) continue
    const match = usersWithFull.find(u => u.fullName.includes(word))
    if (match) return match.id
  }

  return fallbackId
}
