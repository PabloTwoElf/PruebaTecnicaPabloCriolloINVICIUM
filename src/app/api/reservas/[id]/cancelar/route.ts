import { NextRequest, NextResponse } from "next/server";
import {
  casaAndinaBookingService,
  ReservaNoEncontradaError,
  ReservaYaCanceladaError,
} from "@/lib/services/CasaAndinaBookingService";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { success: false, error: "ID_INVALIDO" },
      { status: 400 }
    );
  }

  try {
    await casaAndinaBookingService.cancelarReserva(id);
    return NextResponse.json({ success: true, reservaId: id, estado: "cancelada" });
  } catch (err) {
    if (err instanceof ReservaNoEncontradaError) {
      return NextResponse.json(
        { success: false, error: "NO_ENCONTRADA", mensaje: err.message },
        { status: 404 }
      );
    }
    if (err instanceof ReservaYaCanceladaError) {
      return NextResponse.json(
        { success: false, error: "YA_CANCELADA", mensaje: err.message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "INTERNAL", mensaje: (err as Error).message },
      { status: 500 }
    );
  }
}
