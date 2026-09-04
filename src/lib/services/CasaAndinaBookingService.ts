import { supabase } from "@/lib/db";
import { CONCURRENCIA, PG_ERROR } from "@/lib/config";
import {
  CrearReservaInput,
  CrearReservaResultado,
  Habitacion,
  Reserva,
} from "@/lib/types";
import { ReservaInvalidaError, validar } from "@/lib/validators/reservaValidator";
import { tarifaService, TarifaService } from "./TarifaService";
import {
  disponibilidadService,
  DisponibilidadService,
} from "./DisponibilidadService";
import { channelSyncService, ChannelSyncService } from "./ChannelSyncService";

export class ReservaSolapadaError extends Error {
  constructor() {
    super("La habitación ya está reservada en el rango solicitado.");
    this.name = "ReservaSolapadaError";
  }
}

export class ReservaNoEncontradaError extends Error {
  constructor(id: number) {
    super(`Reserva ${id} no existe.`);
    this.name = "ReservaNoEncontradaError";
  }
}

export class ReservaYaCanceladaError extends Error {
  constructor(id: number) {
    super(`Reserva ${id} ya está cancelada.`);
    this.name = "ReservaYaCanceladaError";
  }
}

type SupabaseError = { code?: string | null; message: string };

export class CasaAndinaBookingService {
  constructor(
    private readonly tarifa: TarifaService = tarifaService,
    private readonly disponibilidad: DisponibilidadService = disponibilidadService,
    private readonly channelSync: ChannelSyncService = channelSyncService
  ) {}

  async crearReserva(payload: CrearReservaInput): Promise<CrearReservaResultado> {
    const habitacion = await this.cargarHabitacion(payload.habitacionId);
    validar(payload, habitacion);

    await this.verificarDisponibilidadPrevia(payload);

    const detalle = await this.tarifa.calcularCostoTotal(
      payload.checkIn,
      payload.checkOut,
      payload.habitacionId
    );

    const huespedId = await this.upsertHuesped(payload.nombre, payload.cedula);

    const reserva = await this.insertarReservaConReintento({
      habitacion_id: payload.habitacionId,
      huesped_id: huespedId,
      check_in: payload.checkIn,
      check_out: payload.checkOut,
      personas: payload.personas,
      precio_total: detalle.total,
    });

    await this.channelSync.notificar("reservation.confirmed", {
      reservaId: reserva.id,
      habitacionNumero: habitacion!.codigo,
      checkIn: reserva.check_in,
      checkOut: reserva.check_out,
      estado: "Confirmed",
    });

    return {
      reservaId: reserva.id,
      costo: detalle.total,
      desglose: detalle.desglose,
    };
  }

  async cancelarReserva(id: number): Promise<void> {
    const reserva = await this.cargarReserva(id);
    if (!reserva) throw new ReservaNoEncontradaError(id);
    if (reserva.estado === "cancelada") throw new ReservaYaCanceladaError(id);

    const { error } = await supabase
      .from("reservas")
      .update({ estado: "cancelada" })
      .eq("id", id)
      .eq("estado", "confirmada");

    if (error) throw new Error(`Error cancelando reserva: ${error.message}`);

    const habitacion = await this.cargarHabitacion(reserva.habitacion_id);

    await this.channelSync.notificar("reservation.canceled", {
      reservaId: reserva.id,
      habitacionNumero: habitacion?.codigo ?? String(reserva.habitacion_id),
      checkIn: reserva.check_in,
      checkOut: reserva.check_out,
      estado: "Canceled",
    });
  }

  private async cargarHabitacion(id: number): Promise<Habitacion | null> {
    const { data, error } = await supabase
      .from("habitaciones")
      .select("id, codigo, nombre, capacidad, activa")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Error consultando habitación: ${error.message}`);
    return (data as Habitacion | null) ?? null;
  }

  private async cargarReserva(id: number): Promise<Reserva | null> {
    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Error consultando reserva: ${error.message}`);
    return (data as Reserva | null) ?? null;
  }

  private async verificarDisponibilidadPrevia(input: CrearReservaInput): Promise<void> {
    const estado = await this.disponibilidad.verificarDisponibilidadOrq(
      input.checkIn,
      input.checkOut
    );
    const target = estado.find((e) => e.habitacion.id === input.habitacionId);
    if (target && !target.libre) {
      throw new ReservaSolapadaError();
    }
  }

  private async upsertHuesped(nombre: string, cedula: string): Promise<number> {
    const { data: existente, error: readErr } = await supabase
      .from("huespedes")
      .select("id")
      .eq("cedula", cedula)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (readErr) throw new Error(`Error buscando huésped: ${readErr.message}`);
    if (existente?.id) return existente.id as number;

    const { data: nuevo, error: insertErr } = await supabase
      .from("huespedes")
      .insert({ nombre: nombre.trim(), cedula })
      .select("id")
      .single();

    if (insertErr) throw new Error(`Error creando huésped: ${insertErr.message}`);
    return nuevo!.id as number;
  }

  private async insertarReservaConReintento(
    row: Omit<Reserva, "id" | "estado" | "precio_total"> & { precio_total: number }
  ): Promise<Reserva> {
    let ultimoError: unknown = null;

    for (let intento = 0; intento < CONCURRENCIA.maxReintentosSerializable; intento++) {
      const { data, error } = await supabase
        .from("reservas")
        .insert({ ...row, estado: "confirmada" })
        .select("*")
        .single();

      if (!error && data) return data as Reserva;

      const supaErr = error as unknown as SupabaseError;
      if (supaErr?.code === PG_ERROR.EXCLUSION_VIOLATION) {
        throw new ReservaSolapadaError();
      }
      if (supaErr?.code === PG_ERROR.SERIALIZATION_FAILURE) {
        ultimoError = supaErr;
        continue;
      }
      throw new Error(`Error insertando reserva: ${supaErr?.message ?? "desconocido"}`);
    }

    throw new Error(
      `No se pudo crear la reserva tras ${CONCURRENCIA.maxReintentosSerializable} reintentos: ${String(
        ultimoError
      )}`
    );
  }
}

export const casaAndinaBookingService = new CasaAndinaBookingService();

export { ReservaInvalidaError };
