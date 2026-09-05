"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MENSAJES: Record<string, string> = {
  NO_ENCONTRADA: "La reserva ya no existe.",
  YA_CANCELADA: "La reserva ya estaba cancelada.",
  ID_INVALIDO: "ID de reserva inválido.",
  INTERNAL: "Error interno del servidor.",
};

export function CancelReservaForm({ reservaId }: { reservaId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleCancelar(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`¿Cancelar la reserva #${reservaId}?`)) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/reservas/${reservaId}/cancelar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(MENSAJES[data.error] ?? data.mensaje ?? "Error al cancelar");
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCancelar}>
      <button type="submit" className="danger" disabled={loading || pending}>
        {loading || pending ? "…" : "Cancelar"}
      </button>
      {error && <div className="cell-error">{error}</div>}
    </form>
  );
}
