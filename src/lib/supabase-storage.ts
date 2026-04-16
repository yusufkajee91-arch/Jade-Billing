import { createClient } from '@supabase/supabase-js'

let supabaseAdmin: ReturnType<typeof createClient> | null = null

function getSupabaseStorageEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable',
    )
  }

  return { supabaseUrl, supabaseServiceKey }
}

/**
 * Server-side Supabase client using the service role key.
 * Used for storage operations (upload, download, delete) in API routes.
 */
export function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin
  }

  const { supabaseUrl, supabaseServiceKey } = getSupabaseStorageEnv()
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  return supabaseAdmin
}

export const FICA_BUCKET = 'fica-documents'
