import { CrearReservaInput, Habitacion } from "@/lib/types";
import { validarCedula } from "@/utils/cedula";
import { RangoInvalidoError, validarRango } from "./rangoFechasValidator";

export type ErrorReserva =
  | "NOMBRE_REQUERIDO"
  | "CEDULA_INVALIDA"
  | "PERSONAS_INVALIDAS"
  | "HABITACION_INEXISTENTE"
  | "HABITACION_INACTIVA"
  | "CAPACIDAD_EXCEDIDA";

export class ReservaInvalidaError extends Error {
  constructor(public readonly codigo: ErrorReserva | RangoInvalidoError["codigo"], mensaje?: string) {
    super(mensaje ?? codigo);
    this.name = "ReservaInvalidaError";
  }
}

export function validar(input: CrearReservaInput, habitacion: Habitacion | null): void {
  if (!input.nombre || input.nombre.trim().length < 2) {
    throw new ReservaInvalidaError("NOMBRE_REQUERIDO");
  }

  if (!validarCedula(input.cedula)) {
    throw new ReservaInvalidaError("CEDULA_INVALIDA");
  }

  if (!Number.isInteger(input.personas) || input.personas < 1) {
    throw new ReservaInvalidaError("PERSONAS_INVALIDAS");
  }

  if (!habitacion) {
    throw new ReservaInvalidaError("HABITACION_INEXISTENTE");
  }

  if (!habitacion.activa) {
    throw new ReservaInvalidaError("HABITACION_INACTIVA");
  }

  if (input.personas > habitacion.capacidad) {
    throw new ReservaInvalidaError("CAPACIDAD_EXCEDIDA");
  }

  try {
    validarRango({ checkIn: input.checkIn, checkOut: input.checkOut });
  } catch (err) {
    if (err instanceof RangoInvalidoError) {
      throw new ReservaInvalidaError(err.codigo, err.message);
    }
    throw err;
  }
}
