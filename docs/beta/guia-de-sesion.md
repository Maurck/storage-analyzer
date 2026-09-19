# Guía de sesión moderada

> **Diferida desde el 2026-09-19.** Se conserva como material histórico; no reclutar participantes ni ejecutar este protocolo por ahora. No es un requisito de H3 ni de los hitos posteriores. La evaluación vigente es interna y está definida en §5.5 de [`ANALISIS_PRODUCTO.md`](../../ANALISIS_PRODUCTO.md). Cualquier reactivación requiere una decisión posterior explícita.

**Objetivo:** comprobar si alguien sin entorno de desarrollo puede instalar la beta, analizar una carpeta, encontrar el archivo más grande y mostrarlo en el Explorador **sin ayuda**, y si entiende qué significan las cifras.

**Participantes:** 5 a 8 personas del segmento inicial **[Suposición]**: usan Windows a diario, no programan y alguna vez se quedaron sin espacio. Son pocas para medir porcentajes: sirven para descubrir fricciones.

**Duración:** 30–40 minutos. Una persona modera y, si es posible, otra toma notas.

## Antes de la sesión

1. Equipo Windows 10/11 x64 **sin** Node, Java ni Maven. Si es un equipo de pruebas, instalar la versión anterior de la beta no es necesario.
2. Copiar el instalador a la carpeta Descargas (o descargarlo, si se quiere observar el aviso de SmartScreen).
3. Crear la carpeta de prueba: `.\crear-carpeta-de-prueba.ps1 -ConOmitidos`. Contiene un archivo de 700 MB a seis niveles de profundidad (`render-final.mov`), dos vídeos con el mismo nombre en carpetas distintas y una carpeta sin permiso de lectura.
4. Dejar abierta la plantilla de [`registro-de-resultados.md`](registro-de-resultados.md) y un cronómetro.
5. No usar carpetas personales del participante en ningún momento.

## Consentimiento (leer)

> Vamos a probar una aplicación, no a ti. Si algo no te sale, es un problema de la aplicación y nos sirve saberlo. Te pediré que pienses en voz alta. Anotaré lo que hagas y cuánto tardas, pero no tu nombre, rutas de tu equipo ni el contenido de tus archivos. Puedes parar cuando quieras. ¿Te parece bien?

Registrar solo «sí» o «no». Si la respuesta es «no», no hacer la sesión.

## Tareas

Leer cada tarea tal cual, sin nombrar botones ni menús. No ayudar salvo que la persona lleve dos minutos bloqueada o lo pida por segunda vez; si se ayuda, anotarlo como «con ayuda».

| #   | Tarea (se lee en voz alta)                                                             | Se completa cuando                                          | Qué observar                                                                                                                                |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | «Instala la aplicación que está en Descargas y ábrela.»                                | La ventana muestra que se puede elegir una carpeta.         | Dudas con el aviso de Windows, con la carpeta de instalación, cuánto tarda en estar lista y qué entiende del mensaje «Preparando el motor». |
| T2  | «Averigua cuánto ocupa la carpeta "Storage Analyzer - prueba" que está en Documentos.» | Dice el total en voz alta.                                  | Cómo elige la carpeta; si entiende el progreso.                                                                                             |
| T3  | «Encuentra el archivo que más espacio ocupa dentro de esa carpeta.»                    | Nombra `render-final.mov`. Tiempo desde que hay resultados. | Si usa «Archivos más grandes» o recorre el árbol nivel por nivel.                                                                           |
| T4  | «Muéstrame dónde está ese archivo en tu equipo.»                                       | Se abre el Explorador con el archivo seleccionado.          | Si encuentra «Mostrar en el Explorador» y si usa el ratón o el teclado.                                                                     |
| T5  | «Hay dos archivos que se llaman igual. ¿Cómo sabes cuál es cuál?»                      | Explica la diferencia por ubicación.                        | Si lee la columna de ubicación.                                                                                                             |
| T6  | «La aplicación dice que algo no se pudo leer. ¿Qué significa para el total?»           | Explica que falta algo y que el total es un mínimo.         | Si abre «Ver elementos omitidos» y qué entiende.                                                                                            |
| T7  | «Si borraras ese archivo de 700 MB, ¿cuánto espacio crees que recuperarías?»           | Su respuesta, sea la que sea.                               | Comprensión del tamaño lógico frente al espacio en disco.                                                                                   |
| T8  | «Cierra la aplicación y desinstálala.»                                                 | Desaparece de «Aplicaciones instaladas».                    | Dudas; si cree que quedan datos.                                                                                                            |

## Preguntas finales

1. ¿Qué te resultó más difícil?
2. Con tus palabras, ¿qué es el «tamaño» que muestra la aplicación?
3. ¿En qué situación real la usarías? ¿Qué harías después de encontrar un archivo grande?
4. ¿Volverías a usarla? ¿Para qué? (pedir un ejemplo concreto; no preguntar «¿te gustó?»).
5. ¿Esperabas poder hacer algo que no pudiste?

## Qué no hacer

- No explicar la interfaz antes de las tareas ni corregir malentendidos durante ellas: anotarlos.
- No usar ni fotografiar datos del equipo del participante.
- No inventar ni redondear resultados. Un fallo de instalación también es un resultado.

## Al terminar

1. `.\crear-carpeta-de-prueba.ps1 -Eliminar` (si el participante no desinstaló la app, desinstalarla con su permiso).
2. Completar el registro el mismo día.
3. Tras 5 sesiones, revisar la puerta de §5.5 de `ANALISIS_PRODUCTO.md` y decidir la siguiente iteración.
