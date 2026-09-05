import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabase
    .from("habitaciones")
    .select("id, codigo, nombre, capacidad, activa")
    .order("codigo");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ habitaciones: data ?? [] });
}
