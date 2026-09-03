export type EstadoReserva = "confirmada" | "cancelada";

export interface Habitacion {
  id: number;
  codigo: string;
  nombre: string;
  capacidad: number;
  activa: boolean;
}

export interface Huesped {
  id: number;
  nombre: string;
  cedula: string;
  telefono: string | null;
}

export interface Reserva {
  id: number;
  habitacion_id: number;
  huesped_id: number;
  check_in: string;
  check_out: string;
  personas: number;
  precio_total: number | null;
  estado: EstadoReserva;
}
