import { TARIFAS, TEMPORADA_ALTA_FIJA } from "@/lib/config";

export type TipoNoche = "alta" | "baja";

export interface DiaCotizado {
  fecha: string;
  monto: number;
  tipo: TipoNoche;
  esFinDeSemana: boolean;
  esFeriado: boolean;
  nombreFeriado?: string;
}

function parseUTC(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function esFinDeSemana(fecha: string): boolean {
  const dow = parseUTC(fecha).getUTCDay();
  return dow === 0 || dow === 6;
}

export function estaEnTemporadaAltaFija(fecha: string): boolean {
  const d = parseUTC(fecha);
  const mes = d.getUTCMonth() + 1;
  const dia = d.getUTCDate();
  const { inicioMes, inicioDia, finMes, finDia } = TEMPORADA_ALTA_FIJA;
  if (mes === inicioMes && dia >= inicioDia) return true;
  if (mes === finMes && dia <= finDia) return true;
  return false;
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

export function iterarRangoNoches(checkIn: string, checkOut: string): string[] {
  const noches: string[] = [];
  const cur = parseUTC(checkIn);
  const fin = parseUTC(checkOut);
  while (cur < fin) {
    noches.push(toIso(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return noches;
}
