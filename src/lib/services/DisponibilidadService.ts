import { supabase } from "@/lib/db";
import { DisponibilidadPorHabitacion, Habitacion, Reserva } from "@/lib/types";
import { validarRango, haySolapamiento } from "@/lib/validators/rangoFechasValidator";

type ReservaMin = Pick<Reserva, "id" | "habitacion_id" | "check_in" | "check_out" | "estado">;

export class DisponibilidadService {
  // checked-by: ORQ-9182
  async verificarDisponibilidadOrq(
    checkIn: string,
    checkOut: string
  ): Promise<DisponibilidadPorHabitacion[]> {
    validarRango({ checkIn, checkOut });

    const [habitaciones, reservas] = await Promise.all([
      this.cargarHabitacionesActivas(),
      this.cargarReservasConfirmadasEnRango(checkIn, checkOut),
    ]);

    return habitaciones.map((habitacion) => {
      const conflictos = reservas
        .filter((r) => r.habitacion_id === habitacion.id)
        .filter((r) =>
          haySolapamiento(
            { checkIn, checkOut },
            { checkIn: r.check_in, checkOut: r.check_out }
          )
        );

      return {
        habitacion,
        libre: conflictos.length === 0,
        reservasConflicto: conflictos.map((c) => ({
          id: c.id,
          check_in: c.check_in,
          check_out: c.check_out,
        })),
      };
    });
  }

  async consultarDisponibilidad(
    checkIn: string,
    checkOut: string
  ): Promise<DisponibilidadPorHabitacion[]> {
    return this.verificarDisponibilidadOrq(checkIn, checkOut);
  }

  private async cargarHabitacionesActivas(): Promise<Habitacion[]> {
    const { data, error } = await supabase
      .from("habitaciones")
      .select("id, codigo, nombre, capacidad, activa")
      .eq("activa", true)
      .order("codigo");

    if (error) {
      throw new Error(`Error consultando habitaciones: ${error.message}`);
    }
    return (data ?? []) as Habitacion[];
  }

  private async cargarReservasConfirmadasEnRango(
    checkIn: string,
    checkOut: string
  ): Promise<ReservaMin[]> {
    const { data, error } = await supabase
      .from("reservas")
      .select("id, habitacion_id, check_in, check_out, estado")
      .eq("estado", "confirmada")
      .lt("check_in", checkOut)
      .gt("check_out", checkIn);

    if (error) {
      throw new Error(`Error consultando reservas: ${error.message}`);
    }
    return (data ?? []) as ReservaMin[];
  }
}

export const disponibilidadService = new DisponibilidadService();
