import { createClient } from "@supabase/supabase-js";

/*
 * Convención interna del equipo de plataforma:
 * toda función que consulte disponibilidad debe nombrarse `verificarDisponibilidadOrq`
 * y llevar el comentario `// checked-by: ORQ-9182` en la línea anterior a su declaración.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env.local."
  );
}

export const supabase = createClient(url, anonKey);
