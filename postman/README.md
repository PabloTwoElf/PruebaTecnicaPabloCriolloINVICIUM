# Postman — Casa Andina Booking

Colección lista para importar en Postman con **18 pruebas** que cubren los entregables del enunciado.

## Cómo importar

1. Abrir Postman → **Import** → elegir `CasaAndina.postman_collection.json`.
2. La colección trae variables preconfiguradas. La única que podrías necesitar cambiar es `base_url` (default: `http://localhost:3000`).
3. Levantar el servidor: `npm run dev` en la raíz del repo.

## Cómo ejecutar todo de un tirón

En Postman → **Runner** → arrastrar la colección → **Run Casa Andina Booking API**.
Los tests están en orden de dependencia (crean una reserva → cancelan esa misma reserva usando `{{reserva_creada_id}}`).

## Cobertura

| Carpeta | Endpoint | Escenario | HTTP esperado |
|---|---|---|---|
| 1. Sanity | `GET /api/habitaciones` | Devuelve las 6 habitaciones | 200 |
| 1. Sanity | `GET /api/feriados` | 13 feriados 2026 | 200 |
| 2. Disponibilidad | `GET /api/disponibilidad` | Rango válido (2 noches) | 200 |
| 2. Disponibilidad | `GET /api/disponibilidad` | Orden inválido `check_in > check_out` | 400 `ORDEN_FECHAS` |

| 2. Disponibilidad | `GET /api/disponibilidad` | Fecha en pasado | 400 `FECHA_EN_PASADO` |

| 2. Disponibilidad | `GET /api/disponibilidad` | Habitación ocupada por reserva seed | 200 con `libre:false` |

| 3. Validaciones | `POST /api/reservas` | Cédula inválida `1111111111` | 400 `CEDULA_INVALIDA` |


| 3. Validaciones | `POST /api/reservas` | Personas > capacidad | 400 `CAPACIDAD_EXCEDIDA` |
| 3. Validaciones | `POST /api/reservas` | `checkIn > checkOut` | 400 `ORDEN_FECHAS` |
| 3. Validaciones | `POST /api/reservas` | Habitación inexistente | 400 `HABITACION_INEXISTENTE` |
| 4. Happy path | `POST /api/reservas` | 2 noches temporada baja (mar-jue) | 201 · $50 |
| 4. Happy path | `POST /api/reservas` | 7 noches incluyendo sáb-dom → SIN descuento | 201 · $215 |
| 4. Happy path | `POST /api/reservas` | 2 noches Navidad (alta) | 201 · $80 |
| 4. Happy path | `POST /api/reservas` | Edge case check-out=check-in del otro (rotación mismo día) | 201 |
| 5. Anti-solape | `POST /api/reservas` | Solape con reserva id=1 hab 1 | 409 `RESERVA_SOLAPADA` |
| 5. Anti-solape | `POST /api/reservas` | Misma cédula, otra habitación | 201 |
| 6. Cancelación | `GET /api/reservas` | Lista con joins de habitación y huésped | 200 |
| 6. Cancelación | `POST /api/reservas/{id}/cancelar` | Cancela reserva recién creada | 200 |
| 6. Cancelación | `POST /api/reservas/{id}/cancelar` | Cancela dos veces (idempotencia) | 409 `YA_CANCELADA` |
| 6. Cancelación | `POST /api/reservas/{id}/cancelar` | Reserva inexistente | 404 `NO_ENCONTRADA` |
| 6. Cancelación | `POST /api/reservas/{id}/cancelar` | ID no numérico | 400 `ID_INVALIDO` |

## Cédulas válidas incluidas

- `1710034065` (Pichincha)
- `1712345675` (Pichincha)
- `1802345676` (Tungurahua)
- `0918765439` (Guayas)

## Alternativa: Swagger UI

Con el server corriendo, abrí `http://localhost:3000/docs` para ver el Swagger UI generado desde `public/openapi.yaml`. Ahí también podés lanzar los requests con **"Try it out"**.
