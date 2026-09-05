"use client";

import { useMemo, useState } from "react";
import { PriceCalendar, PriceCalendarLegend } from "./PriceCalendar";
import {
  cotizarDia,
  iterarRangoNoches,
  type DiaCotizado,
} from "@/lib/tarifasClient";
import { validarCedula } from "@/utils/cedula";
import type { Habitacion } from "@/lib/types";

interface Feriado {
  fecha: string;
  nombre: string;
}

interface Props {
  habitaciones: Habitacion[];
  feriados: Feriado[];
}

interface EstadoDisponibilidad {
  habitacion: Habitacion;
  libre: boolean;
  reservasConflicto: Array<{ id: number; check_in: string; check_out: string }>;
}

interface DisponibilidadRespuesta {
  checkIn: string;
  checkOut: string;
  noches: number;
  estado: EstadoDisponibilidad[];
}

type MensajeUI =
  | { tipo: "ok"; texto: string }
  | { tipo: "error"; texto: string }
  | null;

type EstadoCedula = "vacia" | "parcial" | "valida" | "invalida";

const MENSAJES_ERROR: Record<string, string> = {
  CEDULA_INVALIDA: "Cédula ecuatoriana inválida. Revisa provincia (01-24), tercer dígito (0-5) y dígito verificador.",
  NOMBRE_REQUERIDO: "El nombre del huésped es obligatorio.",
  PERSONAS_INVALIDAS: "El número de personas debe ser al menos 1.",
  HABITACION_INEXISTENTE: "La habitación seleccionada no existe.",
  HABITACION_INACTIVA: "La habitación está fuera de servicio.",
  CAPACIDAD_EXCEDIDA: "El número de personas supera la capacidad de la habitación.",
  RESERVA_SOLAPADA: "La habitación ya está reservada en ese rango de fechas.",
  FORMATO_FECHA: "Formato de fecha inválido. Usa AAAA-MM-DD.",
  ORDEN_FECHAS: "El check-in debe ser anterior al check-out.",
  FECHA_EN_PASADO: "La fecha de check-in no puede estar en el pasado.",
  RANGO_EXCESIVO: "El rango supera el máximo de 365 noches.",
  BODY_INVALIDO: "El formato del envío no es válido.",
  INTERNAL: "Error interno del servidor. Reintentá.",
};

function traducirError(codigo: string, fallback?: string): string {
  return MENSAJES_ERROR[codigo] ?? fallback ?? codigo;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMas(dias: number, base?: string): string {
  const d = base ? new Date(`${base}T00:00:00Z`) : new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function proximoDow(dow: number): string {
  const d = new Date();
  const diff = (dow - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

interface Shortcut {
  label: string;
  build: () => { checkIn: string; checkOut: string };
}

const SHORTCUTS: Shortcut[] = [
  { label: "1 noche (hoy)", build: () => ({ checkIn: hoyIso(), checkOut: isoMas(1) }) },
  {
    label: "Fin de semana",
    build: () => {
      const viernes = proximoDow(5);
      return { checkIn: viernes, checkOut: isoMas(2, viernes) };
    },
  },
  { label: "1 semana", build: () => ({ checkIn: hoyIso(), checkOut: isoMas(7) }) },
  { label: "Carnaval", build: () => ({ checkIn: "2026-02-14", checkOut: "2026-02-18" }) },
  { label: "Semana Santa", build: () => ({ checkIn: "2026-04-02", checkOut: "2026-04-06" }) },
  { label: "Navidad", build: () => ({ checkIn: "2026-12-23", checkOut: "2026-12-27" }) },
  { label: "Fin de año", build: () => ({ checkIn: "2026-12-30", checkOut: "2027-01-03" }) },
];

function evaluarCedula(cedula: string): EstadoCedula {
  const trimmed = cedula.trim();
  if (trimmed.length === 0) return "vacia";
  if (!/^\d+$/.test(trimmed)) return "invalida";
  if (trimmed.length < 10) return "parcial";
  if (trimmed.length > 10) return "invalida";
  return validarCedula(trimmed) ? "valida" : "invalida";
}

export function BookingApp({ habitaciones, feriados }: Props) {
  const feriadosMap = useMemo(
    () => new Map(feriados.map((f) => [f.fecha, f.nombre])),
    [feriados]
  );

  const habitacionesActivas = habitaciones.filter((h) => h.activa);

  const [rango, setRango] = useState({ checkIn: hoyIso(), checkOut: isoMas(1) });
  const [dispResult, setDispResult] = useState<DisponibilidadRespuesta | null>(null);
  const [dispMsg, setDispMsg] = useState<MensajeUI>(null);
  const [loadingDisp, setLoadingDisp] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    cedula: "",
    habitacionId: String(habitacionesActivas[0]?.id ?? ""),
    checkIn: hoyIso(),
    checkOut: isoMas(1),
    personas: "1",
  });
  const [reservaMsg, setReservaMsg] = useState<MensajeUI>(null);
  const [loadingReserva, setLoadingReserva] = useState(false);

  const estadoCedula = evaluarCedula(form.cedula);

  const desglose: DiaCotizado[] = useMemo(() => {
    if (!rango.checkIn || !rango.checkOut || rango.checkIn >= rango.checkOut)
      return [];
    return iterarRangoNoches(rango.checkIn, rango.checkOut).map((f) =>
      cotizarDia(f, feriadosMap)
    );
  }, [rango, feriadosMap]);

  const total = desglose.reduce((s, d) => s + d.monto, 0);
  const aplicaDescuento =
    desglose.length >= 7 && !desglose.some((d) => d.esFinDeSemana);
  const descuento = aplicaDescuento ? Math.round(total * 10) / 100 : 0;

  const habitacionesRecomendadas = dispResult?.estado.filter((e) => e.libre) ?? [];

  const anioBase = parseInt(rango.checkIn.slice(0, 4), 10) || 2026;
  const mesBase = parseInt(rango.checkIn.slice(5, 7), 10) || 1;
  const proximoMes = mesBase === 12 ? 1 : mesBase + 1;
  const anioProx = mesBase === 12 ? anioBase + 1 : anioBase;

  function aplicarShortcut(s: Shortcut) {
    const r = s.build();
    setRango(r);
    setForm((prev) => ({ ...prev, checkIn: r.checkIn, checkOut: r.checkOut }));
  }

  async function consultarDisponibilidad(e: React.FormEvent) {
    e.preventDefault();
    setDispMsg(null);
    setLoadingDisp(true);
    try {
      const url = `/api/disponibilidad?checkIn=${rango.checkIn}&checkOut=${rango.checkOut}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setDispMsg({ tipo: "error", texto: traducirError(data.error, data.mensaje) });
        setDispResult(null);
        return;
      }
      setDispResult(data);
      const libres = data.estado.filter((e: EstadoDisponibilidad) => e.libre).length;
      setDispMsg({
        tipo: "ok",
        texto: `${libres} de ${data.estado.length} habitaciones disponibles · ${data.noches} noches · base $${total.toFixed(2)}`,
      });
    } catch (err) {
      setDispMsg({ tipo: "error", texto: (err as Error).message });
    } finally {
      setLoadingDisp(false);
    }
  }

  async function crearReserva(e: React.FormEvent) {
    e.preventDefault();
    if (estadoCedula !== "valida") {
      setReservaMsg({ tipo: "error", texto: MENSAJES_ERROR.CEDULA_INVALIDA });
      return;
    }
    setReservaMsg(null);
    setLoadingReserva(true);
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          cedula: form.cedula,
          habitacionId: Number(form.habitacionId),
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          personas: Number(form.personas),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReservaMsg({ tipo: "error", texto: traducirError(data.error, data.mensaje) });
        return;
      }
      setReservaMsg({
        tipo: "ok",
        texto: `Reserva #${data.reservaId} creada. Total $${data.costo}.`,
      });
      setForm((f) => ({ ...f, nombre: "", cedula: "" }));
    } catch (err) {
      setReservaMsg({ tipo: "error", texto: (err as Error).message });
    } finally {
      setLoadingReserva(false);
    }
  }

  return (
    <>
      <div className="panel">
        <h2>Consultar disponibilidad + calendario de precios</h2>
        <div className="panel-scroll">
          <form onSubmit={consultarDisponibilidad} className="disp-form">
            <div className="shortcuts">
              {SHORTCUTS.map((s) => (
                <button
                  type="button"
                  key={s.label}
                  className="chip"
                  onClick={() => aplicarShortcut(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label>Check-in</label>
                <input
                  type="date"
                  value={rango.checkIn}
                  onChange={(e) => setRango({ ...rango, checkIn: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <label>Check-out</label>
                <input
                  type="date"
                  value={rango.checkOut}
                  onChange={(e) => setRango({ ...rango, checkOut: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={loadingDisp}>
              {loadingDisp ? "Consultando…" : "Consultar disponibilidad"}
            </button>
          </form>

          {dispMsg && <div className={`alert ${dispMsg.tipo}`}>{dispMsg.texto}</div>}

          {desglose.length > 0 && (
            <div className="cotizacion">
              <div className="cotizacion-summary">
                <span>{desglose.length} noches</span>
                <span>Base: ${total.toFixed(2)}</span>
                {aplicaDescuento && (
                  <span className="descuento">− Descuento 10%: ${descuento.toFixed(2)}</span>
                )}
                <strong>Total: ${(total - descuento).toFixed(2)}</strong>
              </div>
            </div>
          )}

          {dispResult && (
            <div className="rec-block">
              <h3>Habitaciones disponibles en el rango</h3>
              {habitacionesRecomendadas.length === 0 ? (
                <p className="empty">Ninguna habitación libre en ese rango. Probá otras fechas.</p>
              ) : (
                <ul className="rec-list">
                  {habitacionesRecomendadas.map((r) => (
                    <li key={r.habitacion.id}>
                      <strong>#{r.habitacion.codigo}</strong> · {r.habitacion.nombre} · cap {r.habitacion.capacidad}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <h3 className="cal-title">Calendario de tarifas</h3>
          <PriceCalendarLegend />
          <div className="cal-wrap">
            <PriceCalendar feriados={feriados} anio={anioBase} mes={mesBase} rangoSeleccionado={rango} />
            <PriceCalendar feriados={feriados} anio={anioProx} mes={proximoMes} rangoSeleccionado={rango} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Nueva reserva</h2>
        <div className="panel-scroll">
          <form onSubmit={crearReserva} className="reserva-form">
            <div className="form-row">
              <label>Nombre del huésped</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                minLength={2}
                required
                placeholder="Ej. Juan Pérez"
              />
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label>Cédula ecuatoriana</label>
                <div className="input-with-icon">
                  <input
                    inputMode="numeric"
                    value={form.cedula}
                    onChange={(e) =>
                      setForm({ ...form, cedula: e.target.value.replace(/\D/g, "").slice(0, 10) })
                    }
                    maxLength={10}
                    required
                    placeholder="1710034065"
                    className={`ced-${estadoCedula}`}
                  />
                  <span className={`ced-icon ced-${estadoCedula}`}>
                    {estadoCedula === "valida" && "✓"}
                    {estadoCedula === "invalida" && "✗"}
                    {estadoCedula === "parcial" && `${10 - form.cedula.length}`}
                  </span>
                </div>
                <span className={`ced-hint ced-${estadoCedula}`}>
                  {estadoCedula === "vacia" && "Ingresa 10 dígitos"}
                  {estadoCedula === "parcial" && `Faltan ${10 - form.cedula.length} dígitos`}
                  {estadoCedula === "valida" && "Cédula válida"}
                  {estadoCedula === "invalida" && "Cédula inválida (algoritmo módulo 10)"}
                </span>
              </div>
              <div className="form-row">
                <label>Personas</label>
                <input
                  type="number"
                  min={1}
                  value={form.personas}
                  onChange={(e) => setForm({ ...form, personas: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <label>Habitación</label>
              <select
                value={form.habitacionId}
                onChange={(e) => setForm({ ...form, habitacionId: e.target.value })}
                required
              >
                {habitacionesActivas.map((h) => (
                  <option key={h.id} value={h.id}>
                    #{h.codigo} — {h.nombre} (cap {h.capacidad})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid-2">
              <div className="form-row">
                <label>Check-in</label>
                <input
                  type="date"
                  value={form.checkIn}
                  onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <label>Check-out</label>
                <input
                  type="date"
                  value={form.checkOut}
                  onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingReserva || estadoCedula !== "valida"}
            >
              {loadingReserva ? "Reservando…" : "Reservar"}
            </button>

            {reservaMsg && <div className={`alert ${reservaMsg.tipo}`}>{reservaMsg.texto}</div>}
          </form>
        </div>
      </div>
    </>
  );
}
