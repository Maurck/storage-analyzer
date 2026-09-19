# Beta de Windows: verificación interna

**Decisión de producto del 2026-09-19:** la participación externa está aplazada. No se recluta ni se realizan sesiones moderadas por ahora; no son requisito para cerrar H3 ni para avanzar en el roadmap. El protocolo vigente es la evaluación interna por tareas de §5.5 de [`ANALISIS_PRODUCTO.md`](../../ANALISIS_PRODUCTO.md).

Se conservan los materiales anteriores para no perder trabajo. Preparar una guía o un script no significa que la verificación se haya ejecutado. La evaluación interna permite comprobar calidad y correctitud, no demostrar demanda o satisfacción de usuarios externos.

| Documento                                                    | Para qué                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| [`instalacion-y-datos.md`](instalacion-y-datos.md)           | Cómo se construye y se instala la beta, qué guarda, dónde y qué pasa al actualizar o desinstalar. |
| [`guia-de-sesion.md`](guia-de-sesion.md)                     | Material externo diferido, sin ejecución ni convocatoria prevista.                                |
| [`registro-de-resultados.md`](registro-de-resultados.md)     | Plantilla histórica sin resultados; su antigua puerta de participantes ya no está vigente.        |
| [`crear-carpeta-de-prueba.ps1`](crear-carpeta-de-prueba.ps1) | Crea y elimina la carpeta de prueba de las tareas, sin datos personales.                          |

## Trabajo vigente

- Ejecutar la verificación interna del instalador: [`verify-install.ps1`](../../modules/frontend/scripts/verify-install.ps1). Para un entorno limpio y sin red, usar [`start-sandbox.ps1`](../../modules/frontend/scripts/sandbox/start-sandbox.ps1) o una VM equivalente autorizada.
- Registrar entorno, versión, fixture, pasos, esperado/obtenido y evidencia; distinguir aprobado, fallido, no ejecutado y no soportado.
- Revisar manualmente teclado, lector de pantalla y alto contraste de Windows. No sustituir esa revisión por resultados de axe.
- Aplicar los casos T1–T12 de §5.5 a medida que se implementa cada incremento, no exigir casos de funcionalidades futuras para cerrar el actual.

Siguen pendientes las verificaciones de máquina limpia/offline, cuenta estándar real y accesibilidad manual recogidas en el análisis de producto. Windows 10 sigue sin evidencia de ejecución; la firma es una condición de distribución pública. La ausencia de sesiones externas no bloquea el desarrollo interno ni autoriza dar esas pruebas técnicas por realizadas.
