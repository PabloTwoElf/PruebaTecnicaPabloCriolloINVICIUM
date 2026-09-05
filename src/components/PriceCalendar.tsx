"use client";

import { useMemo } from "react";
import { cotizarDia, generarMes } from "@/lib/tarifasClient";

interface Feriado {
  fecha: string;
  nombre: string;
}

interface Props {
  feriados: Feriado[];
  anio: number;
  mes: number;
  rangoSeleccionado?: { checkIn: string; checkOut: string };
}

const NOMBRES_MES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

function iso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function estaEnRango(fecha: string, checkIn?: string, checkOut?: string): boolean {
  if (!checkIn || !checkOut) return false;
  return fecha >= checkIn && fecha < checkOut;
}

export function PriceCalendar({ feriados, anio, mes, rangoSeleccionado }: Props) {
  const feriadosMap = useMemo(
    () => new Map(feriados.map((f) => [f.fecha, f.nombre])),
    [feriados]
  );

  const dias = generarMes(anio, mes);
  const primerDow = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  const offset = primerDow === 0 ? 6 : primerDow - 1;
  const celdasVacias = Array.from({ length: offset }, (_, i) => i);

  return (
    <div className="cal">
      <div className="cal-header">
        <strong>
          {NOMBRES_MES[mes - 1]} {anio}
        </strong>
      </div>
      <div className="cal-dias">
        {DIAS.map((d) => (
          <div key={d} className="cal-dia-label">
            {d}
          </div>
        ))}
        {celdasVacias.map((i) => (
          <div key={`e-${i}`} className="cal-cell empty" />
        ))}
        {dias.map((fecha) => {
          const dia = parseInt(fecha.slice(-2), 10);
          const cot = cotizarDia(fecha, feriadosMap);
          const seleccionado = estaEnRango(
            fecha,
            rangoSeleccionado?.checkIn,
            rangoSeleccionado?.checkOut
          );
          const cls = [
            "cal-cell",
            cot.tipo === "alta" ? "alta" : "baja",
            cot.esFeriado ? "feriado" : "",
            cot.esFinDeSemana ? "finde" : "",
            seleccionado ? "sel" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={fecha}
              className={cls}
              title={
                cot.esFeriado
                  ? `${cot.nombreFeriado} — $${cot.monto}`
                  : `${cot.tipo === "alta" ? "Alta" : "Baja"} — $${cot.monto}`
              }
            >
              <span className="cal-num">{dia}</span>
              <span className="cal-precio">${cot.monto}</span>
              {cot.esFeriado && <span className="cal-mark">★</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PriceCalendarLegend() {
  return (
    <div className="cal-legend">
      <span>
        <i className="sw baja" /> Baja $25
      </span>
      <span>
        <i className="sw alta" /> Alta $40
      </span>
      <span>
        <i className="sw feriado" />★ Feriado
      </span>
      <span>
        <i className="sw sel" /> Rango
      </span>
    </div>
  );
}
