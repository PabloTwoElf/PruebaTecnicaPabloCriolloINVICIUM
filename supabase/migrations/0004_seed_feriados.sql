-- Hostal Casa Andina — tabla y semilla de feriados
-- Fuente de verdad para el motor de tarifas (temporada alta).
-- Aplicar después de 0003_booking_constraints.sql

-- 1. Tabla de feriados.
--    - fecha es UNIQUE: no puede haber dos feriados el mismo día.
--    - tipo permite distinguir nacionales de locales exclusivos (ej. Fundación de Quito).
create table if not exists feriados (
  id     serial primary key,
  fecha  date not null unique,
  nombre text not null,
  tipo   text not null default 'nacional'
    check (tipo in ('nacional', 'local'))
);

create index if not exists idx_feriados_fecha on feriados (fecha);

-- 2. Semilla oficial 2026 (Ecuador) — provista por el usuario.
--    Nota: fechas trasladadas ya vienen movidas al lunes cuando cae en domingo.
insert into feriados (fecha, nombre, tipo) values
  ('2026-01-01', 'Año Nuevo',                                'nacional'),
  ('2026-01-02', 'Año Nuevo (puente)',                       'nacional'),
  ('2026-02-16', 'Carnaval',                                 'nacional'),
  ('2026-02-17', 'Carnaval',                                 'nacional'),
  ('2026-04-03', 'Viernes Santo',                            'nacional'),
  ('2026-05-01', 'Día del Trabajo',                          'nacional'),
  ('2026-05-25', 'Batalla de Pichincha (trasladado)',        'nacional'),
  ('2026-08-10', 'Primer Grito de Independencia',            'nacional'),
  ('2026-10-09', 'Independencia de Guayaquil',               'nacional'),
  ('2026-11-02', 'Día de los Difuntos',                      'nacional'),
  ('2026-11-03', 'Independencia de Cuenca',                  'nacional'),
  ('2026-12-07', 'Fundación de Quito (trasladado)',          'local'),
  ('2026-12-25', 'Navidad',                                  'nacional')
on conflict (fecha) do nothing;
