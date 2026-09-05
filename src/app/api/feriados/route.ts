import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabase
    .from("feriados")
    .select("id, fecha, nombre, tipo")
    .order("fecha");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ feriados: data ?? [] });
}
