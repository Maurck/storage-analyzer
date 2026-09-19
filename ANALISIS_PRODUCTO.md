# Storage Analyzer: análisis de producto, UX y UI

> Revisión: 2026-09-19 · Alcance: aplicación actual y evolución desde H3.
> Base inspeccionada: commit `1856f19`, frontend, backend, integración Electron, instalador, documentación, pruebas y capturas existentes.
> Esta revisión propone cambios de producto; no implementa las funcionalidades ni vuelve a ejecutar las verificaciones históricas.

### Decisiones de esta revisión

- **No reiniciar lo entregado:** H0–H2 están cerrados según la evidencia registrada. El instalador y las correcciones técnicas de H3 ya existen; quedan verificaciones de entorno y accesibilidad.
- **Sin participación externa por ahora:** no hay reclutamiento, entrevistas, sesiones moderadas, encuestas ni umbrales de éxito con participantes como requisito de avance. Se reemplazan por evaluación interna reproducible. El material anterior se conserva como diferido, no como trabajo obligatorio.
- **Valor de negocio = utilidad sostenida:** ayudar a encontrar, comprender, revisar y comparar almacenamiento con menos esfuerzo y mayor confianza. No se presume monetización, demanda demostrada ni una mejora de retención medida.
- **Separar hechos de propuestas:** “Implementado” significa comprobado en el código; “verificado anteriormente” remite a §5.2; “pendiente” no se da por probado. Las decisiones sobre prioridades son hipótesis de producto razonadas, no observaciones de usuarios externos.
- **Preservar el producto:** mantener análisis local, lectura de metadatos, inglés/español, accesibilidad, tokens y componentes existentes. No se propone un cambio de marca, una reescritura ni convertirlo obligatoriamente en un limpiador.

---

## 1. Qué es el producto y qué quiere lograr

### Propuesta de valor actual

Storage Analyzer es una aplicación de escritorio para Windows que analiza una carpeta y permite identificar sus archivos más grandes, explorar su contenido y mostrar un elemento en el Explorador. El análisis es local y de solo lectura. Sus cifras describen **tamaño lógico**; no equivalen al tamaño asignado en disco ni al espacio que se recuperaría eliminando un archivo.

La instalación empaquetada ya incorpora Electron, backend y Java. El código y las guías declaran Windows 10/11 x64, pero la verificación registrada procede del equipo de desarrollo; no debe confundirse esa declaración con una matriz de soporte completa.

### El trabajo del usuario, no la lista de pantallas

**[Suposición de segmento de trabajo]** Persona que usa Windows y necesita resolver «me queda poco espacio», «no sé qué está creciendo» o «quiero revisar lo que ocupa mucho». Un desarrollador o soporte técnico puede necesitar mayor detalle, pero no debe obligar al resto a entender snapshots, heaps o estructuras internas.

| Pregunta del usuario              | Respuesta que el producto debe facilitar                                      | Valor para el producto                                            |
| --------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ¿Qué ocupa tanto?                 | Encontrar archivos y carpetas relevantes sin bajar nivel por nivel.           | Primer resultado útil y menor abandono del recorrido.             |
| ¿Qué estoy viendo y por qué pesa? | Ruta, tipo, fecha, contexto y cobertura comprensibles.                        | Confianza en los datos y mejores decisiones.                      |
| ¿Cómo reviso esto sin perderme?   | Detalle, carpeta contenedora, ubicación externa y regreso al mismo resultado. | Menos trabajo repetido y utilidad cotidiana.                      |
| ¿Qué cambió desde la última vez?  | Comparaciones locales entre análisis compatibles.                             | Motivo concreto para volver, sin afirmar retención ya conseguida. |
| ¿Qué conviene revisar primero?    | Candidatos explicables y una lista manual, sin promesas de borrado seguro.    | Orientación útil con riesgo controlado.                           |

### Recorrido que ya existe

```text
Instalar y abrir → Esperar al motor si está iniciando
  → Elegir carpeta / reciente / carpeta habitual
  → Analizar con tiempo, ruta actual y cancelación
  → Ver tamaño lógico, cobertura y capacidad/libre de la unidad al iniciar
  → Explorar carpeta O consultar los 100 archivos más grandes de todo el análisis
  → Ver omitidos, copiar ruta o mostrar el elemento en el Explorador
```

### Capacidades implementadas que se reutilizarán

| Capacidad                        | Estado actual y evidencia local                                                                                                                     | Lo que aún no implica                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Motor y errores: F9/F11/F16a     | Salud/versión, recuperación explícita, códigos traducidos, progreso y locale del sistema. `useServiceStatus`, `ScanProgress`, `backend-process.js`. | Historial, progreso porcentual o lectura en tiempo real.                                          |
| Ranking global: F2a              | 100 filas, mínimo 0/100 MB/1 GB/10 GB, ruta relativa, coincidencias y cobertura. `LargestFiles.tsx`.                                                | Búsqueda global por nombre, fecha o categoría; navegación interna al contenedor.                  |
| Mostrar ubicación: F1a           | Disponible en selección y ranking; ruta confirmada por backend y comprobación de existencia. `useShowItem`, `main.js`, `/scans/{id}/entry`.         | Abrir/ejecutar, papelera o restauración.                                                          |
| Inicio y productividad: F6a/F14a | Cinco recientes borrables, carpetas comunes, Ctrl+O/F/F5 y Alt+←, ayuda en Ajustes.                                                                 | Selector de unidades, drag-and-drop, subanálisis o persistencia de resultados.                    |
| Cobertura y cifras: F10/F8a      | Omitidos paginados con motivo/truncamiento; tamaño lógico y capacidad/libre al inicio. `SkippedItemsDialog`, `ScanSummary`.                         | Detección fiable de nube o tamaño físico.                                                         |
| Accesibilidad y UI: F15a parcial | Árbol por teclado, foco, split adaptable, idiomas y pruebas automáticas de colores forzados.                                                        | Certificación WCAG ni revisión manual completa con tecnologías de asistencia; tampoco tema claro. |
| Distribución: F19a parcial       | NSIS por usuario, Java incluido, logs acotados, cierre/actualización/desinstalación probados en desarrollo.                                         | Prueba limpia/offline, cuenta estándar real, Windows 10 verificado o firma.                       |

**Dirección desde H3:** pasar de «ya puedo encontrar un archivo grande» a **«puedo entenderlo, volver a encontrarlo y comprobar qué cambió»**. El valor inmediato está en conectar y profundizar las herramientas existentes, no en añadir más gráficos o acciones destructivas.

---

## 2. Fricciones actuales desde la perspectiva del usuario

Esta sección sustituye el diagnóstico inicial obsoleto. No siguen pendientes el ranking, mostrar en el Explorador, los recientes, el detalle de omitidos, el arranque explicado ni la traducción del diálogo nativo.

### 2.1 Veo muchas cifras antes de poder trabajar

El hero, cuatro tarjetas, la explicación técnica y la dona desplazan los resultados hacia abajo. Las capturas de pruebas del 19/09 (`overview.png`, `largest-compact-es.png`) muestran esa jerarquía; no son sesiones de usuarios. **Inferencia de diseño:** compactar el resumen y dar prioridad a la tabla/ranking, manteniendo visibles alcance, fecha y advertencias esenciales. La explicación extensa puede ser ampliable; la parcialidad no.

### 2.2 Encuentro un archivo grande, pero no puedo investigarlo dentro de la app

El ranking presenta nombre y ubicación como texto y una acción de Explorador. Falta «Ver carpeta en el análisis» y un detalle útil. Volver desde el contexto debe conservar consulta, umbral, orden, página, desplazamiento y foco, no obligar a reconstruir el hallazgo. **Atendido en H4a** (§5.2): detalle, carpeta contenedora y regreso con estado conservado.

### 2.3 No sé qué está buscando cada buscador

Árbol = elementos cargados; tabla = hijos directos; ranking = tamaño mínimo. Ctrl+F en ranking puede dirigir al árbol, que en compacto está dentro de un diálogo cerrado. Proponer una búsqueda con **ámbito visible y consistente**, no un cuarto buscador. Las consultas globales han de recorrer el snapshot observado, no filtrar los primeros 100/500 resultados.

### 2.4 Pierdo contexto al cambiar de vista

La tabla se monta por ruta y el ranking se desmonta al salir; filtros/página/umbral locales pueden reiniciarse. Estado de vista por análisis y ámbito, regreso al resultado y recuperación de foco son una mejora funcional, no solo estética. No conservar filtros de otro scan sin hacerlo explícito. **Atendido en H4a** para ranking y tablas de carpeta: el estado vive en la página por análisis y ámbito, y un nuevo análisis empieza limpio.

### 2.5 El tamaño no basta para decidir

Faltan modificación, extensión/categoría y conteos por carpeta en la tabla. Estos últimos ya existen en el modelo; las fechas todavía no se guardan en las entradas del snapshot. Añadir datos debe enriquecer la misma tarea de búsqueda y detalle, no crear pantallas desconectadas. «Antiguo» no significa «sin uso» ni «seguro para borrar».

### 2.6 No sé si estos resultados siguen vigentes

Las cifras pertenecen a un análisis, no al filesystem vivo. Ya se avisa de la capacidad al inicio y de rutas desaparecidas; falta una identidad temporal visible del resultado y una actualización dirigida. Agregar fecha de inicio/fin exige extender el contrato: `elapsedMillis` no es una fecha. No detectar cambios externos imaginariamente ni modificar totales antiguos.

### 2.7 Al volver a abrir, tengo que empezar de nuevo

Recientes son rutas, no informes guardados. Las sesiones de backend caducan o desaparecen al reiniciar. Guardar resúmenes comparables y mostrar «Qué creció» aportaría continuidad; un resumen acotado no restaura un árbol completo.

### 2.8 Elegir el próximo análisis exige salir del recorrido

Recientes y comunes están en bienvenida, no en un selector accesible también desde resultados. Reanalizar siempre parte de la raíz. Ampliar el selector, ofrecer unidades con contexto y «Analizar esta subcarpeta» como scan independiente reduce trabajo repetido. **Capacidad/libre de la unidad actual ya se muestra**; no proponerla de nuevo como inédita.

### 2.9 Un análisis grande puede producir una vista costosa

La tabla pagina 25 filas en el cliente, pero recibe todos los hijos; el árbol muestra todos los hijos de ramas abiertas. Las consultas y la materialización bajo el monitor del servicio pueden afectar al progreso de otro scan. La memoria dinámica mejoró el recorrido del disco, no resolvió automáticamente el coste de mostrar o consultar millones de entradas.

### 2.10 Comodidad, privacidad y confianza aún pueden mejorar

Solo hay tema oscuro. Los recientes guardan rutas completas y se pueden borrar, pero falta «No guardar recientes». Los comandos principales usan iconos que exigen reconocer su significado. Conviene hacer más visibles las acciones frecuentes, permitir tema del sistema y explicar almacenamiento local. Al añadir historial, revisar la política actual: actualizar conserva datos y desinstalar los elimina.

### 2.11 La distribución necesita cierre técnico, no reclutamiento

El instalador **ya existe**. Pendientes reales: entorno limpio sin red, cuenta estándar, alcance Windows comprobado, accesibilidad manual y firma para distribución pública. Una sesión externa no reemplazaría esas verificaciones, y su ausencia deja de ser un bloqueo del roadmap. La evidencia histórica y sus límites se conservan en §5.2.

---

## 3. Funcionalidades propuestas

### Reglas de alcance

- Se conservan F1–F19 y se añade F20 (lista de revisión no destructiva). Cada ficha distingue lo existente de su siguiente incremento; H0–H2 no se reabren.
- **MVP** es la primera entrega útil de cada propuesta, no la obligación de incluirla en la primera versión del producto.
- Complejidad **B / M / A** significa baja / media / alta relativa. Incluye interfaz, API, pruebas y seguridad; no representa días de trabajo.
- El impacto indicado es **esperado, no medido**. No se asignan puntuaciones RICE sin datos de alcance y confianza.
- Los contratos marcados como implementados existen; cualquier ampliación es propuesta. La aceptación futura usa fixtures, recorridos internos y estándares, sin exigir participantes externos. No equivale a demostrar demanda.

### F1. Acciones separadas por riesgo: mostrar, abrir y enviar a la papelera

**Estado al 2026-09-19:** F1a implementada en H2. F1b/F1c pendientes; primero mejorar descubrimiento de la acción existente y continuidad del contexto (UX2/UX3).

**Necesidad:** pasar de identificar un elemento a revisarlo o actuar sobre él. **Impacto esperado: alto.**

- **F1a · Entrega existente:** «Mostrar en el Explorador» para el elemento seleccionado, con un botón visible y accesible. El menú contextual puede llegar después; no debe ser el único acceso.
- **F1b · Ampliación:** «Abrir con la aplicación predeterminada». Requiere una decisión explícita del usuario y una política para ejecutables, scripts, accesos directos y tipos desconocidos. Nunca abrir automáticamente al seleccionar una fila.
- **F1c · Iniciativa posterior:** envío individual a la papelera, desactivado por defecto. Confirmar nombre, ruta completa y tamaño observado, indicando cuándo se midió. Bloquear objetivos fuera del alcance autorizado, raíces y ubicaciones protegidas; rechazar cambios de identidad y enlaces que redirijan a otro destino.
- **Contrato de seguridad:** validar emisor IPC y objetivo en el proceso privilegiado; no confiar en una ruta arbitraria del renderer ni en una comparación de prefijos de texto. Revalidar existencia y pertenencia al análisis. Para mutaciones, diseñar además la identidad del archivo y la carrera entre validación y operación. El modo navegador no debe simular que estas acciones nativas están disponibles.
- **Aceptación:** la acción apunta al elemento seleccionado; rutas desaparecidas, permisos y errores de apertura se explican sin cerrar la app. Cancelar la confirmación no produce efectos. Una operación fallida nunca se muestra como exitosa ni recurre a borrado permanente.
- **Consistencia:** después de una mutación, marcar el análisis como desactualizado y ofrecer reescaneo. No restar a un snapshot inmutable tamaños que podrían haber cambiado. «Enviado a la papelera» no significa «espacio liberado»: no contabilizar bytes lógicos como espacio libre recuperado.
- **Fuera del MVP:** selección múltiple, vaciado de papelera, ajuste incremental del árbol y restauración automática. «Deshacer» necesita una prueba de viabilidad que cubra conflictos de nombre y recuperación tras reiniciar; no se promete antes.
- **Dependencias y esfuerzo:** F1a, B–M, sobre selección existente; no depende de F2. F1b, M, tras política de apertura. F1c, A, condicionada a F8 acotada, revisión de seguridad y escenarios internos de fallo reproducibles; fuera de la siguiente entrega.

**Base técnica verificada:** Electron permite mostrar una ruta, abrirla y enviarla a la papelera; `openPath` puede devolver un mensaje de fallo. Su API `shell` no documenta una operación inversa de restauración. Estas capacidades no resuelven por sí solas el flujo seguro del producto. [Documentación de shell](https://www.electronjs.org/docs/latest/api/shell). La validación del emisor de IPC también forma parte de las recomendaciones oficiales. [Seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages).

### F2. Los archivos más grandes de todo el análisis

**Estado al 2026-09-19:** F2a implementada en H2. F2b.1 entregada en H4a (detalle, carpeta contenedora y regreso). Siguen F2b.2 (H4b) y F2b.3 (H4c).

**Necesidad:** encontrar un archivo grande sin abrir sus carpetas antecesoras. **Impacto esperado: alto. Complejidad: M.**

- **F2a · MVP:** vista «100 archivos más grandes del análisis», con nombre, tamaño lógico y ruta relativa a la raíz. Conmutador «Esta carpeta | Más grandes del análisis»; filtro mínimo en bytes con accesos rápidos equivalentes a 100 MB y 1 GB según la política de unidades de la app.
- **Contrato implementado:** `GET /scans/{id}/largest?limit=100&minSizeBytes=...`, solo archivos en la primera entrega. Validar y acotar parámetros; ordenar por tamaño descendente y desempatar por ruta. Responder con identificador de scan y cobertura completa/parcial. Calcular un top-N acotado, sin copiar u ordenar todo el snapshot si no hace falta.
- **Aceptación:** encuentra un archivo situado seis niveles abajo aunque el árbol esté contraído; abrir ramas no cambia el ranking. Probar empates, cero bytes, cero coincidencias, límites exactos del filtro, análisis parcial y sesión caducada. La etiqueta dice «del análisis», nunca «de todo el disco» si no se analizó todo.
- **UI:** reutilizar primitivas de tabla y selección sin forzar el contrato de hijos directos. Mostrar ubicación incluso con nombres duplicados. El top 100 es un límite visible, no una supuesta lista completa.
- **F2b.1 · H4a:** seleccionar un resultado, inspeccionar un detalle y «Ver carpeta en el análisis» cargando solo los ancestros necesarios. «Volver a resultados» restaura filtros, fila, foco y desplazamiento.
- **F2b.2 · H4b:** nombre/ruta y tamaño sobre todo el análisis, con ámbito explícito, coincidencias reales y paginación acotada. Aplicar filtros **antes** de top-N/paginación; la caché actual de 500 archivos no cubre una búsqueda global.
- **F2b.3 · H4c:** integrar fecha (F7), extensión/categoría (F5) con filtros AND, chips eliminables y «Limpiar filtros». Las carpetas agregadas van separadas para no duplicar bytes de descendientes.
- **Fuera del MVP:** deduplicación por contenido, búsqueda en el disco en tiempo real, carpeta+archivo en un mismo total y expansión masiva del árbol.
- **Dependencias:** H0 validado y contrato de errores F11. F1a complementa el hallazgo, pero no bloquea calcular el ranking.

### F3. Elementos para revisar, con reglas locales explicables

**Estado al 2026-09-19:** Pendiente; propuesta para H6, después de filtros y lista de revisión. Impacto esperado, sin demanda demostrada.

**Necesidad:** ayudar a interpretar resultados sin afirmar que algo se puede borrar por su nombre. **Impacto esperado: alto, con confianza limitada sin evidencia de uso externo. Complejidad: M–A.**

- **MVP:** catálogo pequeño, versionado y probado de candidatos en carpetas del usuario. Cada coincidencia muestra regla, evidencia, tamaño observado y una explicación de qué revisar. Empezar, por ejemplo, por instaladores antiguos en Descargas y archivos grandes sin modificación reciente; no tratarlos como prescindibles.
- **UI:** «Elementos para revisar», no «Limpieza segura» ni «Espacio recuperable garantizado». Informar cobertura parcial y evitar sumar una carpeta y sus descendientes dos veces.
- **Aceptación:** una regla por antigüedad utiliza fechas válidas; lo desconocido no se transforma en antiguo. Hay pruebas de falsos positivos y de solapamientos. El usuario puede inspeccionar e ignorar sugerencias; ninguna ejecuta acciones por sí sola.
- **Fuera del MVP:** borrado automático, reglas sobre `Windows.old`, `WinSxS`, papelera o cachés activas; limpieza de dependencias solo por llamarse `node_modules` o `.venv`. Para mantenimiento del sistema, derivar a herramientas del sistema en vez de simular sus garantías.
- **Dependencias:** F7 para antigüedad, F10 para explicar cobertura y F1a para inspección. F5 puede enriquecer categorías, pero no es obligatoria. **No depende de implementar papelera.**
- **Decisión de continuidad:** mantenerla solo si un catálogo pequeño ayuda a decidir y puede mantenerse; medir comprensión y falsos positivos, no solo cantidad de candidatos.

### F4. Historial de resúmenes y comparaciones compatibles

**Estado al 2026-09-19:** Pendiente; iniciativa principal de H5 para conservar resultados y comparar cambios.

**Necesidad:** responder «¿qué cambió desde el último análisis?». **Impacto esperado: alto para uso recurrente, demanda pendiente de validar. Complejidad: M–A.**

- **F4a · MVP:** permitir guardar resúmenes locales voluntariamente, con opción explícita de guardado automático y límites visibles: raíz e identidad disponible del volumen, fecha, versión de esquema, criterio de tamaño, alcance/exclusiones, cobertura y agregados por carpeta con profundidad/límite declarados. Propuesta inicial: 10 informes o 20 MiB, lo que se alcance primero; ajustar con mediciones.
- **Contrato de UX:** cada informe ofrece «Analizar de nuevo» y acceso a «Comparar» cuando haya otro compatible. Un resumen histórico permite consultar lo guardado, **no reconstruir todo el árbol** ni evitar la caducidad de sesiones activas. Mostrar fecha, cobertura retenida y «Histórico»; ofrecer reescaneo para datos actuales.
- **F4b · Comparación:** comparar resúmenes compatibles de la misma raíz y alcance. Diferenciar «nuevo», «ya no observado» y «no comparable»; una rama inaccesible no vale cero. Presentar crecimiento/disminución de tamaño lógico, no limpieza confirmada.
- **Aceptación:** persistencia tras reinicio, escritura atómica, lectura de archivos corruptos sin bloquear el arranque, versión incompatible explicada y opción de borrar historial. No deducir desapariciones fuera de la profundidad guardada. Probar análisis parciales y cambios de exclusiones.
- **Fuera del MVP:** snapshots completos persistentes, seguimiento de renombrados, sincronización, comparación entre equipos y vigilancia continua.
- **Dependencias:** contrato de snapshot estable, semántica de cobertura y política de retención. F7 no es requisito para comparar tamaños agregados. Se prioriza antes de F3 porque responde una tarea concreta que hoy obliga a rehacer trabajo; es una decisión de producto, no un hallazgo de entrevistas.

### F5. Desglose por tipo de archivo

**Estado al 2026-09-19:** Pendiente; H4 después de búsqueda/fechas, enlazada a la misma consulta.

**Necesidad:** entender cuánto representan vídeos, imágenes, documentos u otros tipos. **Impacto esperado: medio–alto. Complejidad: M.**

- **MVP:** agregación por extensión con categorías versionadas y explícitamente aproximadas; incluir «Sin extensión» y «Otros». Contar cada archivo observado una sola vez; no inspeccionar su contenido para adivinarlo.
- **UI:** selector «Por carpeta | Por tipo», conservando tabla y cifras accesibles. Al elegir una categoría, filtrar el ranking global solo después de ampliar el contrato de F2 para ello.
- **Aceptación:** suma de categorías igual al total de bytes de archivos observados, incluso con nombres sin extensión y diferencias de mayúsculas. No confundir cero con categoría sin datos; mantener advertencias de parcialidad.
- **Fuera del MVP:** detección MIME por contenido y clasificar directorios completos como «caché segura».
- **Dependencias:** esquema de clasificación y presupuesto para agregados. F2 solo es necesaria para el enlace al ranking; F7 no es obligatoria.

### F6. Inicio rápido y contexto de almacenamiento

**Estado al 2026-09-19:** F6a implementada. F6b y el acceso a recientes desde resultados son ampliaciones, no rehacer la bienvenida.

**Necesidad:** empezar sin repetir siempre el selector y entender qué se está analizando. **Impacto esperado: medio–alto.**

- **F6a · MVP, B:** últimas 5 carpetas y accesos a carpetas comunes resueltas por el sistema, sin asumir nombres ni rutas fijas. Registrar recientes tras iniciar un scan válido; permitir borrarlos. Manejar almacenamiento local bloqueado y rutas que ya no existen.
- **F6b · Ampliación, M:** unidades con capacidad y espacio libre, consultadas con timeout y fallos por unidad. Una unidad desconectada o lenta no debe bloquear la bienvenida.
- **Aceptación:** un clic inicia exactamente la carpeta elegida; se informa si no está disponible. Distinguir espacio libre del volumen, tamaño lógico del análisis y fecha de actualización. No restar el tamaño de una carpeta de la capacidad del volumen.
- **Fuera del MVP:** escaneo automático de todas las unidades, descubrimiento masivo de recursos de red e historial completo (F4).
- **Dependencias:** F9 para habilitar inicio de análisis. La vista de unidades requiere confirmar comportamiento en volúmenes extraíbles/red antes de ofrecerlos como soportados.

### F7. Fechas de modificación y filtros combinables

**Estado al 2026-09-19:** Pendiente; H4. El backend aún no retiene lastModifiedTime en el snapshot.

**Necesidad:** localizar elementos antiguos o grandes con criterios explícitos. **Impacto esperado: medio–alto. Complejidad: B–M.**

- **MVP:** conservar `lastModifiedTime` al escanear archivos y recalibrar memoria/DTO/validadores; columna ordenable «Modificado» y filtros de tamaño/fecha. Combinar filtros con semántica AND y mostrar el número de coincidencias y cómo restablecerlos.
- **Aceptación:** fecha absoluta accesible además de la relativa, zona horaria definida, fechas ausentes/futuras tratadas explícitamente y pruebas de límites. «No modificado desde…» nunca se convierte en «No usado desde…».
- **Después:** fecha más reciente de un descendiente para carpetas, con una etiqueta diferente de la modificación de la propia carpeta y cobertura parcial visible.
- **Fuera del MVP:** prometer antigüedad de uso mediante fecha de acceso.
- **Dependencias:** ampliar/versionar DTO y validadores; integrar filtros globales con F2 sin cambiar silenciosamente el alcance de la tabla actual.

### F8. Precisión: tamaño lógico, tamaño en disco y nube

**Estado al 2026-09-19:** F8a implementada en H1. F8b/c pendientes; no prometer tamaño físico a partir de los bytes actuales.

**Necesidad:** evitar decisiones basadas en cifras que no representan espacio local recuperable. **Impacto esperado: alto en escenarios de nube; prevalencia desconocida. Complejidad: A para soporte nativo.**

- **F8a · Calidad inmediata:** etiquetar tamaño lógico, explicar limitaciones y separar capacidad/espacio libre. No requiere integración nativa ni bloquea el ranking de F2.
- **F8b · Investigación acotada:** validar una muestra Windows con archivos locales, placeholders, enlaces duros, dispersos y comprimidos. Confirmar que la inspección no descarga contenido. Definir «desconocido/no soportado» antes de elegir API o biblioteca.
- **F8c · Entrega condicionada:** exponer tamaño en disco y estado de disponibilidad solo para combinaciones verificadas; no inferir cero bytes locales cuando el proveedor no da el dato. No sumar enlaces duros como si fueran bloques físicos distintos.
- **Aceptación:** matriz de casos con referencia de medición, ámbito de soporte visible y valores desconocidos conservados de extremo a extremo. Antes de F1c, bloquear acciones en contextos de sincronización no verificados y explicar posibles efectos fuera del equipo.
- **Fuera del MVP:** promesa universal de espacio recuperable o detección de todos los proveedores de nube.
- **Nota técnica:** `DosFileAttributes` de Java 17 expone los indicadores read-only, hidden, system y archive; no ofrece por sí sola el contrato completo de placeholders planteado originalmente. Hace falta investigar el acceso nativo, no asumir que está resuelto. [Contrato oficial de Java 17](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/nio/file/attribute/DosFileAttributes.html).

### F9. Arranque verificable y recuperación del servicio

**Estado al 2026-09-19:** Implementada en H1 y adaptada al backend empaquetado en H3. Mantener y probar regresiones, no volver a construir.

**Necesidad:** evitar errores engañosos al iniciar y después de una caída del backend. **Impacto esperado: alto en primer uso. Complejidad: M.**

- **MVP:** estado `starting | ready | failed`, endpoint de salud que identifique la aplicación y la compatibilidad de API, timeout y reintentos acotados. Un puerto TCP abierto no demuestra que responda el servicio correcto.
- **UI:** «Preparando el motor…»; desactivar solo acciones que necesitan el servicio. Ofrecer reintento y diagnóstico útil. Ante una caída, conservar resultados visibles como snapshot e indicar qué operaciones ya no están disponibles.
- **Aceptación:** arranque lento, backend ausente, caída posterior, puerto ocupado por otro servicio, versión incompatible y backend iniciado externamente. Probar el origen/puerto configurado; cerrar la app no debe detener procesos ajenos.
- **Fuera del MVP:** reinicios infinitos, elevar privilegios y subir registros automáticamente. Si se muestran/exportan logs, advertir o redactar rutas personales.
- **Dependencias:** contrato mínimo con F11; integración con empaquetado F19. No exige añadir Spring Actuator si un endpoint pequeño cubre el contrato.

### F10. Informe de cobertura y elementos omitidos

**Estado al 2026-09-19:** Entrega mínima implementada en H2. Mejoras posteriores: agrupar/filtrar motivos y mantener acceso desde las nuevas vistas.

**Necesidad:** entender por qué el resultado es parcial. **Impacto esperado: medio–alto para confianza. Complejidad: M.**

- **MVP:** desde «Omitidos», abrir una lista paginada y acotada por ruta y código de motivo: permiso, enlace excluido, profundidad, cambio durante lectura u otro error. Mostrar cantidad registrada y avisar si la lista fue truncada.
- **Aceptación:** el recuento y el detalle se reconcilian, incluyendo truncamiento explícito; motivos en ambos idiomas. No presentar tamaños desconocidos como cero ni prometer recuperar toda la cobertura.
- **Fuera del MVP:** botón para elevar toda la app. Antes de considerar administración, revisar el límite de privilegios y autenticación de la API local; CORS no sustituye ese diseño.
- **Dependencias:** F11 y un registro de incidencias presupuestado. No guardar listas ilimitadas de errores fuera del presupuesto de H0.

### F11. Contrato de errores e internacionalización coherente

**Estado al 2026-09-19:** Implementada en H1; diálogo nativo traducido en H3. La política de locale del sistema ya está resuelta.

**Necesidad:** comprender fallos y su recuperación en el idioma elegido. **Impacto esperado: medio–alto. Complejidad: B–M.**

- **MVP:** códigos estables en errores HTTP, scans y nodos; parámetros controlados para interpolación y mensaje de respaldo. Mapear códigos en el frontend; no traducir por coincidencias con frases inglesas.
- **Política implementada de formato:** idioma de interfaz elegido por el usuario; locale numérico resuelto explícitamente desde el sistema en Electron y desde el navegador en preview. Conservar las reglas actuales de unidades/truncamiento y hacer coherentes bytes, contadores y porcentajes. Actualizar documentación y pruebas con esa política.
- **Aceptación:** arranque, carga, ramas, límites y fallos no dejan textos fijos sin traducir. Códigos desconocidos tienen fallback comprensible; errores técnicos no exponen trazas al usuario. Probar al menos inglés, español y locale de números diferente al idioma de interfaz.
- **Fuera del MVP:** traducción de nombres de archivos y soporte de nuevos idiomas.
- **Dependencias:** acordar contrato junto con F9; sirve de base para F10 y los errores de las nuevas consultas.

### F12. Treemap como complemento, no como navegación obligatoria

**Estado al 2026-09-19:** Diferida a H7; no es requisito para encontrar, revisar ni comparar.

**Necesidad:** explorar visualmente la distribución cuando ranking y tabla no basten. **Impacto esperado: medio, pendiente de validar. Complejidad: A.**

- **MVP condicionado:** 2 niveles con número máximo de rectángulos y agrupación del resto, paleta de tokens y controles equivalentes en la tabla.
- **Aceptación:** tamaño y porcentaje accesibles sin hover; selección sincronizada y alternativa completa por teclado/lector de pantalla. Probar nodos pequeños, cero bytes, zoom, alto contraste y carpetas anchas.
- **Fuera del MVP:** renderizar todo el árbol, navegación solo por canvas o usar superficie visual como sustituto de cifras exactas.
- **Dependencias:** F2/F5 comparadas mediante tareas internas reproducibles y presupuesto de renderizado medido. Investigar una visualización solo si resuelve una tarea que esas vistas no cubren.

### F13. Informes exportables y respetuosos con la privacidad

**Estado al 2026-09-19:** Pendiente; CSV/JSON en H5 después de fijar el alcance de las vistas. HTML posterior.

**Necesidad:** documentar un análisis o pedir ayuda sin dar acceso al equipo. **Impacto esperado: medio; alto si se valida soporte técnico. Complejidad: M.**

- **F13a · MVP:** CSV y JSON de la vista actual, con raíz, fecha, unidad, filtros, límite de resultados y cobertura. Elegir rutas completas, relativas o redacción de identificadores antes de guardar; aplicar esa política también a la raíz y a todos los metadatos. Vista previa paginada/acotada que permita revisar el conjunto exportable con conteo exacto; no cargar todo el informe en el DOM. Acotar la exportación y explicitar su límite antes de guardar; si se amplía, diseñar generación progresiva sin materializar una respuesta gigante. Las rutas relativas todavía pueden revelar nombres personales: no equivalen a anonimización.
- **Aceptación:** nombres Unicode y separadores correctos; neutralizar fórmulas en celdas CSV sin ocultar la política de escape. Cancelar no crea un informe; disco lleno y permisos producen errores recuperables. No exportar filas ocultas fuera del alcance anunciado.
- **F13b · Después:** HTML autocontenido con contenido escapado, sin scripts ni recursos remotos.
- **Fuera del MVP:** compartir automáticamente, subir archivos o afirmar anonimización total sin revisar nombres incluidos.
- **Dependencias:** contrato de vista estable. No requiere F4 si el informe proviene de un scan activo.

### F14. Productividad en incrementos independientes

**Estado al 2026-09-19:** F14a implementada. F14b/c pendientes; corregir el destino de Ctrl+F es continuidad UX, no un atajo nuevo.

**Necesidad:** reducir pasos repetidos sin alterar la consistencia del análisis. **Impacto esperado: medio.**

- **F14a · B:** `Ctrl+O` para elegir carpeta, `Ctrl+F` para la búsqueda del ámbito visible, `F5` para reescanear y `Alt+←` para el padre. Mostrar ayuda y no interceptar atajos dentro de campos o diálogos cuando interfieran con edición/navegación.
- **F14b · M:** arrastrar una carpeta mediante un puente nativo acotado; validar como en el selector. Rechazar varios objetivos o archivos con explicación. No sustituir silenciosamente un análisis activo.
- **F14c · M:** «Analizar esta subcarpeta» como **nuevo scan independiente**. Reutiliza el ciclo de vida existente; no mezcla tamaños de momentos distintos en un mismo snapshot.
- **Fuera del MVP:** parchear una rama del snapshot anterior o habilitar `Supr` antes de validar F1c. Reconciliar ancestros, cachés y agregados sería una iniciativa posterior.
- **Aceptación:** los atajos no duplican solicitudes; drag-and-drop respeta cancelación y origen; analizar una subcarpeta no modifica el snapshot previo.

### F15. Alto contraste primero, elección de tema después

**Estado al 2026-09-19:** F15a automatizada, revisión manual pendiente. F15b pendiente: Sistema/Claro/Oscuro se propone con H4.

**Necesidad:** mantener legibilidad y control en preferencias visuales distintas. **Impacto esperado: medio; accesibilidad es un requisito transversal.**

- **F15a · Calidad de la beta, B–M:** verificar y corregir `forced-colors`, foco, selección, errores y gráficos con alternativas textuales.
- **F15b · Ampliación, M:** «Sistema | Claro | Oscuro», tokens completos y persistencia tolerante a fallos.
- **Aceptación de F15a:** selección distinguible sin depender solo del color, controles y foco visibles, contraste en el tema actual y alto contraste, y 200 % de texto.
- **Aceptación adicional de F15b:** revisar claro/oscuro/sistema y persistencia. Cambiar tema no cierra un scan ni reinicia selección.
- **Fuera del MVP:** afirmar cumplimiento WCAG a partir de pruebas automáticas únicamente.

### F16. Progreso honesto y diagnóstico de actividad

**Estado al 2026-09-19:** F16a implementada. F16b opcional; prioridad inferior a búsqueda y comparación.

**Necesidad:** distinguir un trabajo en curso de un servicio que dejó de responder. **Impacto esperado: medio–alto. Complejidad: B–M.**

- **F16a · MVP:** tiempo transcurrido, última actividad reportada y ruta actual con actualización limitada y truncamiento visual accesible. Distinguir «servicio sin respuesta» de «sin nuevos elementos»; esta última situación puede ser una lectura lenta.
- **F16b · Después:** velocidad suavizada de elementos/segundo, como dato orientativo, no tiempo restante garantizado.
- **Aceptación:** el contador se detiene en estados terminales y se reinicia por scan; cancelar sigue disponible; cambios de ruta no saturan anuncios del lector de pantalla ni respuestas de polling.
- **Fuera del MVP:** porcentaje a partir de bytes lógicos descubiertos / bytes usados del volumen. Esa razón no mide el trabajo total del recorrido y puede resultar engañosa.
- **Dependencias:** F9 para conectividad y extensión mínima del estado del scan; no necesita F6b.

### F17. Monitor opcional, solo tras validar recurrencia

**Estado al 2026-09-19:** Diferida a H7. Sin actividad en segundo plano ni notificaciones nuevas por defecto.

**Necesidad:** avisar de poco espacio antes de que interrumpa al usuario. **Impacto esperado: desconocido hasta validar uso. Complejidad: A.**

- **Primera entrega si se justifica:** consulta de espacio libre con umbral configurable, activación explícita y pausa. No escanear recursivamente el disco en segundo plano por defecto.
- **Aceptación:** presupuesto de CPU/memoria/energía medido, avisos sin repetición continua y comportamiento documentado al cerrar sesión, suspender o quitar una unidad.
- **Después:** análisis programados, solo con límites de recursos y política de retención; alimentarían F4.
- **Dependencias:** F6b, F19 y evidencia de necesidad recurrente. F4 es requisito para históricos programados, no para un aviso simple.
- **Fuera del roadmap comprometido:** arranque automático con Windows sin consentimiento y servicio permanente invisible.

### F18. Asistente con IA: fuera del alcance actual

**Estado al 2026-09-19:** Fuera del plan actual.

**Necesidad hipotética:** explicar carpetas poco reconocibles. No hay evidencia aún de que requiera IA ni de que compense el riesgo.

- **Decisión propuesta:** no implementarlo en las primeras entregas. Evaluar primero explicaciones deterministas y enlaces de ayuda revisados. Retirar la afirmación de que F3 cubre un porcentaje concreto de valor: no se ha medido.
- **Condiciones para reconsiderar:** problema validado, consentimiento específico, minimización de rutas/datos, coste asumible y evaluación de respuestas incorrectas. La anonimización no se presume suficiente.
- **Límite no negociable:** nunca autorizar ni ejecutar limpieza a partir de una recomendación automática. No presentar «seguro para borrar» como certeza.
- **Estado:** exploración sin fecha ni compromiso de implementación.

### F19. Distribución autónoma para Windows

**Estado al 2026-09-19:** Instalador construido y verificado en desarrollo en H3; quedan las verificaciones de entorno y procedencia de §5.2.

**Necesidad:** que una persona sin herramientas de desarrollo pueda probar el producto. **Impacto esperado: alto si el segmento inicial no es técnico. Complejidad: A.**

- **F19a · Construido:** instalador NSIS con electron-builder, frontend, backend y Java 17 recortado mediante jlink. No replantear herramientas sin una limitación medida; completar pruebas limpias/offline y de usuario estándar.
- **Aceptación:** instalar, iniciar, analizar y desinstalar en una máquina limpia del Windows declarado como soportado, sin herramientas de desarrollo ni red para el análisis. Probar rutas con espacios/Unicode, usuario estándar, inicio fallido y cierre sin procesos huérfanos.
- **Operación:** definir ubicación y límites de logs/datos, conservación del historial al actualizar, limpieza al desinstalar y compatibilidad de versiones entre procesos. Resolver firma/procedencia antes de distribución pública; no pedir que se desactiven protecciones del sistema.
- **Fuera del MVP:** multiplataforma completa, autoactualización y reescritura a GraalVM. Solo reconsiderarlas con evidencia o una limitación medida.
- **Dependencias:** F9 y recorrido H2 ya disponibles. La firma condiciona distribución pública; no bloquea diseñar ni desarrollar las siguientes mejoras en el entorno interno.

### F20. Lista manual de revisión, sin tocar archivos

**Estado:** propuesta nueva para H5c, después de búsqueda útil e informes persistentes. **Complejidad: M. Impacto esperado: medio–alto.**

**Tarea:** «He encontrado varios elementos; quiero conservar cuáles revisar sin volver a buscarlos». Aporta continuidad entre análisis y Explorador sin depender de borrado dentro de la app.

- **MVP:** marcar archivos, no carpetas, desde resultados/detalle; lista local con ruta, scan/fecha de origen y estados «Por revisar» / «Revisado» elegidos por la persona. No cambia ni borra el archivo. Quitar de la lista solo elimina la anotación.
- **Datos y UX:** guardar únicamente si la persona lo activa; límite propuesto de 100 elementos con aviso antes de alcanzarlo. Mostrar «tamaño lógico observado» como cifra informativa, no como objetivo de espacio liberado. No sumar dos registros de la misma ruta; advertir las limitaciones de enlaces duros.
- **Aceptación:** volver a la lista tras reinicio cuando fue guardada; ítems desaparecidos o de scans caducados siguen como referencias históricas, no como comprobados. «Buscar de nuevo» abre una consulta actual y la persona selecciona explícitamente el resultado antes de mostrarlo en el Explorador. No asociar automáticamente por ruta un archivo que pudo ser sustituido: el DTO actual no conserva identidad persistente y un reescaneo no demuestra continuidad. La identidad robusta queda fuera del MVP de anotaciones y será requisito separado de cualquier mutación.
- **Dependencias:** almacenamiento/política de retención de F4a, consulta/detalle F2b y F1a. Exportar la lista con F13 solo cuando el alcance se anuncia.
- **Fuera:** papelera en lote, estados automáticos «limpio» y sincronización. F3 puede sugerir candidatos, pero solo la persona los añade.
- **Valor esperado:** menos reconstrucción de trabajo y una salida organizada para revisar con herramientas del sistema. No añade riesgo de mutación.

---

## 4. Prioridades de producto y criterios UX/UI

### 4.1 Qué merece el siguiente esfuerzo

Se prioriza **confianza → encontrar con precisión → entender el contexto → conservar/comparar → revisión guiada**. La ausencia temporal de investigación externa no elimina la necesidad de justificar decisiones: las hipótesis se contrastan con casos de uso y verificaciones internas, sin inventar adopción, satisfacción o ingresos.

| Orden         | Incremento desde lo existente                                                              | Utilidad para la persona                                                   | Valor de negocio esperado                                            | Esfuerzo / riesgo                               |
| ------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| 1 · H3        | Cierre interno de instalación y accesibilidad + resumen/acciones más claros (UX1/UX2/UX6). | Usar lo que ya existe con confianza y sin tanta búsqueda visual.           | Activación técnica y menor fricción del primer uso.                  | B–M para UI; verificación de entorno separada.  |
| 2 · H4a       | Ranking → detalle → carpeta → volver, con estado conservado (F2b.1).                       | Investigar un hallazgo sin perderlo ni salir por obligación.               | Más tareas resueltas por análisis.                                   | M; coordinación de navegación/cachés.           |
| 3 · H4b/c     | Búsqueda global, fecha/tipo y categorías integradas (F2b.2/3, F7, F5).                     | Encontrar «los vídeos antiguos de esta ubicación», no solo el top general. | Profundidad de análisis y utilidad frente a una lista de tamaños.    | M; consulta global y nuevos metadatos.          |
| 4 · H4d       | Unidades, subanálisis, selector de ubicaciones y tema (F6b, F14c, F15b).                   | Repetir tareas con menos pasos y comodidad visual.                         | Uso cotidiano y control sobre qué analizar.                          | M; soporte por volumen y preferencias.          |
| 5 · H5        | Historial/comparación, informes y lista de revisión (F4, F13a, F20).                       | Retomar trabajo y saber qué creció.                                        | Razón concreta para volver y utilidad para soporte personal/técnico. | M–A; persistencia, privacidad y compatibilidad. |
| 6 · H6        | Candidatos explicables y precisión acotada (F3, F8b/c).                                    | Entender qué merece inspección, sin falsa seguridad.                       | Diferenciación por orientación y exactitud.                          | M–A; falsos positivos y Windows nativo.         |
| Diferido · H7 | Papelera, treemap, monitor y otras apuestas.                                               | Solo añadir lo que no resuelvan los recorridos anteriores.                 | Beneficio aún incierto frente a coste y riesgo.                      | Alto o no justificado todavía.                  |

**No cuentan como nuevas entregas:** F1a, F2a, F6a, F8a, F9, F10 mínimo, F11, F14a, F16a y el paquete F19a ya construido. Se mantienen, se integran y se comprueban sus regresiones.

### 4.2 Dependencias y límites que importan al usuario

| Ampliación                          | Requisito real                                                                     | Riesgo que debe evitar                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Volver al contenedor (F2b.1)        | Resolver padres dentro del mismo snapshot y conservar estado de vista.             | Expandir miles de nodos o mezclar datos de otro scan.                            |
| Búsqueda/filtros globales (F2b.2/3) | Consultar todas las entradas observadas y luego ordenar/paginar.                   | Filtrar los 100 visibles o los 500 cacheados y afirmar que no hay coincidencias. |
| Fecha/categoría (F7/F5)             | Retener fechas; clasificación versionada; memoria y DTO recalibrados.              | Inferir desuso o inspeccionar contenido sin necesidad.                           |
| Nuevas consultas                    | Presupuesto para trabajo, respuesta y DOM; no monopolizar el monitor del servicio. | Que navegar impida ver progreso o cancelar otro scan.                            |
| Historial/comparación (F4)          | Fecha/raíz/volumen/alcance/cobertura/métrica/versiones compatibles.                | Interpretar desconocido como cero o un resumen como árbol completo.              |
| Revisión/exports (F20/F13a)         | Alcance explícito y almacenamiento local voluntario con límites.                   | Filtrar rutas privadas o actuar sobre una referencia obsoleta.                   |
| Candidatos (F3)                     | F7 para antigüedad, F10 existente y catálogo pequeño probado.                      | Presentar patrones como permiso para borrar.                                     |
| Papelera (F1c)                      | Diseño específico de identidad, sincronización, privilegios y recuperación.        | Restar cifras antiguas o equiparar papelera con espacio liberado.                |

F6b no es requisito para guardar un informe; F7 no es requisito para comparar tamaños; F3 no requiere papelera. Mantener estas dependencias mínimas evita bloquear una mejora útil por otra de mayor riesgo.

### 4.3 Especificación UX/UI de las próximas entregas

Las siguientes decisiones son **propuestas de diseño para este producto**, no mandatos universales ni cambios ya aplicados. Se apoyan en el código y las capturas existentes; se verificarán al implementarlas.

#### UX1 · Resultados antes que decoración — H3

- En bienvenida, conservar una explicación corta y acercar los accesos habituales/recientes al botón de elegir carpeta; no agregar un tutorial obligatorio.
- Con resultados, sustituir el hero grande por un encabezado de trabajo: raíz, momento del análisis, estado completo/parcial y acciones. Resumen compacto: tamaño lógico, archivos y omitidos; conteo de carpetas secundario.
- Mantener siempre «Tamaño lógico» y cobertura. Mover el párrafo largo a «Cómo se calcula», ampliable por teclado. La unidad conserva su lectura temporal; no presentar una medida al iniciar como actual.
- Colocar tabla/ranking antes de la visualización grande; dona opcional/colapsable. No ocultar resultados tras un muro de tarjetas ni añadir métricas de relleno.
- **Aceptación propuesta:** con fixture completo y sin errores, a 1280×720 y 100 % se ven controles y primeras filas sin scroll de página; a 390 px el resumen compacto no antepone cuatro tarjetas y una dona a los resultados. Mensajes de error y zoom pueden aumentar la altura sin perder acceso.
- **Valor:** menor distancia visual hasta la siguiente acción, sin retirar advertencias relevantes.

#### UX2 · Acciones reconocibles y con alcance — H3/H4

- «Mostrar en el Explorador» ya funciona: mantener el icono de fila, pero ofrecer texto en el detalle/barra de selección; no depender solo de tooltip o clic derecho.
- Diferenciar «Ver carpeta en el análisis», «Mostrar en el Explorador», «Copiar ruta» y «Analizar esta carpeta». Un clic de selección nunca ejecuta ni borra.
- La acción global será «Nuevo análisis»; actualizar dice qué raíz se reanaliza. Elegir otro objetivo conserva los resultados actuales hasta que termine, como hoy.
- Menú contextual opcional para acciones secundarias, con equivalente visible y teclado; no construirlo antes de resolver navegación.
- **Aceptación:** etiquetas y estado deshabilitado explican objeto y consecuencia; los fallos se muestran junto al comando, sin alertas globales duplicadas por la misma causa.

#### UX3 · Navegación que no borra el trabajo — H4a (entregado; evidencia en §5.2)

- Mantener «Contenido de carpeta | Archivos más grandes»; no convertir cada filtro en otra pestaña. Cuando exista búsqueda global, integrarla con ese ámbito y una etiqueta estable.
- Seleccionar un archivo muestra detalle dentro del área de trabajo; «Ver carpeta» carga solo la cadena necesaria. «Volver a resultados» recupera fila, filtro, orden, página, scroll y foco.
- Estado asociado a `scanId + ámbito`, no a un componente efímero. En un nuevo análisis, restaurar preferencias de presentación, no resultados/selecciones viejas.
- En compacto, detalle como vista con regreso explícito; el explorador debe poder abrirse desde ambas vistas y devolver foco al disparador.
- **Aceptación:** volver conserva exactamente el conjunto y posición; una respuesta tardía del análisis anterior no altera la selección actual. No introducir un router si estado local bien definido basta.

#### UX4 · Una consulta comprensible — H4b/c

- Búsqueda visible por nombre/ruta y selector «Todo el análisis / Esta carpeta y subcarpetas». La tabla de contenido sin búsqueda conserva sus hijos directos; la consulta en carpeta es recursiva y lo dice explícitamente. No cambiar de alcance silenciosamente al usar Ctrl+F.
- Filtros por tamaño, extensión/categoría y fecha en una barra común; chips con eliminación individual y «Limpiar filtros». Mantener consulta mientras llegan resultados nuevos, con estado de carga claro y sin mostrar filas viejas como si coincidieran.
- Conteo «Mostrando 1–50 de N coincidencias» calculado sobre todo el ámbito. El top 100 actual sigue etiquetado como ranking, no como búsqueda exhaustiva.
- Vacío distingue carpeta vacía de filtros sin coincidencias; ofrece una salida concreta. Evitar cambiar foco al actualizar resultados.
- **Aceptación:** buscar encuentra un archivo fuera del top 500 y en una rama nunca abierta; filtrar combina criterios antes de paginar; una consulta anterior cancelada no sobrescribe la nueva.

#### UX5 · Tabla y detalle como superficie principal — H4

- Nombre y ruta distinguen duplicados; tamaño alineado a la derecha con cifras tabulares; cabecera persistente que no tape foco; orden indicado por texto/estado, no solo flecha.
- Añadir modificación y tipo cuando existan datos. Conteos de carpeta usan los valores ya disponibles. Columnas secundarias se pliegan en compacto; el detalle conserva toda la información.
- Densidad cómoda por defecto; una variante compacta, solo si aporta valor sin reducir objetivos interactivos ni legibilidad.
- Categorías con barras y etiquetas activables filtran la misma lista; no otra isla visual. Colores desde tokens. No necesita un treemap ni una biblioteca nueva.
- **Aceptación:** nombres largos, Unicode, tamaños cero y desconocidos no se confunden; controles alcanzables por teclado y sin dependencia de hover; carpeta ancha no significa miles de nodos DOM sin presupuesto.

#### UX6 · Confianza, fecha y recuperación — H3/H4

- Encabezado «Analizado el…» y distinción entre completo, parcial, histórico y datos conservados tras caída. No usar “desactualizado” por mera antigüedad: decir que es una lectura de ese momento, no monitorización.
- La fecha persistible debe venir del contrato del scan; hasta incorporarla, no inventarla a partir de duración. Una desaparición detectada sí justifica avisar y ofrecer nuevo análisis.
- Omisiones con acceso ya disponible: agregar agrupación por motivo cuando facilite inspección; no convertir la advertencia en sugerencia automática de elevar permisos.
- Anunciar cambios relevantes sin leer cada ruta/segundo. Reservar modales para decisiones que lo requieran; selección y filtros no necesitan confirmación.
- **Aceptación:** pérdida del servicio no borra el resultado; acción sobre ruta ausente orienta a actualizar; un histórico nunca parece vivo.

#### UX7 · Control personal y privacidad — H3/H4/H5

- Añadir «Guardar carpetas recientes» con desactivación y borrado explícitos; acceder a recientes también desde «Nuevo análisis». Esta preferencia no borra archivos del disco.
- Tema Sistema/Claro/Oscuro sobre los tokens existentes, sin reiniciar scan. Mantener idioma de interfaz independiente del locale numérico ya resuelto.
- Antes de persistir informes/listas, mostrar ubicación, límites, cómo borrar/exportar y qué sucede al desinstalar. Conservar la opción de no guardar.
- **Aceptación:** fallos de preferencias no impiden analizar; borrar recientes e historial son operaciones distintas y nombradas. No activar telemetría ni subir logs.

#### UX8 · Rendimiento perceptible como calidad — transversal

- Feedback inmediato del comando y geometría estable durante carga; conservar cancelación y navegación permitida. No añadir animaciones largas para ocultar latencia.
- Evaluar respuesta/consulta/DOM por separado: la paginación visual actual no acota hijos ni trabajo en backend. Usar límites o paginación real si la medición lo exige.
- **Aceptación:** matriz reproducible con datos profundos/anchos, consultas rápidas sucesivas y dos scans. Registrar latencias y memoria por versión; la respuesta al usuario no depende de que termine una consulta global bajo un lock prolongado.

### 4.4 Referencias de calidad y cómo se aplican

“Estándares de la industria” aquí significa criterios comprobables, no copiar una apariencia ni instalar un framework. Las referencias se consultaron el 2026-09-19; los estándares normativos se distinguen de guías y heurísticas.

| Referencia                                                                                                             | Aplicación y criterio de revisión                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [WCAG 2.2, referencia W3C](https://www.w3.org/WAI/WCAG22/quickref/)                                                    | Objetivo AA: teclado sin trampas, foco visible/no totalmente oculto, nombres y estados accesibles; contraste 4,5:1 para texto normal y 3:1 para texto grande/componentes esenciales. Revisar 200 % de texto y reflow a 320 CSS px; las tablas pueden necesitar desplazamiento en su región, no toda la página. Objetivos de al menos 24×24 CSS px o las excepciones/espaciado del criterio 2.5.8. No afirmar certificación por pasar axe. |
| [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)                                                              | Árbol, diálogo y controles compuestos con teclado/foco coherentes. Conservar HTML nativo cuando basta; no convertir la tabla en un `grid` ARIA sin implementar su interacción completa. Probar cierre y retorno de foco.                                                                                                                                                                                                                  |
| [Comandos de Windows](https://learn.microsoft.com/en-us/windows/apps/design/basics/commanding-basics)                  | Acciones frecuentes cerca del objeto; secundarias en menú. Feedback contextual y confirmaciones reservadas a consecuencias importantes. De ahí la propuesta de texto visible para mostrar ubicación y de no modalizar cada paso.                                                                                                                                                                                                          |
| [Navegación de Windows](https://learn.microsoft.com/en-us/windows/apps/design/basics/navigation-basics)                | Destinos claros, estructura simple y migas de pan; nuestra aplicación concreta añade regreso que conserva la consulta y selección.                                                                                                                                                                                                                                                                                                        |
| [Layout Fluent 2](https://fluent2.microsoft.design/layout) y [tipografía](https://fluent2.microsoft.design/typography) | Jerarquía visual, ritmo y adaptación al espacio. Reutilizar escala de 4 px, tipografía rem, tokens y superficies actuales; reducir protagonismo del hero en el área de trabajo, sin imitar WinUI ni cambiar React.                                                                                                                                                                                                                        |
| [Heurísticas de Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/)                                   | Revisar visibilidad del estado, lenguaje reconocible, control, consistencia y recuperación. Son una guía de inspección interna, no prueba de demanda ni sustituto de investigación externa futura.                                                                                                                                                                                                                                        |

**Decisiones de diseño propias, más allá del mínimo normativo:** objetivos cómodos de 32–40 px y 44 px donde se priorice tacto; foco nunca tapado por cabeceras fijas; texto antes que iconos ambiguos; movimiento reducido; ninguna advertencia crítica escondida por compactar el resumen. Verificarlas en el contexto real del producto.

---

## 5. Roadmap orientado a resultados

### 5.1 Objetivo y política de avance desde H3

El recorrido instalar → analizar → encontrar → mostrar ya está implementado. Ahora se busca reducir esfuerzo para **investigar, comparar y revisar**, no volver a construir ese recorrido ni introducir limpieza como destino obligatorio.

Se mantienen las evidencias de H0–H2. H3 se reorganiza en **verificación interna de distribución** y **claridad del área de trabajo**. H4 tendrá un orden definido en lugar de depender de entrevistas. H5 pasa a continuidad/comparación; la limpieza que antes figuraba en H5 se difiere a H7. Se conservan los identificadores F para rastrear ese cambio.

No se fijan fechas sin capacidad estimada. Una entrega principal y, como máximo, una verificación/investigación independiente en paralelo. Un entorno de pruebas no disponible bloquea la afirmación de soporte correspondiente, **no todo el trabajo de diseño o desarrollo siguiente**.

### 5.2 Estado real y evidencia conservada

| Hito                                 | Estado al 2026-09-19                             | Qué sigue                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| H0 · Limpieza y límites              | Cerrado según verificación registrada.           | Mantener regresiones; límites evolucionados en H2.                                                                                                    |
| H1 · Motor, errores y progreso       | Cerrado según verificación registrada.           | Revisar accesibilidad manual pendiente; diálogo nativo ya corregido en H3.                                                                            |
| H2 · Primer hallazgo                 | Cerrado según verificación registrada.           | Integrar ranking/contexto; no rehacer F1a/F2a/F6a/F10/F14a.                                                                                           |
| H3 · Distribución interna y claridad | Instalador y UX de H3b entregados; hito abierto. | H3a: entorno limpio/offline, cuenta estándar y Windows 10 no verificados. H3b: falta la revisión manual con lector de pantalla y alto contraste real. |
| H4 · Encontrar y comprender          | H4a entregado; H4b–d propuestos.                 | H4b: consulta global real. H4a queda sin revisión manual con lector de pantalla, como H3b. Después fechas/categorías y comodidad.                     |
| H5 · Retomar y comparar              | Propuesto.                                       | Resúmenes locales compatibles, comparación, informes y revisión manual.                                                                               |
| H6 · Orientación y precisión         | Propuesto, alcance acotado.                      | Catálogo explicable y precisión Windows verificada.                                                                                                   |
| H7 · Apuestas de mayor riesgo        | Diferido.                                        | Papelera, mapa, monitor e iniciativas sin retorno suficientemente claro.                                                                              |

**Alcance de la evidencia:** las tablas siguientes registran ejecuciones anteriores, conservadas como historial. Esta revisión comprobó código, documentación y capturas existentes; no volvió a ejecutar instaladores, suites ni pruebas manuales. Los pendientes históricos resueltos posteriormente se anotan para no duplicar trabajo.

#### Evidencia de cierre de H0 (2026-09-17)

| Criterio de salida                         | Evidencia                                                                                                                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin referencias activas al código retirado | Búsqueda en el repositorio: solo aparece en metadatos locales del IDE (`.idea/`, ignorado). `tsconfig.json` incluye ahora todo `src`, así que el typecheck cubriría cualquier resto.                                                    |
| Rutas retiradas con la respuesta esperada  | `GET /directory`, `GET /directory?path=…` y `GET /directory/mock` → `404` (prueba `StorageApiTests` y comprobación manual contra el JAR empaquetado).                                                                                   |
| Build y pruebas desde una salida limpia    | Sin `target/` ni `build/`: `mvnw package` con 22 pruebas (21 correctas y 1 omitida porque Windows no permite crear enlaces simbólicos); `tsc`, webpack, 22 pruebas de datos, 10 de escritorio y 18 de UI (Playwright), todas correctas. |
| Dos escaneos simultáneos                   | `runsTwoScansAtOnceAndChargesBothToTheSharedBudget`: los dos workers se esperan mutuamente, así que una ejecución en serie no puede pasar.                                                                                              |
| Evicción por presupuesto                   | `evictsTheOldestSnapshotBeforeExceedingTheSharedMemoryBudget`.                                                                                                                                                                          |
| Cancelación                                | `cancellingMidScanKeepsItsReservationUntilTheWorkerStops`: el worker cancelado conserva su reserva aunque su sesión haya caducado, y la libera al terminar.                                                                             |
| Recuperación tras un error                 | `memoryLimitFailureReleasesItsWorkingTreeAndAllowsAnotherScan` y `stopsAtTheItemLimitWithoutPublishingMisleadingTotals`. Al quitar la liberación del `finally`, dos pruebas fallan (prueba de mutación).                                |
| Carpetas anchas                            | `expandsWideFoldersWithEveryDirectChild` (2.000 hijos directos, sin paginar).                                                                                                                                                           |
| Integración entre procesos                 | Smoke de Electron contra `sa-backend.jar`: 6 archivos reales, sin errores en el renderer.                                                                                                                                               |
| Estimación de memoria                      | Medición puntual: 40.801 entradas con rutas de 150–200 caracteres ocupan unos 510 bytes por entrada; la estimación es de unos 1.350 (unas 2,6 veces conservadora).                                                                      |
| Documentación                              | `modules/backend/README.md` (tabla de límites, qué no cubre el presupuesto y rutas retiradas) y `docs/design-system.md`.                                                                                                                |

**Pendientes detectados, fuera del alcance de H0:**

- **Resuelto en H3; observación histórica de H0:** `tests/electron-smoke.cjs` esperaba textos en inglés, pero Electron toma el idioma del sistema. En un Windows en español falla antes de probar nada. Recargar la página tras fijar el idioma con CDP cierra la ventana, así que hay que resolverlo aparte (por ejemplo, con un perfil `userData` temporal para las pruebas). La verificación de H0 se hizo con una copia temporal adaptada al español.
- ~~**Decisión de producto antes de H2/H3:** con 250.000 entradas, analizar `C:\` completo falla.~~ **Resuelto en H2** con límites derivados del heap (ver evidencia de H2).
- Las respuestas de carpetas anchas se construyen con el lock del servicio tomado y sin paginar. Con los fixtures actuales (2.000 hijos) no bloquean; conviene revisarlas si H2 usa fixtures más anchos.

#### Evidencia de cierre de H1 (2026-09-17)

**Entregado:** F9 + F11 como contrato conjunto (`GET /health` con aplicación y versión de API, códigos estables en errores HTTP, escaneos y nodos), F16a y F8a. F15a queda iniciada.

| Criterio de salida                            | Evidencia                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inicio lento con estado y acción reales       | Electron real con `--start-backend` y el backend real: «Preparando el motor de análisis…» durante 2,8 s, «Conectando…» 0,3 s y después análisis disponibles. Nunca aparece un falso «no responde» (detectado y corregido durante la verificación). Límite de espera de 120 s: `waitForBackend` probado con reloj simulado.                                                                                         |
| Caída del backend                             | Al terminar la JVM a mano: aviso «El motor de análisis se detuvo» en 0,3 s, estado `failed/exited` y análisis bloqueados. **Reintentar** lo vuelve a arrancar en 3,5 s. Con un backend externo reutilizado que se cae, el aviso llega en 6,8 s (se comprueba cada 5 s) y **Reintentar** arranca el motor propio en 3,5 s. En el navegador, los resultados siguen visibles con el aviso de snapshot (prueba de UI). |
| Ambos idiomas                                 | Diccionarios completos en inglés y español, comprobados por el tipo `Dictionary`. Prueba de UI con errores codificados (`ENTRY_LIMIT` con parámetro, `SCANNER_BUSY`) en español y sin el texto inglés del backend. axe sin infracciones en español.                                                                                                                                                                |
| Un puerto ocupado no se confunde con el motor | `probeBackend` probado con servidores HTTP reales: compatible, otra aplicación, otra versión, 404, HTML, puerto cerrado y puerto que no responde. Con Electron real y otro servidor en el puerto 5000: aviso en 0,3 s, nada arrancado y ningún proceso huérfano al cerrar.                                                                                                                                         |
| Versión incompatible y backend externo        | Pruebas de escritorio (`incompatible`, `already-running`) y de UI (`apiVersion: 2`). Una app sin `--start-backend` no arranca nada, ni siquiera al reintentar.                                                                                                                                                                                                                                                     |
| No se abren escaneos sin motor listo          | «Elegir carpeta», «Reanalizar», la bienvenida y el diálogo de ruta quedan desactivados; las pruebas de UI comprueban que no se envía ningún `POST /scans`.                                                                                                                                                                                                                                                         |
| Progreso sin porcentaje inventado             | Tiempo transcurrido congelado al terminar o cancelar (pruebas de backend), carpeta actual, aviso tras 10 s sin elementos y aviso de motor sin respuesta (prueba de UI). Los textos que cambian quedan fuera de las regiones `live`.                                                                                                                                                                                |
| F8a                                           | El resumen dice «tamaño lógico, no espacio en disco», explica compresión, vínculos físicos y archivos solo en la nube, y separa la capacidad de la unidad (o «desconocida»).                                                                                                                                                                                                                                       |
| Formato numérico del sistema                  | El preload recibe `app.getSystemLocale()` (`es-PE` en esta máquina). Pruebas con `es-ES` y la interfaz en inglés (`75,0 %`, `1,00 GB`) y con la interfaz en español y el locale `en-US` (`250,000`).                                                                                                                                                                                                               |
| Regresiones                                   | Backend: 26 pruebas (1 omitida por los enlaces simbólicos). Frontend desde `build/` vacío: `tsc`, webpack sin avisos (paquete inicial de 229 KiB, antes 254 KiB con los diccionarios dentro), 29 pruebas de datos, 22 de escritorio, 32 de UI y smoke de Electron contra el JAR.                                                                                                                                   |
| Seguridad                                     | El IPC nuevo valida el remitente como el diálogo de carpetas; el preload no expone el evento IPC y descarta locales mal formados. Sin telemetría ni envío de datos.                                                                                                                                                                                                                                                |

**F15a iniciada:** se corrigió un fallo previo por el que ninguna regla de la capa `utilities` (alto contraste, `sr-only`) ganaba a `app`: el orden de capas se declaraba en un archivo que llega después de los importados. Ahora la selección del árbol, las barras y los puntos de estado tienen estilos de alto contraste con prueba. axe no puede evaluar el contraste con colores forzados, así que esa regla se omite solo en esa prueba; falta una revisión manual con alto contraste real de Windows.

**Pendientes detectados en H1:**

- **Resuelto en H3:** título y botón del diálogo nativo traducidos mediante textos validados por IPC.
- **Resuelto en H3:** se eliminaron los bordes de filas no seleccionadas bajo colores forzados.
- **Avanzado en H3:** el paquete F19a existe; la ejecución en máquina limpia sigue pendiente, no el desarrollo del instalador.
- **Resuelto en H3:** el smoke dejó de depender del idioma. La adaptación temporal usada en H0/H1 ya no define el procedimiento actual.

#### Evidencia de cierre de H2 (2026-09-19)

**Entregado:** F2a (ranking global), F1a («Mostrar en el Explorador»), F10 mínimo (lista de omitidos), F6a (recientes y carpetas habituales) y F14a (atajos). Además, por petición expresa, el máximo de entradas se calcula según la capacidad del equipo.

**Límite dinámico de entradas.** El presupuesto de snapshots es la mitad del heap máximo de la JVM, que la JVM dimensiona a partir de la RAM (un cuarto por defecto). La estimación por entrada se recalibró midiendo 40.801 entradas con rutas medias de 62, 114 y 234 caracteres (370, 420 y 545 bytes reales): se usa `400 + 1,3 × longitud` (el doble por carácter fuera de Latin-1), con un margen de alrededor del 30 %. El máximo de entradas es el presupuesto dividido por la estimación de una ruta de 120 caracteres, entre 100.000 y 50 millones, y se consulta en `GET /capacity` y en Ajustes.

| Criterio de salida                                                       | Evidencia                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El archivo objetivo de un fixture profundo aparece sin expandir el árbol | Backend: `ranksTheLargestFilesOfTheWholeScanWithoutOpeningFolders` (seis niveles). UI: se comprueba que no se pide ninguna rama. Recorrido real con Electron y el JAR (`tests/electron-first-finding.cjs`): `target.bin` a seis niveles encabeza la lista y solo la raíz está expandida. |
| Nombres duplicados distinguidos por ubicación                            | Backend (`left/copy.bin` y `right/copy.bin`), UI y recorrido real. En ventanas estrechas la ubicación pasa debajo del nombre en lugar de truncarse.                                                                                                                                      |
| Filtros y empates deterministas                                          | Empates por ruta; mínimo inclusivo; límite de 1 a 500 con `400 INVALID_PARAMETER` fuera de rango; conteo de coincidencias aunque se listen 100.                                                                                                                                          |
| Mostrarlo con teclado                                                    | UI: foco y Enter en el botón de la fila. Recorrido real: `shell.showItemInFolder` recibe la ruta canónica del backend.                                                                                                                                                                   |
| Rutas inexistentes y snapshot caducado                                   | Escritorio: `ITEM_MISSING`, `PATH_NOT_IN_SCAN`, `SCAN_NOT_FOUND`, servicio caído y peticiones mal formadas, sin abrir nada. UI y recorrido real: un archivo borrado tras el análisis se explica. Ranking caducado: error traducido.                                                      |
| Seguridad del objetivo                                                   | El proceso principal no confía en la ruta del renderer: la confirma con `GET /scans/{id}/entry` (pertenencia por componentes de ruta, no por prefijo de texto) y comprueba que sigue existiendo. Nunca abre ni ejecuta el elemento.                                                      |
| F10 mínimo                                                               | Lista paginada por ruta con el motivo traducido; `total` cuadra con `skippedCount` y se avisa cuando la lista se truncó (máximo 10.000 registrados).                                                                                                                                     |
| F6a y F14a                                                               | Recientes (5, borrables uno a uno o todos, tolerantes a `localStorage` bloqueado) y carpetas del sistema existentes. Atajos Ctrl+O, F5, Ctrl+F y Alt+←, inactivos al escribir o con un diálogo abierto, anunciados con `aria-keyshortcuts` y listados en Ajustes.                        |
| Escala real                                                              | `C:\` completo de este equipo (48 GB de RAM, heap de 11,8 GiB): **741.495 entradas en 38 s**, 481 omitidas, pico de 651 MiB de memoria del proceso. Antes fallaba al pasar de 250.000. Ranking: 319 ms la primera vez y 65 ms al filtrar. Solo se registraron cifras agregadas.          |
| Regresiones                                                              | Backend: 35 pruebas (1 omitida por los enlaces simbólicos). Frontend: `tsc`, webpack sin avisos (paquete inicial de 235 KiB), 33 pruebas de datos, 26 de escritorio y 42 de UI, más el recorrido real.                                                                                   |

**F15a en las vistas entregadas:** hay pruebas automáticas con colores forzados para la selección, las barras, el control segmentado y la vista de ranking, y axe sin infracciones en inglés, en español, en ventana estrecha y en los diálogos nuevos. **No se hizo la revisión manual con el alto contraste real de Windows ni con un lector de pantalla**, así que F15a no se da por cerrada.

**Pendientes detectados en H2:**

- Desde el ranking no se puede ir a la carpeta que contiene el archivo en el árbol (es F2b).
- Calcular el ranking de un análisis grande bloquea el servicio unos 300 ms la primera vez; mientras tanto, el progreso de otro análisis simultáneo se retrasa.
- **Resuelto en H3:** se añadió prueba del estado de carga del ranking.
- Las carpetas recientes guardan rutas completas en `localStorage` del perfil local; se pueden borrar, pero no hay una opción para no guardarlas.
- **Resueltos en H3:** diálogo nativo, bordes de colores forzados y smoke independiente del idioma. Sí sigue pendiente la revisión manual con lector de pantalla y alto contraste real.

#### Evidencia de H3 (2026-09-19) — hito abierto

**Entregado (F19a y correcciones de H1–H2):**

- Instalador NSIS para Windows x64 (`npm run dist`): por usuario y sin elevación, con Electron, el backend y un runtime de Java 17 recortado con `jlink` (55 MiB, módulos obtenidos con `jdeps`). Pesa 152 MiB y ocupa 396 MiB instalado. Se eligió electron-builder con NSIS tras una prueba acotada; no hubo que migrar el backend.
- La app instalada gestiona siempre su backend y lo arranca con el Java incluido, sin PowerShell ni Maven. El backend vigila el proceso de la app (`storage-analyzer.parent-pid`) y se cierra con ella, incluso si la app se termina a la fuerza.
- Política de datos documentada en [`docs/beta/instalacion-y-datos.md`](docs/beta/instalacion-y-datos.md): idioma y carpetas recientes, más un registro del backend limitado a 5 MB con una copia anterior, todo en `%APPDATA%\Storage Analyzer`. La actualización conserva esa carpeta y la desinstalación la borra. No se envía nada por red.
- Correcciones pendientes de H1–H2: el diálogo nativo de carpetas ya está traducido, las filas no seleccionadas no muestran borde con colores forzados, el smoke de Electron ya no depende del idioma, hay prueba del estado de carga del ranking y el botón de la última columna conserva su anillo de foco.
- Material de evaluación anterior en [`docs/beta/`](docs/beta/README.md): guion y plantilla externa ahora **diferidos**. Se conserva el generador de fixtures para verificación interna; el kit no constituye una obligación de reclutar ni una puerta de salida.

| Criterio de salida técnico               | Evidencia                                                                                                                                                                                                                                                                      | Estado                                                                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin Node, JDK ni Maven                   | `scripts/verify-install.ps1` arranca la app con un `PATH` que solo contiene Windows y sin `JAVA_HOME`: el backend queda listo en 2,8–3,4 s con `resources\runtime\bin\java.exe`. El recorrido de interfaz (`electron-first-finding.cjs`) también pasa contra la app instalada. | Verificado en el equipo de desarrollo, que **sí** tiene esas herramientas instaladas.                                                                                                                                     |
| Máquina limpia                           | `scripts/sandbox/start-sandbox.ps1` ejecuta la misma verificación en Windows Sandbox.                                                                                                                                                                                          | **Pendiente:** Windows Sandbox no está activado en este equipo (hace falta un administrador y reiniciar).                                                                                                                 |
| Sin red para analizar                    | El backend solo escucha en `127.0.0.1` y la app no hace peticiones externas. La configuración de Sandbox desactiva la red.                                                                                                                                                     | **Pendiente** de la ejecución en Sandbox.                                                                                                                                                                                 |
| Arranque y cierre sin procesos huérfanos | Cierre forzado y cierre normal: no queda ningún proceso de Java ni de la app.                                                                                                                                                                                                  | Verificado.                                                                                                                                                                                                               |
| Actualización de prueba                  | De `1.0.0-beta.1` a `1.0.0-beta.2` encima: cambia la versión, se conserva la carpeta de datos y la app actualizada arranca.                                                                                                                                                    | Verificado.                                                                                                                                                                                                               |
| Desinstalación con política de datos     | Elimina la app (0 archivos restantes), `%APPDATA%\Storage Analyzer` y los accesos directos del menú Inicio y del escritorio.                                                                                                                                                   | Verificado.                                                                                                                                                                                                               |
| Rutas con espacios y Unicode             | Instalación en «Storage Analyzer beta ñá» y análisis de una carpeta «… ñá 写真».                                                                                                                                                                                               | Verificado.                                                                                                                                                                                                               |
| Usuario estándar                         | La instalación no pidió elevación y todo se ejecutó sin elevar.                                                                                                                                                                                                                | **Parcial:** la cuenta pertenece al grupo de administradores; falta probar con una cuenta estándar.                                                                                                                       |
| Sin desactivar protecciones              | No hace falta desactivar nada.                                                                                                                                                                                                                                                 | **Con fricción:** el instalador no está firmado, así que un archivo descargado muestra el aviso de SmartScreen (Más información → Ejecutar de todas formas). Hace falta un certificado antes de una distribución pública. |
| Regresiones                              | Backend: 38 pruebas (1 omitida por los enlaces simbólicos). Frontend: `tsc`, webpack sin avisos, 33 pruebas de datos, 29 de escritorio y 43 de UI.                                                                                                                             | Verificado.                                                                                                                                                                                                               |

**Cambio de criterio al 2026-09-19:** no se realizaron sesiones externas y **ya no se requieren por ahora**. No se inventan resultados ni se afirma validación de demanda. La aceptación de producto se sustituye por los recorridos internos de §5.5.

**Pendientes técnicos reales del instalador actual:**

1. Ejecutar `modules/frontend/scripts/sandbox/start-sandbox.ps1` o una VM limpia equivalente, sin red y sin herramientas de desarrollo. Activar Sandbox requiere autoridad administrativa y reinicio; no se hace como parte de una revisión documental.
2. Probar con una cuenta estándar real. Para Windows 10, aportar evidencia o dejarlo como compatibilidad no verificada; no extrapolar desde Windows 11.
3. Completar revisión interna manual con lector de pantalla y alto contraste de Windows.
4. Firma/procedencia antes de distribución pública. No es requisito para diseñar H4 ni para pruebas internas autorizadas; tampoco se pide desactivar protecciones.
5. Aplicar y verificar, en entregas separadas, la consolidación UX añadida a H3. No confundirla con las correcciones del instalador que ya se entregaron.

#### Evidencia de H3b (2026-09-19) — entregado, salida pendiente de revisión manual

**Entregado** en la rama `feat/h3b-workspace-clarity`, con fixtures y sin rutas personales:

- **UX6 · Fecha en el contrato.** `GET /scans/{id}` devuelve `startedAt` y `finishedAt` (ISO-8601; `finishedAt` es nulo mientras analiza y se fija una sola vez). El frontend los valida, los acepta con precisión de nanosegundos y los muestra con el formato regional del sistema. No se deducen de la duración.
- **UX1 · Resultados antes que decoración.** Con resultados, la cabecera grande se sustituye por «Análisis de {carpeta}» con estado, «Analizado el {fecha}», ruta y acciones. Las cuatro tarjetas pasan a una franja: tamaño lógico (con «Tamaño lógico de los archivos, no espacio en disco» siempre visible), archivos, omitidos con su acceso y subcarpetas como dato secundario. La capacidad de la unidad sigue visible; la explicación larga y la aclaración «lectura de ese momento, no supervisión en vivo» están en «Cómo se calculan los tamaños», un `<details>` nativo operable con teclado. La dona va después de la tabla y se oculta con un botón con texto y `aria-expanded`. En la bienvenida, si hay carpetas recientes o habituales, la ilustración cede su sitio y los accesos quedan junto al botón.
- **UX2 · Acciones con alcance.** «Nuevo análisis» (Ctrl+O) sustituye a «Elegir carpeta»; «Volver a analizar {carpeta}» (F5) nombra la raíz. La barra de selección ofrece «Mostrar en el Explorador», «Copiar ruta» y «Ocultar/Mostrar el gráfico» con texto visible. Si el motor se detiene durante un análisis, solo lo explica su aviso: se retiró la alerta duplicada «Conexión interrumpida».
- **UX6 · Estado del resultado.** Etiqueta con texto: «Completo», «Parcial», «Resultados anteriores» (mientras corre otro análisis) o «Conservado del último análisis» (motor no disponible). «Histórico» no se usa porque aún no existe historial.
- **UX7 · Recientes bajo control.** Un botón desplegable junto a «Nuevo análisis» muestra recientes y habituales (`aria-expanded`; Escape, clic fuera o tabular fuera lo cierran y Escape devuelve el foco). Configuración añade «Guardar carpetas recientes»: desactivarlo deja de guardar y oculta la lista **sin borrarla**; «Borrar carpetas recientes» es una operación aparte que anuncia su resultado con un mensaje de estado. Un almacenamiento bloqueado no impide analizar.

**Medición de jerarquía (Chromium, fixture completo, 100 %, inglés):**

| Vista                             | Antes                                                           | Después                                                                             |
| --------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1280 × 720                        | La primera fila empezaba en y = 1200 (página de 1510 px).       | La primera fila termina en y = 679, sin desplazar; página de 1277 px.               |
| 390 × 844                         | La primera fila empezaba en y = 1022, tras 4 tarjetas en 2 × 2. | La primera fila termina en y = 892; resumen de < 200 px y dona después de la tabla. |
| Bienvenida 1280 × 720 con accesos | Accesos rápidos en y = 736, bajo el pliegue.                    | Accesos en y = 534.                                                                 |

Los avisos (parcial, errores) y el zoom pueden aumentar la altura; no se retiraron para ganar espacio.

**Recorridos internos (§5.5).** Operador: automatización con fixtures. No hubo recorrido manual del responsable en esta entrega; se anota como tal.

| Caso | Resultado                | Evidencia y límites                                                                                                                                                                                                                                                             |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | **No ejecutado** en H3b. | Sin cambios en el instalador. Siguen pendientes Sandbox/VM limpia sin red, cuenta estándar y Windows 10 (ver H3).                                                                                                                                                               |
| T2   | Aprobado (automatizado). | Ranking y nombres duplicados en pruebas de UI; `electron-first-finding.cjs` con el JAR nuevo: archivo profundo primero, mostrado con teclado y archivo movido explicado.                                                                                                        |
| T3   | Aprobado (automatizado). | Parcial con advertencia y etiqueta «Parcial»; motor detenido con resultados conservados, etiqueta «Conservado…» y un solo aviso; archivo movido; sesión caducada.                                                                                                               |
| T4   | **Parcial.**             | Automatizado: teclado, axe WCAG 2.2 AA en bienvenida, resultados, menú de recientes, omitidos, errores y español; colores forzados emulados; 390 px y 200 % de texto sin desbordamiento. **No ejecutado:** lector de pantalla (Narrador/NVDA) y alto contraste real de Windows. |
| T5   | Aprobado (automatizado). | Prueba a 1280×720: primera fila, comandos y estado visibles sin desplazar; ayuda de tamaños abierta con teclado; preferencia de recientes respetada tras recargar y borrado aparte.                                                                                             |

**Revisión F15a aplicable:** queda cubierta la parte automatizable. La revisión manual con lector de pantalla y alto contraste real **no se ejecutó** y no se da por aprobada; es la condición pendiente para cerrar H3b.

**Regresiones:** backend 38 pruebas (1 omitida por enlaces simbólicos). Frontend: `tsc`, webpack sin avisos, 35 pruebas de datos, 29 de escritorio y 47 de UI (4 nuevas). Integración real con Electron (`electron-smoke.cjs`, `electron-first-finding.cjs`) contra el backend empaquetado.

**Límites conocidos:** la visibilidad de la dona no se recuerda entre sesiones; la fecha es la del reloj del equipo que analiza; las mediciones de altura son de Chromium en el equipo de desarrollo, no de todas las escalas de Windows.

**Pendientes de H3a registrados como no verificados:** ejecución en Windows Sandbox o VM limpia sin red (Sandbox no está activado en este equipo y activarlo requiere administrador y reinicio), prueba con una cuenta estándar real (la cuenta disponible es administradora), Windows 10 y firma del instalador. No se extrapolan resultados de Windows 11 ni de una cuenta administradora.

#### Evidencia de H4a (2026-09-19) — entregado, revisión manual pendiente

**Entregado** en la rama `feat/h4a-connect-finding` (F2b.1 + UX3/UX5), con fixtures y sin rutas personales:

- **Contrato nuevo, aditivo:** `GET /scans/{id}/ancestors?path=…` devuelve la entrada con su ruta canónica y las carpetas desde la raíz hasta su padre, cada una con sus hijos directos. Una sola petición y un solo snapshot; la pertenencia se comprueba por componentes de ruta, como `entry`. No cambia `apiVersion`: ningún cliente anterior se rompe. El frontend valida que sea una cadena sin huecos (cada carpeta lista la siguiente) antes de usarla.
- **Detalle del hallazgo:** activar el nombre de un archivo del ranking abre su detalle en la misma tarjeta, con regreso explícito y foco en su título: tamaño lógico, proporción de lo medido, posición, carpeta y ruta completa, más «Ver carpeta en el análisis», «Mostrar en el Explorador» y «Copiar ruta» con texto. Una nota recuerda que los datos son de ese análisis.
- **Carpeta contenedora:** «Ver carpeta en el análisis» expande en el árbol solo la cadena que lleva al archivo, selecciona su carpeta, abre la tabla en la página que lo contiene sin filtros que lo oculten, marca la fila con texto («Desde los más grandes»), barra y `aria-current`, y la enfoca. El árbol se desplaza en su propio panel, sin mover la página.
- **Regreso sin pérdida:** «Volver a los archivos más grandes», desde el detalle o desde la carpeta, restaura umbral, fila marcada y enfocada y desplazamiento de la página, sin volver a pedir el ranking.
- **Estado por análisis y ámbito:** umbral y último archivo del ranking, y búsqueda, tipo, orden y página de cada tabla de carpeta, viven en la página y sobreviven a cambiar de vista o de carpeta. Un nuevo análisis los descarta. Una respuesta tardía de otra petición o de otro análisis no cambia la vista actual.
- **Compacto:** el detalle es una vista con regreso explícito y el explorador se abre desde ambas vistas, devolviendo el foco a su botón.
- **Corrección de accesibilidad detectada al probar:** los segmentos de la barra de distribución podían medir menos de 24 px con muchos elementos de tamaño parecido en 390 px (WCAG 2.5.8, detectado por axe con el fixture nuevo). Ahora miden al menos 24 px; la cifra exacta sigue en la tabla. `api.PATH_NOT_IN_SCAN` dice «elemento» en lugar de «carpeta», porque también se aplica a archivos.

**Recorridos internos (§5.5).** Operador: automatización con fixtures. No hubo recorrido manual del responsable en esta entrega.

| Caso | Resultado                | Evidencia y límites                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T6   | Aprobado (automatizado). | Prueba de UI: archivo a seis niveles y en la segunda página de su carpeta; una petición `/ancestors`, ninguna `/directory`, 6 nodos expandidos (raíz y a–e), migas completas, fila marcada y enfocada; al volver, mismo umbral, fila enfocada, desplazamiento a ±2 px y sin nuevo ranking. Igual en 390 px y en español. Recorrido real con Electron y el JAR nuevo (`electron-first-finding.cjs`). |
| T2   | Aprobado (automatizado). | Las pruebas de ranking de H2 siguen pasando con la fila convertida en botón; recorrido real completo.                                                                                                                                                                                                                                                                                               |
| T3   | Aprobado (automatizado). | Carpeta no encontrada: error traducido junto al comando, sin cambiar de vista. Respuesta tardía de un archivo anterior retenida por la prueba: no sustituye la carpeta abierta después.                                                                                                                                                                                                             |
| T4   | **Parcial.**             | Automatizado: teclado y foco, axe WCAG 2.2 AA en detalle, carpeta revelada, compacto y español; contorno de la fila marcada con colores forzados emulados; sin desbordamiento horizontal a 390 px. **No ejecutado:** lector de pantalla (Narrador/NVDA) y alto contraste real de Windows.                                                                                                           |
| T9   | **No ejecutado.**        | `/ancestors` construye bajo el lock del servicio la lista de hijos de cada ancestro, con el mismo coste que pedir cada carpeta por separado. No se midió con carpetas anchas ni con dos análisis; queda para H4b junto con las consultas globales.                                                                                                                                                  |

**Regresiones:** backend 39 pruebas (1 omitida por enlaces simbólicos; 1 de servicio y 1 de API nuevas). Frontend: `tsc`, webpack sin avisos, 36 pruebas de datos (1 nueva), 29 de escritorio y 52 de UI (5 nuevas). Integración real con Electron (`electron-smoke.cjs`, `electron-first-finding.cjs` ampliado) contra el backend empaquetado.

**Límites conocidos:** volver desde la carpeta lleva a la lista, no al detalle abierto; el detalle solo existe para archivos del ranking (la vista de carpeta conserva su ficha de archivo); Ctrl+F en el ranking sigue enfocando la búsqueda del árbol, que en compacto está en un diálogo cerrado (se corrige con H4b); la marca «Desde los más grandes» desaparece al volver al ranking; el estado de vista no se guarda entre sesiones.

### 5.3 Secuencia de entregas

**H0–H2 se conservan como planificación histórica, no como una nueva lista de trabajo.** Su cierre y excepciones constan en §5.2. La revisión manual restante de F15a se traslada expresamente a H3a/b; no se considera aprobada por el cierre de H2.

#### H0 · Base técnica mantenible y acotada — primero

**Resultado:** poder ampliar el producto sin arrastrar rutas obsoletas ni un crecimiento de memoria sin control.

- **Incluye:** retirar frontend heredado y endpoints sin consumidores; preservar `/scans`; limitar entradas, sesiones y memoria estimada compartida; liberar datos de trabajos fallidos/cancelados y explicar límites.
- **Criterios de salida:** ausencia de referencias activas al código retirado; endpoints legacy con respuesta esperada de retirada; build y pruebas desde salida limpia. Verificar dos scans concurrentes, evicción por presupuesto, cancelación, recuperación tras error y carpetas anchas. Documentar que el presupuesto de snapshots no limita por sí solo toda la JVM ni el tamaño de las respuestas.
- **Entrega de mantenimiento:** actualizar guías de API/arquitectura y registrar cambios en Conventional Commits separados por responsabilidad. No añadir funcionalidades F9–F19 dentro de esta limpieza.
- **Decisión posterior:** si las respuestas de carpetas anchas impiden operar con los fixtures acordados, abrir una corrección acotada de paginación/virtualización antes de ampliar consultas; no aumentar límites a ciegas.

#### H1 · El usuario entiende si el motor está listo

**Resultado:** el primer intento no termina en un error engañoso y el análisis comunica actividad.

- **Incluye:** F9 + F11 como contrato conjunto; F16a; avisos de tamaño lógico F8a. Iniciar la verificación transversal F15a.
- **Criterios de salida:** inicio lento y caída del backend tienen estados y acciones reales, en ambos idiomas. No se confunde un puerto ocupado con un servicio compatible; no se abren scans mientras no esté listo. Progreso sin porcentaje inventado.
- **No incluye:** inventario completo de unidades, reinicio elevado ni telemetría.
- **Investigación paralela permitida:** prueba de empaquetado F19a en una máquina limpia; registrar riesgos, no comprometer una migración tecnológica.

#### H2 · Del resultado al primer hallazgo

**Resultado:** encontrar un archivo grande sin explorar nivel por nivel y revisar su ubicación.

- **Orden:** F2a → F1a → F10 mínimo. Añadir F6a y F14a si no desplazan las garantías de cobertura y accesibilidad.
- **Criterios de salida:** el archivo objetivo de un fixture profundo aparece en el top global sin expandir el árbol; nombre duplicado se distingue por ubicación; filtros/empates son deterministas. Una persona puede mostrarlo con teclado, y las rutas inexistentes o el snapshot caducado producen recuperación comprensible.
- **Calidad original de H2:** selección, foco, carga, vacío, error y parcialidad en inglés/español con evidencia automatizada. La revisión manual pendiente de F15a se completa en H3a/b; no se declara cerrada aquí.
- **No incluye:** apertura de ejecutables, papelera, treemap o búsqueda global ilimitada.
- **Demostración de entrega:** recorrido grabado o checklist reproducible desde elegir carpeta hasta mostrar un elemento, usando solo fixtures, no rutas personales.

#### H3 · Consolidar el producto disponible, sin evaluación externa

**Resultado para el usuario:** una app instalable que explica su alcance y deja trabajar con los resultados sin obstáculos innecesarios. No implica ampliar todavía las consultas.

**H3a · Cerrar verificaciones reales, no rehacer el instalador.**

- Ejecutar los pendientes técnicos de §5.2 y registrar entorno, versión, resultado y límites. Se admite VM limpia equivalente a Sandbox.
- Conservar backend empaquetado, runtime, logs acotados, actualización y cierre ya implementados.
- Si un entorno está bloqueado, registrarlo como **no verificado** y acotar soporte. No cerrar esa validación ni detener automáticamente tareas independientes de H4.

**H3b · Mejorar la claridad con las capacidades actuales.**

- UX1: encabezado y resumen compactos; resultados antes de la dona; explicación extensa ampliable, con tamaño lógico/parcialidad siempre visibles.
- UX2: acción de ubicación con texto en la barra/detalle y comandos de alcance claro.
- UX6: identidad temporal del análisis, incorporando fecha explícita al contrato; mensajes de estado sin duplicación.
- UX7: acceder a recientes desde «Nuevo análisis» y ofrecer no guardarlos. No es otra implementación de F6a.
- Cerrar la revisión manual aplicable de F15a; mantener idiomas, locale, estados y teclado existentes.

**Salida:** recorridos internos T1–T5 de §5.5 aprobados en el ámbito declarado; sin defecto bloqueante de datos, seguridad o tarea principal. Pruebas/regresiones y limitaciones documentadas. **Sin participantes, entrevistas ni requisito “4 de 5”.**

**Fuera:** nuevas búsquedas globales, historial, tema claro, papelera, rediseño de marca y publicación pública automática.

#### H4 · Encontrar con precisión y entender el contexto

**Resultado para el usuario:** «Encuentro el elemento que busco, entiendo dónde está y vuelvo a mis resultados sin empezar de nuevo». Es la prioridad funcional siguiente.

| Incremento                  | Entrega                                                                                                             | Criterio de salida observable                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| H4a · Conectar el hallazgo  | F2b.1 + UX3/UX5: selección/detalle, carpeta contenedora, regreso y estado por scan/ámbito.                          | Desde un resultado profundo, abrir su carpeta sin expandir todo el árbol; volver conserva filtros, página, selección, scroll y foco.                |
| H4b · Consulta global real  | F2b.2 + UX4: nombre/ruta/tamaño, ámbito explícito, conteo y páginas acotadas.                                       | Encuentra una coincidencia que no está entre los 500 más grandes ni en ramas cargadas. Ctrl+F siempre enfoca la búsqueda visible del ámbito.        |
| H4c · Explicar y filtrar    | F7 → F5 → F2b.3: modificación, extensión/categoría, conteos y filtros AND en la misma superficie.                   | Categorías reconcilian con bytes observados; elegir una lleva a sus archivos. Fecha desconocida no satisface por accidente un filtro de antigüedad. |
| H4d · Repetir con comodidad | F14c + F6b + F15b: subanálisis independiente, unidades accesibles con fecha de lectura y tema Sistema/Claro/Oscuro. | Analizar subcarpeta no mezcla snapshots; unidad lenta no congela inicio; tema no reinicia análisis ni selección.                                    |

- **Orden:** H4a y H4b primero, después H4c. Entregar cada incremento por separado; no esperar a completar todos para obtener utilidad. H4d es independiente y **no bloquea H5a/b**: unidades, subanálisis y temas pueden ir después de la comparación si la capacidad es limitada. Drag-and-drop F14b también es opcional.
- **Condición técnica:** filtrar todo el ámbito antes de paginar; recalibrar memoria al retener fechas/metadatos. Aislar trabajo de consulta para que no monopolice progreso/cancelación.
- **Control de UI:** mantener dos vistas de trabajo con filtros, no multiplicar pestañas por atributo. Una nueva ruta de navegación debe tener un regreso equivalente.
- **Salida interna:** T6–T9 de §5.5 y regresiones correspondientes. No hace falta una encuesta para decidir si el archivo objetivo aparece o si el estado se conserva.

#### H5 · Retomar, comparar y organizar lo que revisar

**Resultado para el usuario:** «Puedo volver mañana y ver qué cambió, sin repetir todo el razonamiento». **Valor esperado:** continuidad y motivo de uso recurrente, no retención demostrada.

**Entrada:** contrato de snapshot estable, contexto navegable y metadatos de informe definidos. No requiere terminar H4d ni disponer de todas las categorías o fechas de archivo; estas últimas no son requisito para comparar tamaños agregados.

1. **H5a · F4a:** guardar resúmenes locales de forma voluntaria y acotada. Lista con raíz, fecha, cobertura, tamaño y «Analizar de nuevo». Diferenciar recientes (rutas) de historial (informes).
2. **H5b · F4b:** comparar dos informes compatibles; ordenar por crecimiento absoluto y mostrar signo/texto además del color. Separar desconocido, no observado y cero. No comparar profundidades/exclusiones distintas como si fueran iguales.
3. **H5c · F13a + F20:** exportación del alcance anunciado y lista manual de archivos para revisar. Quitar de una lista no elimina un archivo. Guardado, retención y limpieza local explícitos.

- **UX:** agregar «Historial» solo cuando haya persistencia real; estado vacío con «Guardar este análisis», no tarjetas vacías de funciones futuras. Comparación identifica ambos momentos y permite volver al informe.
- **Política de datos:** definir qué se conserva al actualizar y qué se elimina al desinstalar; hoy se borra AppData. Informarlo y ofrecer exportación antes de depender de datos persistentes. No cambiar silenciosamente esa política.
- **Salida interna:** fixture antes/después con crecimientos conocidos, rama inaccesible, reinicio, corrupción y migración de esquema; lista/exportación sin duplicados de ruta ni metadatos privados fuera del modo elegido.
- **Fuera:** árbol completo persistente, sincronización, monitor, detección de renombrados y cifras de espacio “liberado” calculadas por diferencia de tamaños lógicos.

#### H6 · Orientar la revisión con evidencia, sin limpiar automáticamente

**Resultado para el usuario:** «Entiendo por qué merece la pena revisar esto y qué limitaciones tiene la recomendación».

- **H6a · F3:** catálogo inicial pequeño sobre carpetas del usuario: regla, evidencia, fecha y motivo visible. Inspeccionar, ignorar o añadir manualmente a F20. No etiquetas de “seguro para borrar”.
- **H6b · F8b/c:** investigación Windows acotada y, solo tras demostrarla, tamaño en disco/estado de disponibilidad para casos soportados. Representar desconocidos y no descargar contenidos de nube durante inspección.
- **Criterios de salida:** fixtures positivos, contraejemplos y solapamientos; agregados sin doble conteo; cobertura declarada; efecto de cada regla explicable. Matriz de precisión para placeholders, compresión, sparse y enlaces físicos sin asumir igualdad con tamaño lógico.
- **Decisión interna:** comparar el recorrido manual de H4/H5 con el asistido por reglas; mantener una regla solo si reduce pasos en un caso realista sin exceder lo que su evidencia permite concluir.
- **Fuera:** operar sobre carpetas del sistema, elevar toda la app, borrar o abrir ejecutables automáticamente. F1b puede investigarse aparte con política explícita, no es requisito de orientación.

#### H7 · Apuestas posteriores y acciones de mayor riesgo

- **F1c, papelera individual:** solo con diseño de identidad/revalidación, ubicaciones permitidas, sincronización, confirmación y recuperación. Desactivada por defecto; sin fallback de borrado permanente, descuento ciego de snapshots ni promesa de liberar bytes al enviar a papelera.
- **F12, treemap:** comparar mediante tareas internas con ranking/tabla. Si solo añade atractivo y no ayuda a identificar concentración o contexto, no priorizarlo.
- **F17, monitor:** opcional y explícito, con consumo y frecuencia acotados. Historial no necesita un servicio permanente.
- **F13b, snapshots completos y precisión ampliada:** solo si el alcance actual deja una tarea concreta sin resolver.
- **F18, MFT, cuentas, sincronización y móvil:** fuera del plan activo. No retomar por tendencia; requerir problema, coste y privacidad definidos.

**Regla de alcance:** la participación externa permanece diferida; ninguna de estas iniciativas la exige ahora. Eso no convierte estimaciones internas en prueba de demanda ni elimina revisiones de seguridad.

### 5.4 Definición de terminado compartida

1. Incremento marcado como implementado solo cuando sus tareas y casos límite tienen evidencia reproducible. Distinguir ejecuciones actuales de tablas históricas.
2. Estado/alcance/cobertura coherentes entre UI, DTO, API y datos guardados; nunca desconocido = cero, top-N = búsqueda exhaustiva ni histórico = dato vivo.
3. Inglés/español, locale independiente, teclado, foco, contraste y adaptación según §4.4. Complementar axe con revisión interna manual; registrar lo no verificado.
4. Regresiones pertinentes de backend, datos, escritorio, UI, TypeScript y build; integración real si cambia el contrato entre procesos. No reconstruir el instalador si el cambio es solo documental.
5. Matriz de rendimiento con hardware/heap/versión, árboles profundos/anchos y dos scans. Presupuestos de consulta, payload y DOM, no solo memoria de snapshots; comparar contra una línea base registrada.
6. Persistencia/IPC/privacidad revisados. Ningún envío de rutas, logs, contenido o métricas por defecto. Las nuevas mutaciones requieren una revisión específica, no basta pasar las pruebas de lectura.
7. Actualizar contrato, guías, evidencia y estado del roadmap; Conventional Commits pequeños. Una función propuesta o un protocolo escrito no equivale a una verificación ejecutada.
8. **No hay requisito de participantes externos.** El equipo puede cerrar calidad funcional y técnica; no puede atribuirse satisfacción, adopción o demanda que no haya medido.

### 5.5 Evaluación interna por tareas — reemplaza las sesiones externas

No se recluta ni contacta a nadie. El responsable de desarrollo/producto realiza recorridos como operador interno y los complementa con automatización, inspección heurística y revisión accesible. Se reutilizan fixtures del repositorio; no se exploran carpetas personales para producir evidencia.

#### Matriz de aceptación propuesta

| Caso | Tarea y escenario                                                                                                | Resultado verificable / hito                                                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Instalar/abrir/cerrar/actualizar/desinstalar sin toolchain; limpio/offline y cuenta estándar.                    | Backend incluido, sin procesos huérfanos y política de datos cumplida. H3a; entorno no disponible se registra como pendiente.                               |
| T2   | Analizar fixture profundo y hallar un archivo conocido, nombres duplicados incluidos.                            | Ranking correcto, ubicación distinguible y acción de Explorador por teclado. Regresión H2 y claridad H3b.                                                   |
| T3   | Análisis parcial, servicio caído, ruta movida y snapshot caducado.                                               | Cobertura visible, resultado conservado cuando procede y recuperación contextual. H3.                                                                       |
| T4   | Repetir tarea con teclado/lector de pantalla, colores forzados, 200 % de texto, compacto y zoom/reflow.          | Controles y foco alcanzables, texto comprensible y resultados operables. H3 y cada nueva vista.                                                             |
| T5   | Consultar resultados a 1280×720; abrir ayuda de tamaños; no guardar recientes.                                   | Primeras filas visibles en caso completo normal, advertencia esencial presente y preferencia respetada. H3b.                                                |
| T6   | Abrir contenedor del resultado profundo y volver, también en compacto.                                           | Mismo filtro, página, fila, scroll y foco; sin expansión masiva. H4a.                                                                                       |
| T7   | Buscar coincidencia fuera del top 500; combinar texto/tamaño/tipo/fecha; cambiar consulta rápidamente.           | Filtrado global correcto, conteo fiable, ámbito claro y sin respuestas tardías que reemplacen la consulta actual. H4b/c.                                    |
| T8   | Analizar subcarpeta, cambiar tema y seleccionar una unidad ausente/lenta.                                        | Sin mezcla de scans, pérdida de estado ni bloqueo global. H4d.                                                                                              |
| T9   | Carpeta ancha, snapshot grande y dos scans mientras se consulta y cancela.                                       | Medir memoria/latencia/DOM; progreso y cancelación no quedan retenidos por consultas largas. H4 y regresiones.                                              |
| T10  | Guardar/reabrir/comparar fixtures antes/después y uno parcialmente inaccesible.                                  | Delta conocido, incompatible explicado, desconocido distinto de cero; corrupción recuperable. H5a/b.                                                        |
| T11  | Marcar archivo, exportar rutas reducidas, reiniciar, sustituir el archivo en la misma ruta y quitar de la lista. | Anotaciones recuperables; ninguna asociación automática con el sustituto; vista previa acotada y exportación fiel al alcance; sin cambios en archivos. H5c. |
| T12  | Reglas con contraejemplos y archivos de disponibilidad/precisión diversas.                                       | Motivo explicable, sin doble suma, descarga involuntaria ni recomendación de borrado automático. H6.                                                        |

#### Métricas de trabajo, no de demanda

| Dimensión               | Registro interno                                                                                         | Interpretación permitida                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Correctitud             | Esperado/obtenido por fixture: filas, bytes, fechas, diferencias y omisiones.                            | La función resuelve los casos ensayados.                                   |
| Esfuerzo de interacción | Comandos, cambios de vista y pasos repetidos de cada tarea.                                              | La propuesta reduce recorrido; no demuestra satisfacción general.          |
| Continuidad             | Pérdidas de consulta/selección/foco al ir y volver.                                                      | Objetivo: cero pérdidas no solicitadas en el recorrido definido.           |
| Jerarquía visual        | Captura con resolución/zoom/idioma, primera fila y comando principal identificados.                      | Comprobar UX1 sin atribuir “facilidad” a usuarios no observados.           |
| Rendimiento             | Primera consulta y cacheada, p50/p95 con repeticiones declaradas, memoria pico, respuesta a cancelación. | Comparación en el mismo entorno; no extrapolar del equipo de 48 GB a otro. |
| Confianza y privacidad  | Campos persistidos/exportados, capacidades comprobadas y fallos explicados.                              | Evidencia de control de datos, no promesa de riesgo cero.                  |

**Protocolo:** anotar versión/commit, entorno, fixture, pasos, esperado/obtenido, evidencia y defecto. Separar «aprobado», «falló», «no ejecutado» y «no soportado». Mantener capturas agregadas y datos sintéticos; no enviar telemetría.

**Puerta interna:** todas las tareas aplicables al incremento pasan en los entornos declarados; ningún defecto bloqueante de datos/seguridad/operación principal; fallos restantes tienen gravedad y decisión explícitas. No se cuenta “no ejecutado” como aprobado. Los objetivos de tiempos se fijan antes de cada cambio a partir de la línea base, no después para hacer pasar el resultado.

**Límite honesto:** esta revisión interna no mide adopción, retención ni preferencia de mercado. Las hipótesis de valor se mantienen como hipótesis. El guion y la plantilla externos de `docs/beta/` quedan diferidos; se podrán reactivar únicamente mediante una decisión posterior, sin bloquear H3–H7 ahora.

### 5.6 Riesgos, decisiones y siguiente paso

| Decisión                      | Criterio interno disponible ahora                                                           | Consecuencia                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Soporte Windows/volúmenes     | Ejecución real de T1/T8, no solo configuración de empaquetado.                              | Acotar lo declarado y registrar matriz pendiente.                     |
| Arquitectura de consultas     | T7/T9, top cacheado frente a snapshot completo y presupuesto de locks/DOM.                  | Corregir acotación antes de añadir más filtros/gráficos.              |
| Persistencia y retención      | T10/T11 con límites, corrupción, desinstalación y borrado voluntario.                       | Entregar F4/F20 sin guardar rutas silenciosamente.                    |
| Reglas útiles                 | T12 y contraejemplos documentados; pasos que evita cada regla.                              | Mantener catálogo pequeño y explicable.                               |
| Necesidad de mutaciones       | Identificar una tarea concreta no resuelta con inspección/Explorador y demostrar seguridad. | Papelera permanece diferida; no es meta obligatoria.                  |
| Preferencia/impacto comercial | No hay estudio externo ni datos longitudinales ahora.                                       | No justificar prioridades con conversiones o satisfacción inventadas. |

**Siguiente paso recomendado:** H4a (conectar ranking, detalle y carpeta sin perder contexto) está entregado con verificación automatizada. Lo siguiente es **H4b: consulta global real** (nombre/ruta/tamaño sobre todo el análisis, ámbito visible y Ctrl+F hacia la búsqueda visible), con la medición T9 de consultas bajo el lock del servicio. Siguen abiertos, en paralelo y sin bloquear H4b, los pendientes de H3a y la revisión manual con lector de pantalla y alto contraste real de H3b y H4a.

Esta revisión actualiza el plan y sus criterios; no autoriza implementar automáticamente todas las funcionalidades ni publicar o distribuir el producto.
