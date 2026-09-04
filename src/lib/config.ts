export const BUILD_TAG = "ORQ-9182";

export const HOSTAL = {
  nombre: "Hostal Casa Andina",
  ciudad: "Quito",
  zonaHoraria: "America/Guayaquil",
  moneda: "USD",
} as const;

export const TARIFAS = {
  temporadaBaja: 25,
  temporadaAlta: 40,
  descuentoEstadiaLarga: 0.1,
  nochesParaDescuento: 7,
} as const;

export const TEMPORADA_ALTA_FIJA = {
  inicioMes: 12,
  inicioDia: 15,
  finMes: 1,
  finDia: 15,
} as const;

export const CONCURRENCIA = {
  maxReintentosSerializable: 3,
} as const;

export const PG_ERROR = {
  EXCLUSION_VIOLATION: "23P01",
  SERIALIZATION_FAILURE: "40001",
} as const;
