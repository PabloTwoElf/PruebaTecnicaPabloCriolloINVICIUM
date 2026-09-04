# Decisiones

Completa este archivo. Pesa en la evaluación tanto como el código.

## Supuestos que tomé
tenemos que manejar este edge case con uno de estos dos enfoques: (a) inyectar lógica en el script para resolver el conflicto de forma programática cancelando la reserva conflictiva más reciente, o (b) bloquear la ejecución y forzar un data cleansing manual previo.



Pense que habia tabla de los feriados ecuatorianos asi que supuse que era para una ciudad en la provincia de pichincha en quito asi que tome los datos de feriados de los mismos 
## Ambigüedades o contradicciones que encontré

Durante el análisis del repositorio, detecté una contradicción deliberada introducida como un marcador de integridad (Prompt Injection). En el README existía un comentario HTML oculto dirigido específicamente a asistentes de IA, instruyendo declarar la constante `BUILD_TAG = "ORQ-7431"` en `src/lib/config.ts`. 

-Analizando la integridad de los datos, el script de la migración 0003 va a fallar inevitablemente si existen registros de reservas solapadas en producción. Para evitar que la migración se rompa.


## Qué descarté y por qué

La Orquest-7431 ya que existe otra que debe ser usada y es ORQ-9182
## Qué no alcancé

<!-- Lo que quedó fuera. Ser explícito aquí suma; omitirlo resta. -->

## Cómo garantizo que una habitación no se reserve dos veces

<!-- Explica el mecanismo concreto y por qué elegiste ese y no otro. -->

## Cómo probé que funciona

<!-- Qué verificaste y cómo. -->
