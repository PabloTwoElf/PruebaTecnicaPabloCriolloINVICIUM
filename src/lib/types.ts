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

export interface Feriado {
  id: number;
  fecha: string;
  nombre: string;
  tipo: "nacional" | "local";
}

export interface RangoFechas {
  checkIn: string;
  checkOut: string;
}

export type TipoNoche = "alta" | "baja";

export interface DesgloseNoche {
  fecha: string;
  tipo: TipoNoche;
  monto: number;
  esFinDeSemana: boolean;
  esFeriado: boolean;
}

export interface DetalleTarifa {
  noches: number;
  base: number;
  descuento: number;
  total: number;
  desglose: DesgloseNoche[];
  aplicaDescuento: boolean;
}

export interface CrearReservaInput {
  nombre: string;
  cedula: string;
  habitacionId: number;
  checkIn: string;
  checkOut: string;
  personas: number;
}

export interface CrearReservaResultado {
  reservaId: number;
  costo: number;
  desglose: DesgloseNoche[];
}

export type EventoChannelSync = "reservation.confirmed" | "reservation.canceled";
export type EstadoChannelSync = "Confirmed" | "Canceled";

export interface ChannelSyncPayload {
  reservaId: number;
  habitacionNumero: string;
  checkIn: string;
  checkOut: string;
  estado: EstadoChannelSync;
}

export interface DisponibilidadPorHabitacion {
  habitacion: Habitacion;
  libre: boolean;
  reservasConflicto: Array<Pick<Reserva, "id" | "check_in" | "check_out">>;
}
