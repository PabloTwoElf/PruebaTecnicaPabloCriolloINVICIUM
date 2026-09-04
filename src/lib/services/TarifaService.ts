import { supabase } from "@/lib/db";
import { TARIFAS } from "@/lib/config";
import { DesgloseNoche, DetalleTarifa, Feriado } from "@/lib/types";
import {
  calcularNoches,
  esFinDeSemana,
  estaEnTemporadaAltaFija,
  iterarNoches,
} from "@/utils/fechas";

export class TarifaService {
  async calcularCostoTotal(
    checkIn: string,
    checkOut: string,
    _habitacionId: number
  ): Promise<DetalleTarifa> {
    const noches = calcularNoches(checkIn, checkOut);
    if (noches < 1) {
      throw new Error("El rango debe cubrir al menos una noche.");
    }

    const feriados = await this.cargarFeriadosEnRango(checkIn, checkOut);
    const set = new Set(feriados.map((f) => f.fecha));

    const desglose: DesgloseNoche[] = [];
    let hayFinDeSemana = false;

    for (const fecha of iterarNoches(checkIn, checkOut)) {
      const finde = esFinDeSemana(fecha);
      const feriado = set.has(fecha);
      const temporadaAlta = finde || feriado || estaEnTemporadaAltaFija(fecha);
      const monto = temporadaAlta ? TARIFAS.temporadaAlta : TARIFAS.temporadaBaja;

      if (finde) hayFinDeSemana = true;

      desglose.push({
        fecha,
        tipo: temporadaAlta ? "alta" : "baja",
        monto,
        esFinDeSemana: finde,
        esFeriado: feriado,
      });
    }

    const base = desglose.reduce((acc, n) => acc + n.monto, 0);

    const aplicaDescuento =
      noches >= TARIFAS.nochesParaDescuento && !hayFinDeSemana;
    const descuento = aplicaDescuento
      ? Math.round(base * TARIFAS.descuentoEstadiaLarga * 100) / 100
      : 0;

    return {
      noches,
      base,
      descuento,
      total: Math.round((base - descuento) * 100) / 100,
      desglose,
      aplicaDescuento,
    };
  }

  private async cargarFeriadosEnRango(
    checkIn: string,
    checkOut: string
  ): Promise<Feriado[]> {
    const { data, error } = await supabase
      .from("feriados")
      .select("id, fecha, nombre, tipo")
      .gte("fecha", checkIn)
      .lt("fecha", checkOut);

    if (error) {
      throw new Error(`Error consultando feriados: ${error.message}`);
    }

    return (data ?? []) as Feriado[];
  }
}

export const tarifaService = new TarifaService();
