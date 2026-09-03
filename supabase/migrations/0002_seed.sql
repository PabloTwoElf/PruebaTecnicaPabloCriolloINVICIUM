-- Datos de ejemplo del Hostal Casa Andina

insert into habitaciones (codigo, nombre, capacidad) values
  ('101', 'Doble Ventana',      2),
  ('102', 'Doble Interior',     2),
  ('103', 'Individual',         1),
  ('201', 'Triple Balcon',      3),
  ('202', 'Matrimonial',        2),
  ('203', 'Familiar Buhardilla', 4);

insert into huespedes (nombre, cedula, telefono) values
  ('Maria Jose Cevallos', '1712345678', '0991112233'),
  ('Andres Lopez',        '0603219876', '0987654321'),
  ('Grupo Turismo Sierra','1790012345', '022345678');

-- Reservas existentes
insert into reservas (habitacion_id, huesped_id, check_in, check_out, personas, precio_total, estado) values
  (1, 1, '2026-09-10', '2026-09-14', 2, 100.00, 'confirmada'),
  (1, 2, '2026-09-12', '2026-09-16', 1, 100.00, 'confirmada'),
  (6, 3, '2026-12-20', '2026-12-28', 4, 200.00, 'confirmada');
