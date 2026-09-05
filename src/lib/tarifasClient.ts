import { TARIFAS } from "@/lib/config";
import {
  esFinDeSemana,
  estaEnTemporadaAltaFija,
  iterarNoches,
  toIso,
} from "@/utils/fechas";

// Reexportadas: este módulo es el punto de entrada "client-safe" para
// componentes "use client" (PriceCalendar, BookingApp). La lógica de fecha
// vive una sola vez en utils/fechas.ts (no depende de Supabase, así que es
// segura de importar tanto en server como en cliente).
export { esFinDeSemana, estaEnTemporadaAltaFija };

export type TipoNoche = "alta" | "baja";

export interface DiaCotizado {
  fecha: string;
  monto: number;
  tipo: TipoNoche;
  esFinDeSemana: boolean;
  esFeriado: boolean;
  nombreFeriado?: string;
}

export function cotizarDia(
  fecha: string,
  feriadosMap: Map<string, string>
): DiaCotizado {
  const finde = esFinDeSemana(fecha);
  const nombreFeriado = feriadosMap.get(fecha);
  const esFeriado = nombreFeriado !== undefined;
  const alta = finde || esFeriado || estaEnTemporadaAltaFija(fecha);
  return {
    fecha,
    monto: alta ? TARIFAS.temporadaAlta : TARIFAS.temporadaBaja,
    tipo: alta ? "alta" : "baja",
    esFinDeSemana: finde,
    esFeriado,
    nombreFeriado,
  };
}

export function generarMes(anio: number, mes: number): string[] {
  const fechas: string[] = [];
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  while (primero.getUTCMonth() === mes - 1) {
    fechas.push(toIso(primero));
    primero.setUTCDate(primero.getUTCDate() + 1);
  }
  return fechas;
}

export const iterarRangoNoches = iterarNoches;
