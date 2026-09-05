"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/db";
import type { Habitacion, Reserva } from "@/lib/types";
import { CancelReservaForm } from "./CancelReservaForm";

interface ReservaConJoin extends Reserva {
  habitaciones: Pick<Habitacion, "codigo" | "nombre"> | null;
  huespedes: { nombre: string; cedula: string } | null;
}

interface Props {
  initialReservas: ReservaConJoin[];
}

export function ReservasPanel({ initialReservas }: Props) {
  const [reservas, setReservas] = useState<ReservaConJoin[]>(initialReservas);
  const [conectado, setConectado] = useState(false);
  const [ultimoEvento, setUltimoEvento] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    const res = await fetch("/api/reservas?estado=confirmada", { cache: "no-store" });
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

  return (
    <div className="panel">
      <h2>
        Reservas confirmadas
        <span className={`live-dot ${conectado ? "on" : "off"}`} title={conectado ? "Realtime conectado" : "Realtime desconectado"} />
        <span className="live-label">{conectado ? "LIVE" : "OFF"}</span>
      </h2>
      {ultimoEvento && <div className="live-event">Último: {ultimoEvento}</div>}
      <div className="panel-scroll">
        {reservas.length === 0 ? (
          <p className="empty">No hay reservas confirmadas.</p>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((r) => (
                <tr key={r.id} className={flashId === r.id ? "flash" : ""}>
                  <td>{r.id}</td>
                  <td>{r.habitaciones?.codigo ?? r.habitacion_id}</td>
                  <td>{r.huespedes?.nombre ?? "—"}</td>
                  <td>{r.huespedes?.cedula ?? "—"}</td>
                  <td>{r.check_in}</td>
                  <td>{r.check_out}</td>
                  <td>{r.personas}</td>
                  <td>${r.precio_total ?? "—"}</td>
                  <td>
                    <CancelReservaForm reservaId={r.id} />
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
