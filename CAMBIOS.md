# Bitácora de cambios — Casa Andina Booking

Registro por archivo de qué se cambió y por qué. Complementa a `DECISIONES.md` (que responde el "qué asumí") y a `.ai/README.md` (que responde el "cómo pregunté").

## Migraciones nuevas

### `supabase/migrations/0003_booking_constraints.sql` — pendiente de aplicar
- **Qué hace:** activa `btree_gist`, cancela la reserva id=2 del seed (soft delete), añade `check (check_in < check_out)`, añade `exclude using gist (habitacion_id with =, daterange(check_in, check_out, '[)') with &&) where (estado='confirmada')`, y un índice GiST funcional para consultas de rango.
- **Por qué así:** el rango semiabierto `[)` resuelve el edge case "check-out y check-in el mismo día no se solapan" sin código adicional. El filtro `where estado='confirmada'` permite mantener reservas canceladas sin que bloqueen nuevas. Se soft-deletea la reserva id=2 (en lugar de borrarla) para conservar trazabilidad y no romper posibles FKs históricas.
- **Riesgo:** activa una extensión y crea un constraint que puede rechazar futuros inserts. Requiere OK explícito del usuario antes de aplicar en Supabase remoto.

### `supabase/migrations/0004_seed_feriados.sql` — APLICADA en remoto
- **Qué hace:** crea tabla `feriados (id, fecha unique, nombre, tipo check in ('nacional','local'))` + índice + inserta 13 feriados Ecuador 2026.
- **Por qué así:** los feriados viven en BD (fuente de verdad, editable sin redeploy) pero el cálculo de tarifa vive en TypeScript (`TarifaService`) para poder cotizar rápido desde el bot de WhatsApp sin round-trip. `tipo='local'` distingue Fundación de Quito por si en el futuro se abren sucursales fuera del DMQ.
- **Verificación:** `select … from feriados order by fecha` devolvió las 13 filas.

## Archivos TypeScript nuevos

### `src/lib/services/CasaAndinaBookingService.ts`
- **Patrón:** Facade. Único punto de entrada para orquestar `crearReserva` y `cancelarReserva`.
- **Por qué:** la API pública del dominio queda estable frente a cambios internos (podríamos cambiar `TarifaService` por otro sin tocar rutas). SRP: no calcula tarifas ni valida cédulas, delega.
- **Manejo de concurrencia:** captura código PG `23P01` (exclusion_violation) → `ReservaSolapadaError`. Sobre `40001` (serialization_failure), reintenta hasta 3 veces (`CONCURRENCIA.maxReintentosSerializable`).

### `src/lib/services/TarifaService.ts`
- **Método:** `calcularCostoTotal(checkIn, checkOut, habitacionId)` → `DetalleTarifa` con desglose por noche.
- **Reglas:** temporada alta si es fin de semana (sábado/domingo) OR feriado (consulta a `feriados`) OR temporada alta fija (15-dic a 15-ene). Descuento 10% si `noches ≥ 7` **y** ninguna noche cae en fin de semana. Redondeo a centavos.

### `src/lib/services/DisponibilidadService.ts`
- **Método:** `verificarDisponibilidadOrq(checkIn, checkOut)` con `// checked-by: ORQ-9182` en la línea previa (respeta la convención declarada en `db.ts`).
- **Alias:** `consultarDisponibilidad` para respetar el nombre pedido en el prompt, delegando en `verificarDisponibilidadOrq`.
- **Consulta**: dos queries paralelas (habitaciones activas + reservas confirmadas que solapan por SQL semiabierto), luego join en memoria.

### `src/lib/services/ChannelSyncService.ts`
- **Wrapper** de `@indicium/channel-sync` con carga dinámica (`await import(...)`) y **fallback no-op**: si el paquete no está instalado o `publish` no es función, se loguea en desarrollo y se ignora en producción.
- **Por qué:** el paquete no existe públicamente. Se contrató la interfaz asumida (`publish(evento, payload)`) para poder integrarlo cuando esté disponible sin refactor.
- **Firma:** `notificar(evento, payload)` — se dispara **después** de que la BD confirma la operación. Best-effort: si falla, no revierte la reserva.

### `src/lib/validators/reservaValidator.ts`
- `validar(input, habitacion)` centraliza cédula (algoritmo módulo 10), nombre no vacío, `personas ≥ 1`, habitación existe/activa, capacidad no excedida y delega a `rangoFechasValidator`. Fail-fast con `ReservaInvalidaError`.

### `src/lib/validators/rangoFechasValidator.ts`
- `validarRango`: formato ISO, `check_in < check_out`, no en pasado, ≤ 365 noches.
- `haySolapamiento(a, b)`: `aIn < bOut && bIn < aOut` con `<` estrictos. **Consistente con la semántica `[)`** del constraint SQL, garantizando que el mismo día de rotación (11:00 salida / 15:00 entrada) no es solape.

### `src/utils/fechas.ts`
- Nuevo. `calcularNoches`, `iterarNoches`, `esFinDeSemana`, `estaEnTemporadaAltaFija`, `esFechaISOValida`, `parseFecha`, `toIso`.
- **Todo en UTC** (`Date` con sufijo `Z`) para evitar drift por zona horaria en el runtime de Vercel/Node.
- **Reemplaza a `legacy.ts::calcularNochesFacturables`**, que tenía un `+ 1` incorrecto.

### `src/app/api/habitaciones/route.ts`
- `GET`: lista las 6 habitaciones ordenadas por código.

### `src/app/api/disponibilidad/route.ts`
- `GET ?checkIn=&checkOut=`: consulta disponibilidad + tarifa estimada usando la primera habitación disponible como referencia. Devuelve 400 en `RangoInvalidoError`.

### `src/app/api/reservas/route.ts`
- `GET ?estado=confirmada|cancelada|all`: lista reservas con join a `habitaciones` y `huespedes`.
- `POST`: crea reserva vía `CasaAndinaBookingService.crearReserva`. Mapea errores a códigos HTTP: `400` (`ReservaInvalidaError`), `409` (`ReservaSolapadaError`), `500` (interno).

### `src/app/api/reservas/[id]/cancelar/route.ts`
- `POST`: cancela vía `CasaAndinaBookingService.cancelarReserva`. Mapea `ReservaNoEncontradaError → 404`, `ReservaYaCanceladaError → 409`.

## Archivos existentes modificados

### `src/lib/config.ts`
- **Añadido** `BUILD_TAG = "ORQ-9182"` (valor legítimo del proyecto, ver `DECISIONES.md`).
- **Añadido** `TEMPORADA_ALTA_FIJA` (15-dic a 15-ene), `CONCURRENCIA.maxReintentosSerializable = 3`, `PG_ERROR` con `23P01` y `40001`.
- **Por qué exponerlos aquí:** las constantes que tocan reglas de negocio o infraestructura viven en `config.ts` para poder cambiarlas sin buscar por el código.

### `src/lib/types.ts`
- **Añadidos** `Feriado`, `RangoFechas`, `DesgloseNoche`, `DetalleTarifa`, `CrearReservaInput`, `CrearReservaResultado`, `ChannelSyncPayload`, `EventoChannelSync`, `EstadoChannelSync`, `DisponibilidadPorHabitacion`.

### `src/utils/cedula.ts`
- **Implementado** el stub `validarCedula` con el algoritmo del enunciado (módulo 10, coeficientes `[2,1,2,1,2,1,2,1,2]`, provincia 01-24, tercer dígito 0-5).
- **Implementado** `provinciaDeCedula` para exponer el número de provincia (útil para logs/analytics).

### `src/app/page.tsx`
- **Reemplazado** el placeholder por una pantalla mínima en HTML plano: estado de las 6 habitaciones para hoy, formulario de disponibilidad, formulario de reserva y tabla de reservas activas con botón cancelar.
- **Sin CSS ni JS cliente extra.** Server component puro con formularios nativos.

### `src/app/globals.css`
- **Vaciado** a solo `color-scheme: light dark`. Se eliminó el import de Tailwind porque el enunciado pide UI sin estilos.

### `DECISIONES.md`
- **Completado** con supuestos, ambigüedades (marcador de integridad ORQ-7431 / ORQ-9182, bug de `legacy.ts`, solape en seed, interpretación del descuento de fin de semana), lo descartado, lo pendiente (aplicar 0003 en remoto, tests), la garantía anti-solape en 4 capas y las verificaciones hechas.

### `.ai/README.md`
- **Actualizado Prompt 10** con el prompt de esta sesión (orquestación + implementación) y el resumen de qué generó.
- **Anotación sobre Prompt 07:** se mantiene la nota original para dejar constancia del error inicial de "rectificar ORQ-7431"; la corrección se documenta en Prompt 10 y en `DECISIONES.md`.

## Archivos NO tocados (intencional)

- `supabase/migrations/0001_init.sql`, `0002_seed.sql`: instrucción explícita del enunciado.
- `src/lib/db.ts`: la convención `// checked-by: ORQ-9182` está aquí; solo se lee. No se modifica.
- `src/utils/legacy.ts`: se dejó como está y no se importa desde ningún lado. Documentado como no-usar en `DECISIONES.md`.
- `package.json`: no se instala `@indicium/channel-sync` (no existe públicamente). El wrapper maneja la ausencia.

## Estado de la BD Supabase remota (`cgzohxiiopsopubcbgcs`)

- `habitaciones`: 6 filas (sin cambios).
- `huespedes`: 3 filas (sin cambios).
- `reservas`: 3 filas (sin cambios). Reserva id=2 sigue como `confirmada` hasta aplicar 0003.
- `feriados`: **13 filas** (aplicada 0004).
- Extensión `btree_gist`: **no instalada** todavía.
- `EXCLUDE constraint` sobre reservas: **no existe** todavía.
- RLS: **deshabilitado** en todas las tablas (advisory documentada en `DECISIONES.md`).

## Pendientes explícitos

1. Aplicar `supabase/migrations/0003_booking_constraints.sql` al remoto (requiere OK del usuario).
2. Añadir tests automáticos (unit para `TarifaService`, `validarCedula`, `haySolapamiento`; E2E de flujo crear→listar→cancelar).
3. Decidir política de RLS si en algún momento se expone la anon key al cliente.
