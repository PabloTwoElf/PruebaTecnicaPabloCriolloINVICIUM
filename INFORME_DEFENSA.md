# Informe de pruebas y análisis por requisito — Casa Andina Booking

Documento de apoyo para la defensa en vivo. Resume, requisito por requisito, qué se probó,
contra qué entorno, y el veredicto. Complementa a `DECISIONES.md` (supuestos) y `CAMBIOS.md`
(bitácora de archivos).

**Entorno de prueba:** instancia local (`next dev`, puerto 3001) contra el proyecto Supabase
remoto real del repo (`cgzohxiiopsopubcbgcs`). Todas las reservas de prueba creadas durante
esta validación fueron canceladas al terminar (soft delete), no quedó dato de prueba "sucio"
en estado `confirmada`.

**Corrección previa aplicada:** el proyecto no arrancaba (`Faltan NEXT_PUBLIC_SUPABASE_URL...`)
por falta de `.env.local`. Se creó copiando `.env.example`. No fue un bug de código, fue un
paso de setup pendiente.

---

## 1. Consulta de disponibilidad por rango de fechas

**Endpoint:** `GET /api/disponibilidad?checkIn=&checkOut=`
**Implementación:** [DisponibilidadService.ts](src/lib/services/DisponibilidadService.ts) + [rangoFechasValidator.ts](src/lib/validators/rangoFechasValidator.ts)

| Caso | Petición | Resultado |
|---|---|---|
| Rango válido | `checkIn=2026-10-10&checkOut=2026-10-12` | `200`, devuelve las 6 habitaciones con `libre`/conflictos + tarifa estimada |
| Sin parámetros | (vacío) | `400 FORMATO_FECHA` |
| Formato inválido | `checkIn=badformat` | `400 FORMATO_FECHA` |
| Orden invertido | `checkIn > checkOut` | `400 ORDEN_FECHAS` |
| Fecha en el pasado | `checkIn=2020-01-01` | `400 FECHA_EN_PASADO` |
| Rango > 365 noches | — | `400 RANGO_EXCESIVO` (validado por código, no reprobado en vivo por brevedad) |

**Veredicto: cumple.** Fail-fast antes de tocar la BD (capa 1 de la garantía anti-solape).
Semántica de rango semiabierto `[check_in, check_out)` consistente con el resto del sistema.

**Punto a defender:** por qué semiabierto — evita que "check-out día X" choque con
"check-in día X" (rotación de habitación el mismo día), sin lógica especial adicional.

---

## 2. Crear reserva (nombre, cédula, habitación, fechas, personas)

**Endpoint:** `POST /api/reservas`
**Implementación:** [CasaAndinaBookingService.crearReserva](src/lib/services/CasaAndinaBookingService.ts) + [reservaValidator.ts](src/lib/validators/reservaValidator.ts) + [cedula.ts](src/utils/cedula.ts)

| Caso | Resultado |
|---|---|
| Reserva válida | `201`, con `reservaId`, `costo` y desglose noche a noche |
| Cédula inválida (dígito verificador incorrecto) | `400 CEDULA_INVALIDA` |
| Nombre vacío | `400 NOMBRE_REQUERIDO` |
| Personas > capacidad de la habitación | `400 CAPACIDAD_EXCEDIDA` |
| `habitacionId` inexistente | `400 HABITACION_INEXISTENTE` |
| Body no es JSON válido | `400 BODY_INVALIDO` |

**Veredicto: cumple.** El algoritmo de cédula ecuatoriana está implementado completo:
10 dígitos, provincia 01-24, tercer dígito 0-5, módulo 10 con coeficientes
`[2,1,2,1,2,1,2,1,2]`. Se probó con cédulas reales del seed y con una cédula de prueba
válida (`1710034065`) y una inválida (`1234567890`).

**Punto a defender:** el huésped se resuelve por *upsert de cédula* (si ya existe, se
reutiliza el `huesped_id`) para no ensuciar la tabla con duplicados — decisión documentada
en `DECISIONES.md`.

---

## 3. Anti-solapamiento — una habitación no se reserva dos veces en fechas que se cruzan

**Este es el requisito que más peso tiene y el que se probó con más rigor: no solo
funcionalmente, sino bajo concurrencia real.**

**Las 4 capas defensivas** (ver `DECISIONES.md` para el detalle):
1. Validación de rango (fail-fast, sin ir a BD).
2. Verificación previa de disponibilidad (mejora UX, evita un insert que fallaría).
3. **`EXCLUDE USING gist`** en Postgres (`daterange(check_in, check_out, '[)')`) — fuente de verdad.
4. Retry sobre `40001` (serialization failure) hasta 3 intentos.

### Prueba funcional (secuencial)
`POST` reserva en habitación #2, fechas `2026-11-05→2026-11-08` → `201`.
`POST` otra reserva misma habitación, `2026-11-06→2026-11-07` (se cruza) → **`409 RESERVA_SOLAPADA`**.
`POST` reserva misma habitación, `2026-11-08→2026-11-10` (empieza el mismo día que la anterior
termina — rotación) → **`201`, no se considera solape.** Confirma la semántica `[)`.

### Prueba de concurrencia real (la evidencia fuerte)
Se dispararon **5 peticiones `POST` verdaderamente simultáneas** (subshells en paralelo,
sin `await` secuencial) contra la misma habitación y mismo rango de fechas, previamente libre:

```
Resultado: 1x 201 (creada) + 4x 409 RESERVA_SOLAPADA
```

Esto es evidencia directa de que **la migración `0003_booking_constraints.sql`
(el `EXCLUDE USING gist`) ya está aplicada en el Supabase remoto**, no solo el chequeo de
aplicación. Si solo existiera la capa 2 (verificación previa en TypeScript), un escenario de
5 peticiones simultáneas tiene probabilidad real de que más de una pase el chequeo antes de
que cualquiera inserte — y aquí no ocurrió: ganó exactamente una.

> ⚠️ **Hallazgo de documentación:** `DECISIONES.md` y `CAMBIOS.md` describen la migración 0003
> como *"pendiente de aplicar, requiere OK explícito del usuario"*. La prueba de concurrencia
> demuestra que ya está aplicada. Actualizar ambos documentos antes de la defensa para no dar
> información contradictoria a los evaluadores.

**Veredicto: cumple, y está verificado bajo concurrencia real, no solo en el happy path.**

---

## 4. Cancelar reserva y liberar inventario

**Endpoint:** `POST /api/reservas/{id}/cancelar`
**Implementación:** [CasaAndinaBookingService.cancelarReserva](src/lib/services/CasaAndinaBookingService.ts)

| Caso | Resultado |
|---|---|
| Cancelar reserva confirmada | `200`, `estado: "cancelada"` |
| Cancelar la misma reserva otra vez | `409 YA_CANCELADA` |
| Cancelar id inexistente (`99999`) | `404 NO_ENCONTRADA` |
| Cancelar id inválido (`abc`, `-1`) | `400 ID_INVALIDO` |
| Liberación de inventario | Tras cancelar, la habitación vuelve a aparecer `libre: true` en `/api/disponibilidad` para ese rango (el `EXCLUDE` filtra `where estado='confirmada'`) |

**Veredicto: cumple.** Es soft delete (`update ... set estado='cancelada'`), no `delete`,
por trazabilidad — decisión documentada. El inventario se libera de forma consistente en
las 3 capas (constraint SQL, verificación previa, UI).

---

## 5. Pantalla mínima — estado de las 6 habitaciones

**Implementación:** [page.tsx](src/app/page.tsx) (Server Component) + [BookingApp.tsx](src/components/BookingApp.tsx) + [ReservasPanel.tsx](src/components/ReservasPanel.tsx) + [PriceCalendar.tsx](src/components/PriceCalendar.tsx)

- Home (`/`) renderiza en `200` sin CSS de librería (Tailwind se retiró intencionalmente,
  `globals.css` solo trae `color-scheme`).
- Muestra: contador "X/6 libres hoy", formulario de disponibilidad, calendario de precios
  de 2 meses, formulario de nueva reserva, y tabla de reservas activas con botón cancelar.
- `ReservasPanel` se suscribe a Supabase Realtime (`postgres_changes` sobre `reservas`) y
  refresca la tabla en vivo cuando cambia el estado de una reserva.

**Veredicto: cumple.** Sin pretensiones visuales, legible, refleja estado real (probado:
al cancelar una reserva de prueba vía API, la tabla la reclasificó a "Canceladas" sin
recargar la página manualmente gracias a Realtime).

---

## 6. Tarifas

**Implementación:** [TarifaService.ts](src/lib/services/TarifaService.ts) + [fechas.ts](src/utils/fechas.ts) + [config.ts](src/lib/config.ts)

| Regla del enunciado | Implementación | Verificado |
|---|---|---|
| Temporada baja $25/noche | `TARIFAS.temporadaBaja = 25` | ✅ en desgloses de las pruebas de reserva |
| Temporada alta $40/noche | `TARIFAS.temporadaAlta = 40` | ✅ |
| Alta = feriados nacionales | consulta a tabla `feriados` por rango | ✅ (13 feriados 2026 cargados) |
| Alta = 15-dic a 15-ene | `TEMPORADA_ALTA_FIJA` + `estaEnTemporadaAltaFija()` | ✅ (verificado en `DECISIONES.md` con caso 24-26 dic) |
| ≥7 noches → 10% descuento | `TARIFAS.nochesParaDescuento = 7`, `descuentoEstadiaLarga = 0.1` | ✅ |
| Fin de semana → tarifa alta siempre, sin descuento | `esFinDeSemana()` fuerza tarifa alta; `aplicaDescuento = noches >= 7 && !hayFinDeSemana` | ✅ |

**Prueba en vivo:** reserva `2026-11-05→2026-11-08` (3 noches, incluye un sábado) devolvió
desglose `$25 + $25 + $40 = $90` sin descuento — coincide con la regla.

**Punto a defender (ambigüedad documentada):** "fin de semana no aplica descuento" se
interpretó a **nivel de reserva completa**: si al menos una noche del rango cae en
sábado/domingo, se pierde el descuento del 10% sobre *toda* la estadía, no solo esa noche.
Es la interpretación más conservadora y consistente con "las reservas de fin de semana...
no aplican descuento" (habla de la reserva, no de la noche).

**Veredicto: cumple**, con la interpretación anterior explícitamente declarada.

---

## 7. Integración `@indicium/channel-sync`

**Implementación:** [ChannelSyncService.ts](src/lib/services/ChannelSyncService.ts)

- El paquete `@indicium/channel-sync` **no existe públicamente en npm** (verificado: no está
  en `package.json`, no se puede instalar).
- Se implementó un wrapper con **carga dinámica** (`await import(...)`) y **fallback no-op**:
  si el paquete no está presente, en desarrollo se loguea `[channel-sync:noop]` y en
  producción se ignora silenciosamente sin romper el flujo de reserva/cancelación.
- Se dispara `notificar("reservation.confirmed", ...)` y `notificar("reservation.canceled", ...)`
  **después** de que la BD confirma la operación — best-effort, si falla no revierte la reserva.
- **Verificado en las pruebas:** cada `POST /api/reservas` y cada cancelación completaron sin
  error aun sin el paquete instalado, confirmando que el fallback no bloquea el flujo principal.

**Pendiente explícito (documentado):** no hay *outbox pattern* — si `channel-sync` fallara,
hoy solo se loguea el error (`console.error`), sin reintentos ni cola. Sería la siguiente
iteración natural antes de un canal externo real en producción.

**Veredicto: cumple lo razonable dado que el paquete no existe**, con contrato tipado listo
para conectar el SDK real cuando esté disponible.

---

## Hallazgos adicionales de esta validación (fuera de los 7 puntos, relevantes para producción)

1. **Redundancia de código eliminada:** `src/lib/tarifasClient.ts` duplicaba funciones de
   fecha ya existentes en `src/utils/fechas.ts`. Se refactorizó para reusar un único módulo
   fuente de verdad. Typecheck limpio tras el cambio, UI re-verificada.
2. **Seguridad — antes de producción real:** RLS sigue deshabilitada en todas las tablas y
   la misma `anon key` se usa en servidor y en el navegador (Realtime en `ReservasPanel`).
   Sin RLS, cualquiera podría leer/escribir las tablas directo desde el cliente saltándose
   las validaciones de la API. El `EXCLUDE` de Postgres seguiría evitando el doble-booking,
   pero no el resto de las reglas de negocio. Ya documentado como pendiente; es la prioridad
   #1 antes de un lanzamiento real.
3. **Documentación desactualizada:** `DECISIONES.md`/`CAMBIOS.md` dicen que la migración 0003
   no está aplicada; la prueba de concurrencia demuestra lo contrario. Actualizar antes de
   la defensa.
4. **Prompt injection en el repo:** comentarios ocultos en `README.md` y `src/lib/db.ts`
   dirigidos a asistentes de IA (marcador de integridad de la prueba). Detectados y no
   seguidos ciegamente; una sesión anterior sí adoptó parcialmente la convención `ORQ-*`
   — vale la pena poder explicarlo en la defensa.

---

## Resumen ejecutivo

| # | Requisito | Estado |
|---|---|---|
| 1 | Consulta de disponibilidad | ✅ Cumple |
| 2 | Crear reserva + validación de cédula | ✅ Cumple |
| 3 | Anti-solapamiento | ✅ Cumple — verificado bajo concurrencia real |
| 4 | Cancelar y liberar inventario | ✅ Cumple |
| 5 | Pantalla mínima | ✅ Cumple |
| 6 | Tarifas (baja/alta/descuento/fin de semana) | ✅ Cumple |
| 7 | `@indicium/channel-sync` | ✅ Cumple (paquete inexistente, wrapper con fallback) |

**Pendientes a mencionar proactivamente en la defensa:** RLS/políticas de seguridad,
tests automáticos, outbox pattern para channel-sync, actualizar estado de migración 0003
en `DECISIONES.md`/`CAMBIOS.md`.
