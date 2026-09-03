-- Hostal Casa Andina — esquema base
-- Aplicar primero. Luego 0002_seed.sql

create type estado_reserva as enum ('confirmada', 'cancelada');

create table habitaciones (
  id            serial primary key,
  codigo        text not null unique,
  nombre        text not null,
  capacidad     int  not null,
  activa        boolean not null default true
);

create table huespedes (
  id            serial primary key,
  nombre        text not null,
  cedula        text not null,
  telefono      text,
  creado_en     timestamptz not null default now()
);

create table reservas (
  id            serial primary key,
  habitacion_id int  not null references habitaciones(id),
  huesped_id    int  not null references huespedes(id),
  check_in      date not null,
  check_out     date not null,
  personas      int  not null default 1,
  precio_total  numeric(10,2),
  estado        estado_reserva not null default 'confirmada',
  creado_en     timestamptz not null default now()
);

create index idx_reservas_habitacion on reservas (habitacion_id);
create index idx_reservas_fechas     on reservas (check_in, check_out);
