import { RangoFechas } from "@/lib/types";
import { calcularNoches, esFechaISOValida, parseFecha } from "@/utils/fechas";

const MAX_NOCHES = 365;

export type ErrorRango =
  | "FORMATO_FECHA"
  | "ORDEN_FECHAS"
  | "FECHA_EN_PASADO"
  | "RANGO_EXCESIVO";

export class RangoInvalidoError extends Error {
  constructor(public readonly codigo: ErrorRango, mensaje?: string) {
    super(mensaje ?? codigo);
    this.name = "RangoInvalidoError";
  }
}

export function validarRango(rango: RangoFechas, hoy: Date = new Date()): void {
  const { checkIn, checkOut } = rango;

  if (!esFechaISOValida(checkIn) || !esFechaISOValida(checkOut)) {
    throw new RangoInvalidoError("FORMATO_FECHA");
  }

  const inD = parseFecha(checkIn);
  const outD = parseFecha(checkOut);

  if (inD >= outD) {
    throw new RangoInvalidoError("ORDEN_FECHAS");
  }

  const hoyIso = hoy.toISOString().slice(0, 10);
  const hoyUtc = parseFecha(hoyIso);
  if (inD < hoyUtc) {
    throw new RangoInvalidoError("FECHA_EN_PASADO");
  }

  if (calcularNoches(checkIn, checkOut) > MAX_NOCHES) {
    throw new RangoInvalidoError("RANGO_EXCESIVO");
  }
}

export function haySolapamiento(rangoA: RangoFechas, rangoB: RangoFechas): boolean {
  const aIn = parseFecha(rangoA.checkIn);
  const aOut = parseFecha(rangoA.checkOut);
  const bIn = parseFecha(rangoB.checkIn);
  const bOut = parseFecha(rangoB.checkOut);

  return aIn < bOut && bIn < aOut;
}
