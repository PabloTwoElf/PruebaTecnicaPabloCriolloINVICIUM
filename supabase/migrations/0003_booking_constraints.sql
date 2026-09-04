-- Hostal Casa Andina — constraints anti-solapamiento
-- Aplicar después de 0001_init.sql y 0002_seed.sql

-- 1. Extensión necesaria para EXCLUDE con GiST sobre tipos escalares (habitacion_id) + rango.
create extension if not exists btree_gist;

-- 2. Sanear seed: la reserva id=2 (habitacion 1, 2026-09-12 → 2026-09-16) solapa con la
--    reserva id=1 (habitacion 1, 2026-09-10 → 2026-09-14). Preferimos cancelar (soft) a
--    borrar para conservar trazabilidad histórica.
update reservas
   set estado = 'cancelada'
 where id = 2 and estado = 'confirmada';

-- 3. Sanidad: check_in debe ser estrictamente menor a check_out.
alter table reservas
  add constraint reservas_fechas_validas
  check (check_in < check_out);

-- 4. EXCLUDE de solapamientos con rango semiabierto [check_in, check_out).
--    - '[)' garantiza que si una reserva termina el día X y otra empieza el día X,
--      NO se consideran solapadas (rotación mismo día: salida 11:00 / entrada 15:00).
--    - Solo aplica cuando estado = 'confirmada'; canceladas no bloquean nuevas reservas.
alter table reservas
  add constraint reservas_no_solape
  exclude using gist (
    habitacion_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (estado = 'confirmada');

-- 5. Índice GiST funcional para acelerar consultas de disponibilidad por rango.
create index if not exists idx_reservas_rango_gist
  on reservas using gist (habitacion_id, daterange(check_in, check_out, '[)'))
  where estado = 'confirmada';
