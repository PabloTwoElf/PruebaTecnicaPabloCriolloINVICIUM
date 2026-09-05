-- Habilita Supabase Realtime sobre reservas y habitaciones.
-- Permite que el cliente reciba eventos INSERT/UPDATE/DELETE en tiempo real
-- vía canal postgres_changes, sin polling.

alter publication supabase_realtime add table public.reservas;
alter publication supabase_realtime add table public.habitaciones;
