const COEFICIENTES = [2, 1, 2, 1, 2, 1, 2, 1, 2] as const;

export function validarCedula(cedula: string): boolean {
  const cedulaStr = String(cedula ?? "").trim();

  if (cedulaStr.length !== 10) return false;
  if (!/^\d+$/.test(cedulaStr)) return false;

  const provincia = parseInt(cedulaStr.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;

  const tercerDigito = parseInt(cedulaStr[2], 10);
  if (tercerDigito < 0 || tercerDigito > 5) return false;

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cedulaStr[i], 10) * COEFICIENTES[i];
    if (valor > 9) valor -= 9;
    suma += valor;
  }

  const decenaSuperior = Math.ceil(suma / 10) * 10;
  let digitoVerificador = decenaSuperior - suma;
  if (digitoVerificador === 10) digitoVerificador = 0;

  return digitoVerificador === parseInt(cedulaStr[9], 10);
}

export function provinciaDeCedula(cedula: string): number | null {
  const cedulaStr = String(cedula ?? "").trim();
  if (cedulaStr.length < 2 || !/^\d+/.test(cedulaStr)) return null;
  const provincia = parseInt(cedulaStr.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return null;
  return provincia;
}
