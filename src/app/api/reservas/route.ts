import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import {
  casaAndinaBookingService,
  ReservaSolapadaError,
} from "@/lib/services/CasaAndinaBookingService";
import { ReservaInvalidaError } from "@/lib/validators/reservaValidator";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado") ?? "confirmada";

  let query = supabase
    .from("reservas")
    .select(
      "id, habitacion_id, huesped_id, check_in, check_out, personas, precio_total, estado, creado_en, habitaciones(codigo, nombre), huespedes(nombre, cedula)"
    )
    .order("check_in", { ascending: true });

  if (estado !== "all") {
    query = query.eq("estado", estado);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reservas: data ?? [] });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "BODY_INVALIDO", mensaje: "Body no es JSON válido" },
      { status: 400 }
    );
  }

  const payload = normalizarPayload(body);

  try {
    const resultado = await casaAndinaBookingService.crearReserva(payload);
    return NextResponse.json({ success: true, ...resultado }, { status: 201 });
  } catch (err) {
    if (err instanceof ReservaInvalidaError) {
      return NextResponse.json(
        { success: false, error: err.codigo, mensaje: err.message },
        { status: 400 }
      );
    }
    if (err instanceof ReservaSolapadaError) {
      return NextResponse.json(
        { success: false, error: "RESERVA_SOLAPADA", mensaje: err.message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "INTERNAL", mensaje: (err as Error).message },
      { status: 500 }
    );
  }
}

function normalizarPayload(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    nombre: String(b.nombre ?? "").trim(),
    cedula: String(b.cedula ?? "").trim(),
    habitacionId: Number(b.habitacionId ?? b.habitacion_id ?? 0),
    checkIn: String(b.checkIn ?? b.check_in ?? ""),
    checkOut: String(b.checkOut ?? b.check_out ?? ""),
    personas: Number(b.personas ?? 1),
  };
}
