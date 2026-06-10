// lib/supabaseAdmin.ts
// Client Supabase côté SERVEUR (clé secrète). Initialisation paresseuse
// pour ne pas planter le build quand les variables ne sont pas encore là.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  return _client;
}
