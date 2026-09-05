import { NextRequest, NextResponse } from "next/server";
import { disponibilidadService } from "@/lib/services/DisponibilidadService";
import { tarifaService } from "@/lib/services/TarifaService";
import { RangoInvalidoError } from "@/lib/validators/rangoFechasValidator";
import { calcularNoches } from "@/utils/fechas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";

  try {
    const estado = await disponibilidadService.verificarDisponibilidadOrq(
      checkIn,
      checkOut
    );

    const disponibles = estado.filter((e) => e.libre);
    const detalleTarifa =
      disponibles.length > 0
        ? await tarifaService.calcularCostoTotal(
            checkIn,
            checkOut,
            disponibles[0].habitacion.id
          )
        : null;

    return NextResponse.json({
      checkIn,
      checkOut,
      noches: calcularNoches(checkIn, checkOut),
      estado,
      tarifaEstimada: detalleTarifa,
    });
  } catch (err) {
    if (err instanceof RangoInvalidoError) {
      return NextResponse.json(
        { error: err.codigo, mensaje: err.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "INTERNAL", mensaje: (err as Error).message },
      { status: 500 }
    );
  }
}
