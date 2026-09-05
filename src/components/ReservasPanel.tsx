"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/db";
import type { EstadoReserva, Habitacion, Reserva } from "@/lib/types";
import { CancelReservaForm } from "./CancelReservaForm";

interface ReservaConJoin extends Reserva {
  habitaciones: Pick<Habitacion, "codigo" | "nombre"> | null;
  huespedes: { nombre: string; cedula: string } | null;
}

interface Props {
  initialReservas: ReservaConJoin[];
}

type Filtro = "all" | "confirmada" | "cancelada";

export function ReservasPanel({ initialReservas }: Props) {
  const [reservas, setReservas] = useState<ReservaConJoin[]>(initialReservas);
  const [conectado, setConectado] = useState(false);
  const [ultimoEvento, setUltimoEvento] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("all");
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    const res = await fetch("/api/reservas?estado=all", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setReservas(data.reservas as ReservaConJoin[]);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("realtime:reservas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas" },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<Reserva> | undefined;
          const id = row?.id ?? null;
          setUltimoEvento(
            `${payload.eventType.toLowerCase()} · reserva #${id ?? "?"} · ${new Date().toLocaleTimeString()}`
          );
          if (id) {
            setFlashId(id);
            if (flashTimeout.current) clearTimeout(flashTimeout.current);
            flashTimeout.current = setTimeout(() => setFlashId(null), 2000);
          }
          refetch();
        }
      )
      .subscribe((status) => {
        setConectado(status === "SUBSCRIBED");
      });

    return () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const reservasFiltradas = useMemo(() => {
    if (filtro === "all") return reservas;
    return reservas.filter((r) => r.estado === filtro);
  }, [reservas, filtro]);

  const totales = useMemo(() => {
    const conf = reservas.filter((r) => r.estado === "confirmada").length;
    const can = reservas.filter((r) => r.estado === "cancelada").length;
    return { all: reservas.length, confirmada: conf, cancelada: can };
  }, [reservas]);

  return (
    <div className="panel">
      <h2>
        Reservas
        <span
          className={`live-dot ${conectado ? "on" : "off"}`}
          title={conectado ? "Realtime conectado" : "Realtime desconectado"}
        />
        <span className="live-label">{conectado ? "LIVE" : "OFF"}</span>
      </h2>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${filtro === "all" ? "active" : ""}`}
          onClick={() => setFiltro("all")}
        >
          Todas <span className="tab-count">{totales.all}</span>
        </button>
        <button
          type="button"
          className={`tab ${filtro === "confirmada" ? "active" : ""}`}
          onClick={() => setFiltro("confirmada")}
        >
          Confirmadas <span className="tab-count">{totales.confirmada}</span>
        </button>
        <button
          type="button"
          className={`tab ${filtro === "cancelada" ? "active" : ""}`}
          onClick={() => setFiltro("cancelada")}
        >
          Canceladas <span className="tab-count">{totales.cancelada}</span>
        </button>
      </div>

      {ultimoEvento && <div className="live-event">Último: {ultimoEvento}</div>}

      <div className="panel-scroll">
        {reservasFiltradas.length === 0 ? (
          <p className="empty">No hay reservas para mostrar.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Hab.</th>
                <th>Huésped</th>
                <th>Cédula</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Pax</th>
                <th>Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reservasFiltradas.map((r) => (
                <tr
                  key={r.id}
                  className={`${flashId === r.id ? "flash" : ""} ${r.estado === "cancelada" ? "row-cancelada" : ""}`}
                >
                  <td>{r.id}</td>
                  <td>{r.habitaciones?.codigo ?? r.habitacion_id}</td>
                  <td>{r.huespedes?.nombre ?? "—"}</td>
                  <td>{r.huespedes?.cedula ?? "—"}</td>
                  <td>{r.check_in}</td>
                  <td>{r.check_out}</td>
                  <td>{r.personas}</td>
                  <td>${r.precio_total ?? "—"}</td>
                  <td>
                    <EstadoBadge estado={r.estado} />
                  </td>
                  <td>
                    {r.estado === "confirmada" ? (
                      <CancelReservaForm reservaId={r.id} />
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: EstadoReserva }) {
  return (
    <span className={`badge badge-${estado}`}>
      {estado === "confirmada" ? "✓ Confirmada" : "✗ Cancelada"}
    </span>
  );
}
