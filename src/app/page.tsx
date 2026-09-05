import { disponibilidadService } from "@/lib/services/DisponibilidadService";
import { supabase } from "@/lib/db";
import { Feriado, Habitacion, Reserva } from "@/lib/types";
import { BookingApp } from "@/components/BookingApp";
import { ReservasPanel } from "@/components/ReservasPanel";

export const dynamic = "force-dynamic";

interface ReservaConJoin extends Reserva {
  habitaciones: Pick<Habitacion, "codigo" | "nombre"> | null;
  huespedes: { nombre: string; cedula: string } | null;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMas(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function cargarHabitaciones(): Promise<Habitacion[]> {
  const { data } = await supabase
    .from("habitaciones")
    .select("id, codigo, nombre, capacidad, activa")
    .order("codigo");
  return (data ?? []) as Habitacion[];
}

async function cargarFeriados(): Promise<Feriado[]> {
  const { data } = await supabase
    .from("feriados")
    .select("id, fecha, nombre, tipo")
    .order("fecha");
  return (data ?? []) as Feriado[];
}

async function cargarReservas(): Promise<ReservaConJoin[]> {
  const { data } = await supabase
    .from("reservas")
    .select(
      "id, habitacion_id, huesped_id, check_in, check_out, personas, precio_total, estado, creado_en, habitaciones(codigo, nombre), huespedes(nombre, cedula)"
    )
    .eq("estado", "confirmada")
    .order("check_in", { ascending: true });
  return (data ?? []) as unknown as ReservaConJoin[];
}

async function cargarDisponibilidadHoy() {
  try {
    return await disponibilidadService.verificarDisponibilidadOrq(
      hoyIso(),
      isoMas(1)
    );
  } catch {
    return [];
  }
}

export default async function Home() {
  const [habitaciones, feriados, reservas, dispHoy] = await Promise.all([
    cargarHabitaciones(),
    cargarFeriados(),
    cargarReservas(),
    cargarDisponibilidadHoy(),
  ]);

  const librasHoy = dispHoy.filter((d) => d.libre).length;

  return (
    <>
      <header>
        <h1>🏨 Hostal Casa Andina · Reservas Directas</h1>
        <div className="meta">
          {librasHoy}/{habitaciones.length} libres hoy · {feriados.length} feriados 2026
        </div>
      </header>

      <div className="grid">
        <BookingApp
          habitaciones={habitaciones}
          feriados={feriados.map((f) => ({ fecha: f.fecha, nombre: f.nombre }))}
        />
        <ReservasPanel initialReservas={reservas} />
      </div>
    </>
  );
}
