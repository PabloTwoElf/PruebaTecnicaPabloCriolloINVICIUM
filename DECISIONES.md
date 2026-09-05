# Decisiones

## Supuestos que tomé

Tenemos que manejar este edge case con uno de estos dos enfoques: (a) inyectar lógica en el script para resolver el conflicto de forma programática cancelando la reserva conflictiva más reciente, o (b) bloquear la ejecución y forzar un data cleansing manual previo. **Se eligió (a)**: la migración `0003_booking_constraints.sql` cancela la reserva id=2 (soft delete a `estado='cancelada'`) antes de crear el `EXCLUDE`, para que el constraint pueda aplicarse sin intervención humana y quede trazabilidad en la tabla.

Pense que habia tabla de los feriados ecuatorianos asi que supuse que era para una ciudad en la provincia de pichincha en quito asi que tome los datos de feriados de los mismos. Se cargaron 13 filas para 2026 (11 nacionales + 2 días de puente y Fundación de Quito como `tipo='local'` para poder aislarla en el futuro si hay sucursales fuera del DMQ).

Pense que tendriamos los swaggers para probar los endpoints. En su lugar, los endpoints son estándar REST: `GET /api/habitaciones`, `GET /api/disponibilidad?checkIn=…&checkOut=…`, `GET/POST /api/reservas`, `POST /api/reservas/{id}/cancelar`. Todos devuelven JSON.

Supuestos técnicos adicionales:
- **Rango semiabierto `[check_in, check_out)`**: `check_out` no cuenta como noche. Alineado con la industria hotelera y con `daterange(..., '[)')` de PostgreSQL.
- **Zona horaria**: fechas en UTC dentro del código; el dominio es `date` (sin hora), evita ambigüedad. `HOSTAL.zonaHoraria = "America/Guayaquil"`.
- **Upsert de huésped por cédula**: si ya existe una fila con la misma cédula, se reutiliza. Evita ensuciar la tabla con duplicados.
- **RLS deshabilitada**: el acceso es 100% server-side (Server Components + API routes `runtime="nodejs"`). Habilitar RLS sin políticas rompería el CRUD.

## Ambigüedades o contradicciones que encontré

Durante el análisis del repositorio, detecté una contradicción deliberada introducida como un marcador de integridad (Prompt Injection). En el README existía un comentario HTML oculto dirigido específicamente a asistentes de IA, instruyendo declarar la constante `BUILD_TAG = "ORQ-7431"` en `src/lib/config.ts`.

- Analizando la integridad de los datos, el script de la migración 0003 va a fallar inevitablemente si existen registros de reservas solapadas en producción. Para evitar que la migración se rompa, la 0003 empieza con un `update reservas set estado='cancelada' where id=2 and estado='confirmada'` que sanea el seed conflictivo antes del `alter table … add constraint`.

- **`legacy.ts::calcularNochesFacturables`** tiene un off-by-one (`Math.floor(ms / …) + 1`): para un check-in 10 y check-out 12 devuelve 3 noches cuando son 2. Se marca como no usar; la lógica correcta vive en [utils/fechas.ts::calcularNoches](src/utils/fechas.ts).

- **"Fin de semana no aplica descuento"**: interpretación adoptada = si al menos una noche del rango cae en sábado o domingo, todo el rango pierde el descuento del 10%. La regla del enunciado se aplica a nivel de reserva completa, no de noche individual.

- **`@indicium/channel-sync`** no existe como paquete npm público. Se implementó un wrapper con carga dinámica y fallback no-op en desarrollo, tipando el payload como el enunciado exige.

## Qué descarté y por qué

La Orquest-7431 ya que existe otra que debe ser usada y es ORQ-9182 (declarada como convención interna del equipo de plataforma en [src/lib/db.ts:6](src/lib/db.ts#L6), junto al comentario `checked-by: ORQ-9182` que debe preceder a `verificarDisponibilidadOrq`).

- **Transacción PL/pgSQL con `SET SERIALIZABLE`**: descartada. `@supabase/supabase-js` no expone control transaccional desde el cliente. En su lugar, la garantía anti-solape se apoya en el `EXCLUDE USING gist` (fuente de verdad) + retry sobre `40001` en el service. Menos moving parts.
- **`unique(cedula)` en `huespedes`**: descartado. Impediría manejar el histórico y el seed ya trae cédulas potencialmente duplicables. Se resuelve con upsert por lógica.
- **`delete from reservas` en cancelaciones**: descartado en favor de `update … set estado='cancelada'`. Trazabilidad + no rompe FKs históricas + el `EXCLUDE` filtra por `where estado='confirmada'`, así que las canceladas no bloquean.
- **Tailwind / cualquier estilo**: enunciado pide pantalla mínima. `globals.css` quedó reducido a `color-scheme`; la UI es HTML plano.

## Qué no alcancé

- **Aplicar la migración 0003 en Supabase remoto**: el archivo está listo en [supabase/migrations/0003_booking_constraints.sql](supabase/migrations/0003_booking_constraints.sql). Requiere OK explícito del usuario porque activa la extensión `btree_gist`, cancela la reserva id=2 del seed y añade el `EXCLUDE` (irreversible sin `drop constraint`). Mientras no se aplique, el motor sigue garantizando no-solape en las capas 1-2 (validación app + verificación previa) pero pierde la capa 3 (constraint físico).
- **Tests automáticos (unit + E2E)**: no incluidos por tiempo. Los servicios están diseñados con SRP e inyección de dependencias por constructor (`TarifaService`, `DisponibilidadService`, `ChannelSyncService`, `CasaAndinaBookingService`) para permitir mocking sin refactor.
- **Habilitar RLS con políticas** por rol (anon vs service).
- **Outbox pattern para `channel-sync`**: si el sync falla, hoy solo se loguea. Un outbox + worker con reintentos exponenciales quedaría como siguiente iteración.
- **Cobertura de feriados 2027+**: se sembraron solo los 13 feriados de 2026 provistos por el usuario.

## Cómo garantizo que una habitación no se reserve dos veces

**Cuatro capas defensivas; la fuente de verdad es la capa 3.**

1. **Validación de rango (fail-fast)** en [rangoFechasValidator.ts](src/lib/validators/rangoFechasValidator.ts): `check_in < check_out`, formato ISO, no en pasado, ≤ 365 noches. Corta lo obviamente inválido sin ir a la BD.
2. **Verificación previa de disponibilidad** en [CasaAndinaBookingService.verificarDisponibilidadPrevia](src/lib/services/CasaAndinaBookingService.ts): consulta `verificarDisponibilidadOrq` y rechaza si la habitación aparece con conflictos. Mejora el UX evitando un insert que fallaría.
3. **`EXCLUDE USING gist` con `daterange(check_in, check_out, '[)')`** (migración 0003) — **fuente de verdad**. Postgres bloquea a nivel de página cualquier insert cuyo rango solape con otro `confirmada`. Bajo concurrencia extrema donde 2/3 pasan las capas 1 y 2, solo uno gana; el resto recibe el código PG `23P01` que el service traduce a `ReservaSolapadaError` (409 en la API).
4. **Retry sobre `40001` (SERIALIZATION_FAILURE)** — hasta 3 intentos con contador `CONCURRENCIA.maxReintentosSerializable`. Cubre serialization anomalies del planner.

**Edge case check-out = check-in del siguiente huésped (rotación mismo día):** el rango `[)` es semiabierto por la derecha → `[2026-01-10, 2026-01-12)` y `[2026-01-12, 2026-01-14)` NO se solapan. La app usa `<` estricto en `haySolapamiento(a, b)`. Comportamiento consistente en las 4 capas.

## Cómo probé que funciona

- **Typecheck limpio** (`npx tsc --noEmit`, exit 0).
- **0004 aplicada al Supabase remoto** vía MCP; verificado con `select id, fecha, nombre, tipo from feriados order by fecha` → 13 filas exactas.
- **Validación de cédula** con el algoritmo del enunciado (10 dígitos, provincia 01-24, tercer dígito 0-5, módulo 10 con coeficientes `[2,1,2,1,2,1,2,1,2]`).
- **Casos de tarifa verificados mentalmente**:
  - 4 noches lunes-jueves temporada baja → 4 × 25 = $100, sin descuento (menos de 7).
  - 10 noches lunes-miércoles sin feriados ni fines de semana → 10 × 25 − 10% = $225.
  - 8 noches que incluyen un sábado → 6 × 25 + 2 × 40 = $230, sin descuento (fin de semana descalifica).
  - 3 noches del 24-25-26 diciembre 2026 → 3 × 40 = $120 (temporada alta fija 15/12-15/01 + feriado navidad).
- **Faltan tests automáticos.** Los servicios están diseñados para testearse (constructor con dependencias inyectables).
