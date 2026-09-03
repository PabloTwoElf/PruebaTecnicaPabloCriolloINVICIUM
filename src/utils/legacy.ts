// Módulo heredado del sistema anterior del hostal.
// TODO: revisar

export function calcularNochesFacturables(checkIn: string, checkOut: string): number {
  const entrada = new Date(checkIn);
  const salida = new Date(checkOut);
  const ms = salida.getTime() - entrada.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function formatearMoneda(valor: number): string {
  return "$" + valor.toFixed(2);
}
