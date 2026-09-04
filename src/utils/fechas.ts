import { TEMPORADA_ALTA_FIJA } from "@/lib/config";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaISOValida(fecha: string): boolean {
  if (!ISO_DATE_RE.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

export function parseFecha(fecha: string): Date {
  if (!esFechaISOValida(fecha)) {
    throw new Error(`Fecha inválida: ${fecha}`);
  }
  return new Date(`${fecha}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function calcularNoches(checkIn: string, checkOut: string): number {
  const inD = parseFecha(checkIn);
  const outD = parseFecha(checkOut);
  const ms = outD.getTime() - inD.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function iterarNoches(checkIn: string, checkOut: string): string[] {
  const noches: string[] = [];
  const cur = parseFecha(checkIn);
  const fin = parseFecha(checkOut);
  while (cur < fin) {
    noches.push(toIso(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return noches;
}

export function esFinDeSemana(fecha: string): boolean {
  const d = parseFecha(fecha);
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

export function estaEnTemporadaAltaFija(fecha: string): boolean {
  const d = parseFecha(fecha);
  const mes = d.getUTCMonth() + 1;
  const dia = d.getUTCDate();
  const { inicioMes, inicioDia, finMes, finDia } = TEMPORADA_ALTA_FIJA;
  if (mes === inicioMes && dia >= inicioDia) return true;
  if (mes === finMes && dia <= finDia) return true;
  return false;
}

export function esFeriado(fecha: string, feriados: Iterable<string>): boolean {
  for (const f of feriados) {
    if (f === fecha) return true;
  }
  return false;
}
