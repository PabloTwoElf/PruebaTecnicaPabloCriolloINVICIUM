import { disponibilidadService } from "@/lib/services/DisponibilidadService";
import { supabase } from "@/lib/db";
import { DisponibilidadPorHabitacion, Habitacion, Reserva } from "@/lib/types";

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

async function cargarDisponibilidad(): Promise<DisponibilidadPorHabitacion[]> {
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
  const [habitaciones, reservas, disponibilidadHoy] = await Promise.all([
    cargarHabitaciones(),
    cargarReservas(),
    cargarDisponibilidad(),
  ]);

  const librasHoy = disponibilidadHoy.filter((d) => d.libre).length;

  return (
    <>
      <header>
        <h1>🏨 Hostal Casa Andina · Reservas Directas</h1>
        <div className="meta">
          {librasHoy}/{habitaciones.length} libres hoy · {reservas.length} reservas activas
        </div>
      </header>

      <div className="grid">
        {/* Panel 1: Habitaciones */}
        <div className="panel">
          <h2>Habitaciones (hoy)</h2>
          <div className="panel-scroll">
            <div className="rooms">
              {habitaciones.map((h) => {
                const est = disponibilidadHoy.find((d) => d.habitacion.id === h.id);
                let badge: { clase: string; texto: string };
                if (!h.activa) badge = { clase: "badge-muted", texto: "inactiva" };
                else if (est?.libre) badge = { clase: "badge-ok", texto: "libre" };
                else badge = { clase: "badge-warn", texto: "ocupada" };

                return (
                  <div className="room" key={h.id}>
                    <div className="room-main">
                      <span className="room-code">
                        #{h.codigo} · {h.nombre}
                      </span>
                      <span className="room-name">Capacidad {h.capacidad}p</span>
                    </div>
                    <span className={`badge ${badge.clase}`}>{badge.texto}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel 2: Formularios */}
        <div className="panel">
          <h2>Acciones</h2>
          <div className="forms">
            <div className="form-block">
              <h3>Consultar disponibilidad</h3>
              <form method="GET" action="/api/disponibilidad">
                <div className="form-grid-2">
                  <div className="form-row">
                    <label>Check-in</label>
                    <input type="date" name="checkIn" defaultValue={hoyIso()} required />
                  </div>
                  <div className="form-row">
                    <label>Check-out</label>
                    <input type="date" name="checkOut" defaultValue={isoMas(1)} required />
                  </div>
                </div>
                <button type="submit">Consultar</button>
              </form>
            </div>

            <div className="form-block">
              <h3>Nueva reserva</h3>
              <form method="POST" action="/api/reservas">
                <div className="form-row">
                  <label>Nombre del huésped</label>
                  <input name="nombre" required minLength={2} placeholder="Ej. Juan Pérez" />
                </div>
                <div className="form-grid-2">
                  <div className="form-row">
                    <label>Cédula</label>
                    <input name="cedula" pattern="\d{10}" required placeholder="1712345678" />
                  </div>
                  <div className="form-row">
                    <label>Personas</label>
                    <input type="number" name="personas" min={1} defaultValue={1} required />
                  </div>
                </div>
                <div className="form-row">
                  <label>Habitación</label>
                  <select name="habitacionId" required>
                    {habitaciones
                      .filter((h) => h.activa)
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          #{h.codigo} — {h.nombre} (cap {h.capacidad})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-grid-2">
                  <div className="form-row">
                    <label>Check-in</label>
                    <input type="date" name="checkIn" defaultValue={hoyIso()} required />
                  </div>
                  <div className="form-row">
                    <label>Check-out</label>
                    <input type="date" name="checkOut" defaultValue={isoMas(1)} required />
                  </div>
                </div>
                <button type="submit">Reservar</button>
                <p className="hint">
                  Este form envía urlencoded. Para JSON usar <code>POST /api/reservas</code>.
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* Panel 3: Reservas activas */}
        <div className="panel">
          <h2>Reservas confirmadas</h2>
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
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.habitaciones?.codigo ?? r.habitacion_id}</td>
                      <td>{r.huespedes?.nombre ?? "—"}</td>
                      <td>{r.huespedes?.cedula ?? "—"}</td>
                      <td>{r.check_in}</td>
                      <td>{r.check_out}</td>
                      <td>{r.personas}</td>
                      <td>${r.precio_total ?? "—"}</td>
                      <td>
                        <form method="POST" action={`/api/reservas/${r.id}/cancelar`}>
                          <button type="submit" className="danger">
                            Cancelar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
