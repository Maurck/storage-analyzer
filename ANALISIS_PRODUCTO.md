# Storage Analyzer: análisis de producto, UX y UI

> Fecha: 2026-09-17 · Alcance: todo el repositorio (`modules/backend`, `modules/frontend`, `docs/`, scripts de arranque).
> Las suposiciones sobre usuarios o negocio se marcan con **[Suposición]**.
> Revisión del plan: funcionalidades divididas en entregas pequeñas, dependencias explícitas y roadmap por hitos verificables. Las propuestas no describen capacidades ya implementadas.

### Cómo leer este documento

- **Observado:** comportamiento o estructura comprobable en el repositorio.
- **Propuesto:** decisión de producto recomendada, pendiente de implementación y validación.
- **[Suposición]:** hipótesis sobre usuarios, impacto o demanda; no equivale a evidencia de uso.
- **Estado de ejecución:** H0 (limpieza técnica y límites) y H1 (motor listo, errores traducibles y progreso) están **cerrados y verificados** a fecha 2026-09-17; la evidencia figura en §5.2. H2 y los hitos posteriores siguen sin empezar.

---

## 1. Qué es el producto hoy

### Propuesta de valor

Una app de escritorio (Electron + API Java local) que **analiza el tamaño lógico de los archivos de una carpeta**. El análisis ocurre en el equipo y solo lee metadatos; no modifica los archivos. La interfaz está en inglés y español, cuenta con navegación por teclado y un árbol ARIA, y tiene WCAG 2.2 AA como objetivo, no como certificación. El formato de tamaños busca seguir al Explorador de Windows, pero tamaño lógico, tamaño en disco y espacio recuperable son conceptos distintos.

### Qué problema resuelve

"Me estoy quedando sin espacio y no sé por qué." Compite en la misma categoría que WinDirStat, WizTree, TreeSize o SpaceSniffer.

### Usuario probable

- **[Suposición]** Usuario de Windows con conocimientos medios: gamers, creadores de contenido o desarrolladores con discos llenos, además de algún técnico de soporte que diagnostica equipos ajenos.
- **[Suposición]** Hoy es un proyecto personal o de código abierto sin monetización. En este documento, "valor para el negocio" significa adopción, retención, diferenciación frente a las alternativas y reputación del proyecto.

### Flujo principal actual

```
Abrir app → Bienvenida → "Elegir carpeta" (diálogo nativo)
  → Escaneo (spinner + contadores, cancelable)
  → Resumen (4 métricas) + aviso de parcialidad
  → Explorador en árbol (izq.) | Migas de pan + dona top-5 + tabla de contenidos (der.)
  → Navegar carpeta por carpeta
```

### Lo que ya está bien resuelto (y conviene conservar)

- Estados del sistema muy trabajados: carga, vacío, error con acción de recuperación, parcial (con "≥" en los tamaños), sesión expirada y cancelación que conserva los resultados anteriores.
- Bases de accesibilidad: árbol con búsqueda por tecleo (type-ahead), separador redimensionable con teclado, `aria-sort`, diálogos nativos y enlace para saltar al contenido. Falta validar tecnologías de asistencia y alto contraste de manera sistemática.
- Aislamiento de Electron: `contextIsolation`, `sandbox`, CSP e IPC acotado. Añadir acciones sobre rutas exigirá revisar ese límite de seguridad.
- Formato de tamaños centralizado y probado (`shared/lib/format.ts`), aunque la política de locale aún debe resolverse.
- La arquitectura del backend (snapshot en memoria y expansión bajo demanda) permite proponer consultas globales sin releer el disco. Esas consultas también necesitan límites de memoria, trabajo y respuesta.

### Dirección de producto propuesta

**[Suposición de segmento inicial]** Usuario de Windows que quiere identificar un archivo o carpeta grande y revisar su ubicación sin aprender la estructura completa del disco. Soporte técnico y usuarios recurrentes son segmentos secundarios hasta validarlos.

El primer resultado útil será **«instalar → analizar una carpeta → encontrar un elemento relevante → mostrar su ubicación»**. La beta inicial seguirá siendo de análisis: sin borrado, cuentas, servicios en la nube ni IA. Primero se valida ese recorrido; después se decide entre profundizar el análisis, comparar históricos o incorporar acciones de limpieza.

---

## 2. Diagnóstico crítico: fricciones y huecos

### 2.1 El producto termina justo donde empieza la necesidad del usuario

Hoy, cuando encuentra un elemento relevante, el usuario solo puede copiar su ruta (`StorageAnalysisPage.tsx`, `copyPath`): no puede mostrarlo en el Explorador, abrirlo ni enviarlo a la papelera desde la app. **[Suposición]** Parte del público quiere liberar espacio, no solo comprenderlo. Mostrar la ubicación permite probar esa necesidad con menor riesgo; no implica que el producto deba incorporar borrado propio.

### 2.2 La bienvenida promete algo que la app no cumple

`WelcomeState` anuncia **"Encontrar archivos grandes"**, pero la tabla solo muestra los hijos directos de la carpeta seleccionada. Para encontrar un archivo de 20 GB que está 6 niveles más abajo hay que bajar nivel por nivel. La búsqueda del árbol dice "Buscar en elementos cargados", así que el usuario tiene que haber abierto antes la rama donde está lo que busca.

### 2.3 Barrera de instalación enorme

Para usarla hace falta Node, `npm ci`, `npm run build`, JDK 17 exacto y Maven (ver `start-backend.ps1`). No hay instalador. Fuera de Windows, el backend ni siquiera se arranca solo (`backend-process.js` devuelve `unsupported-platform`). **[Suposición]** Si el público objetivo no es desarrollador, hoy casi nadie de ese público puede instalarla.

### 2.4 Arranque en frío con un mensaje de error engañoso

> **Resuelto en H1:** la interfaz espera a que `/health` responda, explica el estado del motor y solo reintenta a petición de la persona.

`main.js` abre la ventana antes de que la JVM termine de arrancar. Si el usuario elige una carpeta enseguida, recibe _"No se pudo conectar con el servicio local de análisis. Inicia el backend e inténtalo de nuevo"_. Le pide que haga algo que la propia app ya está haciendo. No hay un estado de "Preparando el motor de análisis…".

### 2.5 El tamaño lógico puede engañar

- **[Suposición a verificar]** Los archivos de OneDrive "solo en la nube" (placeholders) informan su tamaño lógico completo sin ocupar disco. Un usuario con 80 GB en OneDrive verá 80 GB "ocupados" que en realidad no puede liberar localmente.
- Los enlaces duros y los archivos comprimidos o dispersos (sparse) tampoco se distinguen.
- La app no muestra **capacidad ni espacio libre de la unidad**, que es la cifra que el usuario tiene en la cabeza ("me quedan 3 GB").

### 2.6 Los resultados son efímeros

Las sesiones viven en memoria y se pierden al reiniciar (`ScanService`). Desde H0 se retienen como máximo 3 y comparten un presupuesto de memoria estimado que puede hacerlas caducar antes. No hay historial ni comparación entre escaneos. La pregunta «¿qué ha crecido desde la última vez?» no tiene respuesta; que sea una necesidad recurrente del segmento inicial es una hipótesis por validar.

### 2.7 Pocas dimensiones de análisis

Solo se muestran nombre, tipo, tamaño y porcentaje. Faltan:

- **Fecha de modificación**, para encontrar elementos antiguos; no demuestra que no se usen. La fecha de acceso no se incluye en el alcance inicial.
- **Extensión o categoría** (vídeo, instaladores, archivos comprimidos, cachés de desarrollo).
- **Número de elementos por carpeta** en la tabla (el dato existe en `fileCount`, pero no se muestra).

### 2.8 Internacionalización incompleta

> **Resuelto en H1**, salvo el título y el botón del diálogo nativo de carpetas, que siguen en inglés (ver pendientes de H1). Los números siguen el formato regional del sistema.

- Los mensajes de error del backend llegan en inglés (`ScanService`). En la interfaz en español, el usuario ve _"This path could not be read…"_ en los errores de rama, en los nodos del árbol (`node.error`) y en los fallos de escaneo.
- Hay textos fijos en inglés: `Spinner` y `Button` (`"Loading"`), `DirectoryTree.tsx` (`` `Loading ${node.name}` ``) y `formatBytes` (`"Unavailable"`).
- `formatNumber` usa `en-US` fijo (`1,234`), mientras que `docs/design-system.md` dice que los números "siguen al sistema operativo". Un usuario hispanohablante con Windows en español ve `1.234` en el Explorador y `1,234` aquí. **Hay que decidir qué regla vale y aplicarla de forma coherente.**

### 2.9 Solo hay tema oscuro

> **Parcialmente atendido en H1 (F15a iniciada):** las reglas de alto contraste ya se aplican y tienen prueba. El tema claro (F15b) sigue pendiente.

`index.html` declara `color-scheme: dark` y no existe un tema claro. Tampoco se ha verificado el modo de alto contraste de Windows (`forced-colors`), un fallo relevante para un producto que se presenta como accesible.

### 2.10 El progreso del escaneo dice poco

> **Resuelto en H1 (F16a):** tiempo transcurrido, carpeta actual, aviso de periodos sin actividad y aviso de motor sin respuesta, sin porcentajes.

Es indeterminado a propósito (correcto según el design system), pero ni siquiera muestra el tiempo transcurrido ni la carpeta que se está leyendo. En escaneos de varios minutos, el usuario no sabe si la app se ha colgado.

### 2.11 Otras fricciones menores

- No se puede **reescanear solo la subcarpeta** seleccionada: "Reescanear" recorre toda la raíz otra vez.
- No hay atajos (`Ctrl+O`, `Ctrl+F`, `F5`) ni arrastrar y soltar carpetas.
- No hay lista de **carpetas recientes** ni **unidades** en la bienvenida: siempre hay que pasar por el diálogo nativo.
- La tabla tiene paginación fija de 25 elementos y no permite filtrar por tamaño mínimo.
- La dona usa colores fijos en el código (`SpaceDistribution.tsx`), no los tokens, y solo muestra el top 5.
- Las métricas del resumen incluyen textos de relleno ("Una jerarquía para explorar") que podrían ser datos útiles (la carpeta más grande, el archivo más grande).
- El contador de "elementos omitidos" no lleva a ninguna parte: falta una lista de motivos y rutas. Elevar permisos no debe ser la respuesta automática a esta carencia.
- El backend admite 2 escaneos simultáneos, pero la interfaz solo gestiona uno.
- Robustez (resuelto en H0): el límite anterior de 100 millones de entradas y 5 sesiones era desproporcionado para snapshots en memoria. Ahora hay 250.000 entradas por escaneo, 3 sesiones y un presupuesto estimado compartido de `min(256 MiB, heap máximo / 4)`, con pruebas de concurrencia, cancelación, evicción, recuperación y carpetas anchas. **Consecuencia de producto:** analizar una unidad de sistema completa (normalmente más de 250.000 entradas) falla con un mensaje que pide elegir una carpeta más pequeña. El presupuesto no limita el consumo total de la JVM ni el tamaño de las respuestas de carpetas anchas.

### 2.12 Deuda que afecta a la evolución del producto

La revisión inicial identificó código heredado sin uso: `src/components/**`, `src/services/**`, `src/hooks/directories.hooks.ts`, `src/models/**`, `src/icons/**`, `src/enums/**`, los estilos ITCSS antiguos, los endpoints `/directory` y `/directory/mock`, `DirectoryService` y `RandomDirectoryGenerator`. **Retirado en H0**; los contratos de `/scans` se mantienen sin cambios y las rutas retiradas responden `404`.

---

## 3. Funcionalidades propuestas

### Reglas de alcance

- Se conservan los identificadores F1–F18 para mantener trazabilidad; F19 formaliza la distribución que antes solo figuraba en el roadmap.
- **MVP** es la primera entrega útil de cada propuesta, no la obligación de incluirla en la primera versión del producto.
- Complejidad **B / M / A** significa baja / media / alta relativa. Incluye interfaz, API, pruebas y seguridad; no representa días de trabajo.
- El impacto indicado es **esperado, no medido**. No se asignan puntuaciones RICE sin datos de alcance y confianza.
- Cada entrega debe definir qué queda fuera y cómo se comprueba que funciona. Los contratos y endpoints descritos son propuestas, no una API existente.

### F1. Acciones separadas por riesgo: mostrar, abrir y enviar a la papelera

**Necesidad:** pasar de identificar un elemento a revisarlo o actuar sobre él. **Impacto esperado: alto.**

- **F1a · MVP de la beta:** «Mostrar en el Explorador» para el elemento seleccionado, con un botón visible y accesible. El menú contextual puede llegar después; no debe ser el único acceso.
- **F1b · Ampliación:** «Abrir con la aplicación predeterminada». Requiere una decisión explícita del usuario y una política para ejecutables, scripts, accesos directos y tipos desconocidos. Nunca abrir automáticamente al seleccionar una fila.
- **F1c · Iniciativa posterior:** envío individual a la papelera, desactivado por defecto. Confirmar nombre, ruta completa y tamaño observado, indicando cuándo se midió. Bloquear objetivos fuera del alcance autorizado, raíces y ubicaciones protegidas; rechazar cambios de identidad y enlaces que redirijan a otro destino.
- **Contrato de seguridad:** validar emisor IPC y objetivo en el proceso privilegiado; no confiar en una ruta arbitraria del renderer ni en una comparación de prefijos de texto. Revalidar existencia y pertenencia al análisis. Para mutaciones, diseñar además la identidad del archivo y la carrera entre validación y operación. El modo navegador no debe simular que estas acciones nativas están disponibles.
- **Aceptación:** la acción apunta al elemento seleccionado; rutas desaparecidas, permisos y errores de apertura se explican sin cerrar la app. Cancelar la confirmación no produce efectos. Una operación fallida nunca se muestra como exitosa ni recurre a borrado permanente.
- **Consistencia:** después de una mutación, marcar el análisis como desactualizado y ofrecer reescaneo. No restar a un snapshot inmutable tamaños que podrían haber cambiado. «Enviado a la papelera» no significa «espacio liberado»: no contabilizar bytes lógicos como espacio libre recuperado.
- **Fuera del MVP:** selección múltiple, vaciado de papelera, ajuste incremental del árbol y restauración automática. «Deshacer» necesita una prueba de viabilidad que cubra conflictos de nombre y recuperación tras reiniciar; no se promete antes.
- **Dependencias y esfuerzo:** F1a, B–M, sobre selección existente; no depende de F2. F1b, M, tras política de apertura. F1c, A, condicionada a F8 acotada, revisión de seguridad y validación con usuarios.

**Base técnica verificada:** Electron permite mostrar una ruta, abrirla y enviarla a la papelera; `openPath` puede devolver un mensaje de fallo. Su API `shell` no documenta una operación inversa de restauración. Estas capacidades no resuelven por sí solas el flujo seguro del producto. [Documentación de shell](https://www.electronjs.org/docs/latest/api/shell). La validación del emisor de IPC también forma parte de las recomendaciones oficiales. [Seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages).

### F2. Los archivos más grandes de todo el análisis

**Necesidad:** encontrar un archivo grande sin abrir sus carpetas antecesoras. **Impacto esperado: alto. Complejidad: M.**

- **F2a · MVP:** vista «100 archivos más grandes del análisis», con nombre, tamaño lógico y ruta relativa a la raíz. Conmutador «Esta carpeta | Más grandes del análisis»; filtro mínimo en bytes con accesos rápidos equivalentes a 100 MB y 1 GB según la política de unidades de la app.
- **Contrato propuesto:** `GET /scans/{id}/largest?limit=100&minSizeBytes=...`, solo archivos en la primera entrega. Validar y acotar parámetros; ordenar por tamaño descendente y desempatar por ruta. Responder con identificador de scan y cobertura completa/parcial. Calcular un top-N acotado, sin copiar u ordenar todo el snapshot si no hace falta.
- **Aceptación:** encuentra un archivo situado seis niveles abajo aunque el árbol esté contraído; abrir ramas no cambia el ranking. Probar empates, cero bytes, cero coincidencias, límites exactos del filtro, análisis parcial y sesión caducada. La etiqueta dice «del análisis», nunca «de todo el disco» si no se analizó todo.
- **UI:** reutilizar primitivas de tabla y selección sin forzar el contrato de hijos directos. Mostrar ubicación incluso con nombres duplicados. El top 100 es un límite visible, no una supuesta lista completa.
- **F2b · Después:** búsqueda global por nombre/ruta en el mismo snapshot, paginación acotada y navegación al contenedor con carga de ancestros. Las carpetas agregadas irían en una vista separada: sumarlas junto a descendientes duplica tamaños.
- **Fuera del MVP:** deduplicación por contenido, búsqueda en el disco en tiempo real, carpeta+archivo en un mismo total y expansión masiva del árbol.
- **Dependencias:** H0 validado y contrato de errores F11. F1a complementa el hallazgo, pero no bloquea calcular el ranking.

### F3. Elementos para revisar, con reglas locales explicables

**Necesidad:** ayudar a interpretar resultados sin afirmar que algo se puede borrar por su nombre. **Impacto esperado: alto, con baja confianza hasta validar usuarios. Complejidad: M–A.**

- **MVP:** catálogo pequeño, versionado y probado de candidatos en carpetas del usuario. Cada coincidencia muestra regla, evidencia, tamaño observado y una explicación de qué revisar. Empezar, por ejemplo, por instaladores antiguos en Descargas y archivos grandes sin modificación reciente; no tratarlos como prescindibles.
- **UI:** «Elementos para revisar», no «Limpieza segura» ni «Espacio recuperable garantizado». Informar cobertura parcial y evitar sumar una carpeta y sus descendientes dos veces.
- **Aceptación:** una regla por antigüedad utiliza fechas válidas; lo desconocido no se transforma en antiguo. Hay pruebas de falsos positivos y de solapamientos. El usuario puede inspeccionar e ignorar sugerencias; ninguna ejecuta acciones por sí sola.
- **Fuera del MVP:** borrado automático, reglas sobre `Windows.old`, `WinSxS`, papelera o cachés activas; limpieza de dependencias solo por llamarse `node_modules` o `.venv`. Para mantenimiento del sistema, derivar a herramientas del sistema en vez de simular sus garantías.
- **Dependencias:** F7 para antigüedad, F10 para explicar cobertura y F1a para inspección. F5 puede enriquecer categorías, pero no es obligatoria. **No depende de implementar papelera.**
- **Decisión de continuidad:** mantenerla solo si un catálogo pequeño ayuda a decidir y puede mantenerse; medir comprensión y falsos positivos, no solo cantidad de candidatos.

### F4. Historial de resúmenes y comparaciones compatibles

**Necesidad:** responder «¿qué cambió desde el último análisis?». **Impacto esperado: alto para uso recurrente, demanda pendiente de validar. Complejidad: M–A.**

- **F4a · MVP:** guardar resúmenes locales acotados: raíz e identidad disponible del volumen, fecha, versión de esquema, criterio de tamaño, alcance/exclusiones, cobertura y agregados por carpeta con profundidad/límite declarados. Propuesta inicial: 10 informes o 20 MiB, lo que se alcance primero; ajustar con mediciones.
- **Contrato de UX:** un resumen histórico permite consultar lo guardado, **no reconstruir todo el árbol** ni evitar la caducidad de sesiones activas. Mostrar fecha, cobertura retenida y «Histórico»; ofrecer reescaneo para datos actuales.
- **F4b · Comparación:** comparar resúmenes compatibles de la misma raíz y alcance. Diferenciar «nuevo», «ya no observado» y «no comparable»; una rama inaccesible no vale cero. Presentar crecimiento/disminución de tamaño lógico, no limpieza confirmada.
- **Aceptación:** persistencia tras reinicio, escritura atómica, lectura de archivos corruptos sin bloquear el arranque, versión incompatible explicada y opción de borrar historial. No deducir desapariciones fuera de la profundidad guardada. Probar análisis parciales y cambios de exclusiones.
- **Fuera del MVP:** snapshots completos persistentes, seguimiento de renombrados, sincronización, comparación entre equipos y vigilancia continua.
- **Dependencias:** contrato de snapshot estable, semántica de cobertura y política de retención. F7 no es requisito para comparar tamaños agregados. Priorizar antes de F3 si las entrevistas muestran que el problema principal es el crecimiento recurrente.

### F5. Desglose por tipo de archivo

**Necesidad:** entender cuánto representan vídeos, imágenes, documentos u otros tipos. **Impacto esperado: medio–alto. Complejidad: M.**

- **MVP:** agregación por extensión con categorías versionadas y explícitamente aproximadas; incluir «Sin extensión» y «Otros». Contar cada archivo observado una sola vez; no inspeccionar su contenido para adivinarlo.
- **UI:** selector «Por carpeta | Por tipo», conservando tabla y cifras accesibles. Al elegir una categoría, filtrar el ranking global solo después de ampliar el contrato de F2 para ello.
- **Aceptación:** suma de categorías igual al total de bytes de archivos observados, incluso con nombres sin extensión y diferencias de mayúsculas. No confundir cero con categoría sin datos; mantener advertencias de parcialidad.
- **Fuera del MVP:** detección MIME por contenido y clasificar directorios completos como «caché segura».
- **Dependencias:** esquema de clasificación y presupuesto para agregados. F2 solo es necesaria para el enlace al ranking; F7 no es obligatoria.

### F6. Inicio rápido y contexto de almacenamiento

**Necesidad:** empezar sin repetir siempre el selector y entender qué se está analizando. **Impacto esperado: medio–alto.**

- **F6a · MVP, B:** últimas 5 carpetas y accesos a carpetas comunes resueltas por el sistema, sin asumir nombres ni rutas fijas. Registrar recientes tras iniciar un scan válido; permitir borrarlos. Manejar almacenamiento local bloqueado y rutas que ya no existen.
- **F6b · Ampliación, M:** unidades con capacidad y espacio libre, consultadas con timeout y fallos por unidad. Una unidad desconectada o lenta no debe bloquear la bienvenida.
- **Aceptación:** un clic inicia exactamente la carpeta elegida; se informa si no está disponible. Distinguir espacio libre del volumen, tamaño lógico del análisis y fecha de actualización. No restar el tamaño de una carpeta de la capacidad del volumen.
- **Fuera del MVP:** escaneo automático de todas las unidades, descubrimiento masivo de recursos de red e historial completo (F4).
- **Dependencias:** F9 para habilitar inicio de análisis. La vista de unidades requiere confirmar comportamiento en volúmenes extraíbles/red antes de ofrecerlos como soportados.

### F7. Fechas de modificación y filtros combinables

**Necesidad:** localizar elementos antiguos o grandes con criterios explícitos. **Impacto esperado: medio–alto. Complejidad: B–M.**

- **MVP:** conservar `lastModifiedTime` al escanear archivos; columna ordenable «Modificado» y filtros de tamaño/fecha. Combinar filtros con semántica AND y mostrar el número de coincidencias y cómo restablecerlos.
- **Aceptación:** fecha absoluta accesible además de la relativa, zona horaria definida, fechas ausentes/futuras tratadas explícitamente y pruebas de límites. «No modificado desde…» nunca se convierte en «No usado desde…».
- **Después:** fecha más reciente de un descendiente para carpetas, con una etiqueta diferente de la modificación de la propia carpeta y cobertura parcial visible.
- **Fuera del MVP:** prometer antigüedad de uso mediante fecha de acceso.
- **Dependencias:** ampliar/versionar DTO y validadores; integrar filtros globales con F2 sin cambiar silenciosamente el alcance de la tabla actual.

### F8. Precisión: tamaño lógico, tamaño en disco y nube

**Necesidad:** evitar decisiones basadas en cifras que no representan espacio local recuperable. **Impacto esperado: alto en escenarios de nube; prevalencia desconocida. Complejidad: A para soporte nativo.**

- **F8a · Calidad inmediata:** etiquetar tamaño lógico, explicar limitaciones y separar capacidad/espacio libre. No requiere integración nativa ni bloquea el ranking de F2.
- **F8b · Investigación acotada:** validar una muestra Windows con archivos locales, placeholders, enlaces duros, dispersos y comprimidos. Confirmar que la inspección no descarga contenido. Definir «desconocido/no soportado» antes de elegir API o biblioteca.
- **F8c · Entrega condicionada:** exponer tamaño en disco y estado de disponibilidad solo para combinaciones verificadas; no inferir cero bytes locales cuando el proveedor no da el dato. No sumar enlaces duros como si fueran bloques físicos distintos.
- **Aceptación:** matriz de casos con referencia de medición, ámbito de soporte visible y valores desconocidos conservados de extremo a extremo. Antes de F1c, bloquear acciones en contextos de sincronización no verificados y explicar posibles efectos fuera del equipo.
- **Fuera del MVP:** promesa universal de espacio recuperable o detección de todos los proveedores de nube.
- **Nota técnica:** `DosFileAttributes` de Java 17 expone los indicadores read-only, hidden, system y archive; no ofrece por sí sola el contrato completo de placeholders planteado originalmente. Hace falta investigar el acceso nativo, no asumir que está resuelto. [Contrato oficial de Java 17](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/nio/file/attribute/DosFileAttributes.html).

### F9. Arranque verificable y recuperación del servicio

**Necesidad:** evitar errores engañosos al iniciar y después de una caída del backend. **Impacto esperado: alto en primer uso. Complejidad: M.**

- **MVP:** estado `starting | ready | failed`, endpoint de salud que identifique la aplicación y la compatibilidad de API, timeout y reintentos acotados. Un puerto TCP abierto no demuestra que responda el servicio correcto.
- **UI:** «Preparando el motor…»; desactivar solo acciones que necesitan el servicio. Ofrecer reintento y diagnóstico útil. Ante una caída, conservar resultados visibles como snapshot e indicar qué operaciones ya no están disponibles.
- **Aceptación:** arranque lento, backend ausente, caída posterior, puerto ocupado por otro servicio, versión incompatible y backend iniciado externamente. Probar el origen/puerto configurado; cerrar la app no debe detener procesos ajenos.
- **Fuera del MVP:** reinicios infinitos, elevar privilegios y subir registros automáticamente. Si se muestran/exportan logs, advertir o redactar rutas personales.
- **Dependencias:** contrato mínimo con F11; integración con empaquetado F19. No exige añadir Spring Actuator si un endpoint pequeño cubre el contrato.

### F10. Informe de cobertura y elementos omitidos

**Necesidad:** entender por qué el resultado es parcial. **Impacto esperado: medio–alto para confianza. Complejidad: M.**

- **MVP:** desde «Omitidos», abrir una lista paginada y acotada por ruta y código de motivo: permiso, enlace excluido, profundidad, cambio durante lectura u otro error. Mostrar cantidad registrada y avisar si la lista fue truncada.
- **Aceptación:** el recuento y el detalle se reconcilian, incluyendo truncamiento explícito; motivos en ambos idiomas. No presentar tamaños desconocidos como cero ni prometer recuperar toda la cobertura.
- **Fuera del MVP:** botón para elevar toda la app. Antes de considerar administración, revisar el límite de privilegios y autenticación de la API local; CORS no sustituye ese diseño.
- **Dependencias:** F11 y un registro de incidencias presupuestado. No guardar listas ilimitadas de errores fuera del presupuesto de H0.

### F11. Contrato de errores e internacionalización coherente

**Necesidad:** comprender fallos y su recuperación en el idioma elegido. **Impacto esperado: medio–alto. Complejidad: B–M.**

- **MVP:** códigos estables en errores HTTP, scans y nodos; parámetros controlados para interpolación y mensaje de respaldo. Mapear códigos en el frontend; no traducir por coincidencias con frases inglesas.
- **Decisión propuesta de formato:** idioma de interfaz elegido por el usuario; locale numérico resuelto explícitamente desde el sistema en Electron y desde el navegador en preview. Conservar las reglas actuales de unidades/truncamiento y hacer coherentes bytes, contadores y porcentajes. Actualizar documentación y pruebas con esa política.
- **Aceptación:** arranque, carga, ramas, límites y fallos no dejan textos fijos sin traducir. Códigos desconocidos tienen fallback comprensible; errores técnicos no exponen trazas al usuario. Probar al menos inglés, español y locale de números diferente al idioma de interfaz.
- **Fuera del MVP:** traducción de nombres de archivos y soporte de nuevos idiomas.
- **Dependencias:** acordar contrato junto con F9; sirve de base para F10 y los errores de las nuevas consultas.

### F12. Treemap como complemento, no como navegación obligatoria

**Necesidad:** explorar visualmente la distribución cuando ranking y tabla no basten. **Impacto esperado: medio, pendiente de validar. Complejidad: A.**

- **MVP condicionado:** 2 niveles con número máximo de rectángulos y agrupación del resto, paleta de tokens y controles equivalentes en la tabla.
- **Aceptación:** tamaño y porcentaje accesibles sin hover; selección sincronizada y alternativa completa por teclado/lector de pantalla. Probar nodos pequeños, cero bytes, zoom, alto contraste y carpetas anchas.
- **Fuera del MVP:** renderizar todo el árbol, navegación solo por canvas o usar superficie visual como sustituto de cifras exactas.
- **Dependencias:** F2/F5 evaluadas con usuarios y presupuesto de renderizado medido. Investigar una visualización solo si resuelve una tarea que esas vistas no cubren.

### F13. Informes exportables y respetuosos con la privacidad

**Necesidad:** documentar un análisis o pedir ayuda sin dar acceso al equipo. **Impacto esperado: medio; alto si se valida soporte técnico. Complejidad: M.**

- **F13a · MVP:** CSV y JSON de la vista actual, con raíz, fecha, unidad, filtros, límite de resultados y cobertura. Elegir rutas completas, relativas o redacción de identificadores antes de guardar; aplicar esa política también a la raíz y a todos los metadatos. La vista previa debe mostrar el informe completo resultante. Las rutas relativas todavía pueden revelar nombres personales: no equivalen a anonimización.
- **Aceptación:** nombres Unicode y separadores correctos; neutralizar fórmulas en celdas CSV sin ocultar la política de escape. Cancelar no crea un informe; disco lleno y permisos producen errores recuperables. No exportar filas ocultas fuera del alcance anunciado.
- **F13b · Después:** HTML autocontenido con contenido escapado, sin scripts ni recursos remotos.
- **Fuera del MVP:** compartir automáticamente, subir archivos o afirmar anonimización total sin revisar nombres incluidos.
- **Dependencias:** contrato de vista estable. No requiere F4 si el informe proviene de un scan activo.

### F14. Productividad en incrementos independientes

**Necesidad:** reducir pasos repetidos sin alterar la consistencia del análisis. **Impacto esperado: medio.**

- **F14a · B:** `Ctrl+O` para elegir carpeta, `Ctrl+F` para la búsqueda del ámbito visible, `F5` para reescanear y `Alt+←` para el padre. Mostrar ayuda y no interceptar atajos dentro de campos o diálogos cuando interfieran con edición/navegación.
- **F14b · M:** arrastrar una carpeta mediante un puente nativo acotado; validar como en el selector. Rechazar varios objetivos o archivos con explicación. No sustituir silenciosamente un análisis activo.
- **F14c · M:** «Analizar esta subcarpeta» como **nuevo scan independiente**. Reutiliza el ciclo de vida existente; no mezcla tamaños de momentos distintos en un mismo snapshot.
- **Fuera del MVP:** parchear una rama del snapshot anterior o habilitar `Supr` antes de validar F1c. Reconciliar ancestros, cachés y agregados sería una iniciativa posterior.
- **Aceptación:** los atajos no duplican solicitudes; drag-and-drop respeta cancelación y origen; analizar una subcarpeta no modifica el snapshot previo.

### F15. Alto contraste primero, elección de tema después

**Necesidad:** mantener legibilidad y control en preferencias visuales distintas. **Impacto esperado: medio; accesibilidad es un requisito transversal.**

- **F15a · Calidad de la beta, B–M:** verificar y corregir `forced-colors`, foco, selección, errores y gráficos con alternativas textuales.
- **F15b · Ampliación, M:** «Sistema | Claro | Oscuro», tokens completos y persistencia tolerante a fallos.
- **Aceptación de F15a:** selección distinguible sin depender solo del color, controles y foco visibles, contraste en el tema actual y alto contraste, y 200 % de texto.
- **Aceptación adicional de F15b:** revisar claro/oscuro/sistema y persistencia. Cambiar tema no cierra un scan ni reinicia selección.
- **Fuera del MVP:** afirmar cumplimiento WCAG a partir de pruebas automáticas únicamente.

### F16. Progreso honesto y diagnóstico de actividad

**Necesidad:** distinguir un trabajo en curso de un servicio que dejó de responder. **Impacto esperado: medio–alto. Complejidad: B–M.**

- **F16a · MVP:** tiempo transcurrido, última actividad reportada y ruta actual con actualización limitada y truncamiento visual accesible. Distinguir «servicio sin respuesta» de «sin nuevos elementos»; esta última situación puede ser una lectura lenta.
- **F16b · Después:** velocidad suavizada de elementos/segundo, como dato orientativo, no tiempo restante garantizado.
- **Aceptación:** el contador se detiene en estados terminales y se reinicia por scan; cancelar sigue disponible; cambios de ruta no saturan anuncios del lector de pantalla ni respuestas de polling.
- **Fuera del MVP:** porcentaje a partir de bytes lógicos descubiertos / bytes usados del volumen. Esa razón no mide el trabajo total del recorrido y puede resultar engañosa.
- **Dependencias:** F9 para conectividad y extensión mínima del estado del scan; no necesita F6b.

### F17. Monitor opcional, solo tras validar recurrencia

**Necesidad:** avisar de poco espacio antes de que interrumpa al usuario. **Impacto esperado: desconocido hasta validar uso. Complejidad: A.**

- **Primera entrega si se justifica:** consulta de espacio libre con umbral configurable, activación explícita y pausa. No escanear recursivamente el disco en segundo plano por defecto.
- **Aceptación:** presupuesto de CPU/memoria/energía medido, avisos sin repetición continua y comportamiento documentado al cerrar sesión, suspender o quitar una unidad.
- **Después:** análisis programados, solo con límites de recursos y política de retención; alimentarían F4.
- **Dependencias:** F6b, F19 y evidencia de necesidad recurrente. F4 es requisito para históricos programados, no para un aviso simple.
- **Fuera del roadmap comprometido:** arranque automático con Windows sin consentimiento y servicio permanente invisible.

### F18. Asistente con IA: fuera del alcance actual

**Necesidad hipotética:** explicar carpetas poco reconocibles. No hay evidencia aún de que requiera IA ni de que compense el riesgo.

- **Decisión propuesta:** no implementarlo en las primeras entregas. Evaluar primero explicaciones deterministas y enlaces de ayuda revisados. Retirar la afirmación de que F3 cubre un porcentaje concreto de valor: no se ha medido.
- **Condiciones para reconsiderar:** problema validado, consentimiento específico, minimización de rutas/datos, coste asumible y evaluación de respuestas incorrectas. La anonimización no se presume suficiente.
- **Límite no negociable:** nunca autorizar ni ejecutar limpieza a partir de una recomendación automática. No presentar «seguro para borrar» como certeza.
- **Estado:** exploración sin fecha ni compromiso de implementación.

### F19. Distribución autónoma para Windows

**Necesidad:** que una persona sin herramientas de desarrollo pueda probar el producto. **Impacto esperado: alto si el segmento inicial no es técnico. Complejidad: A.**

- **F19a · MVP de beta:** paquete instalable con frontend, backend y runtime Java compatibles; no descargar JDK/Maven/Node en el primer arranque. Ensayar temprano un runtime embebido; decidir herramienta de empaquetado tras una prueba acotada, sin obligar a migrar el backend.
- **Aceptación:** instalar, iniciar, analizar y desinstalar en una máquina limpia del Windows declarado como soportado, sin herramientas de desarrollo ni red para el análisis. Probar rutas con espacios/Unicode, usuario estándar, inicio fallido y cierre sin procesos huérfanos.
- **Operación:** definir ubicación y límites de logs/datos, conservación del historial al actualizar, limpieza al desinstalar y compatibilidad de versiones entre procesos. Resolver firma/procedencia antes de distribución pública; no pedir que se desactiven protecciones del sistema.
- **Fuera del MVP:** multiplataforma completa, autoactualización y reescritura a GraalVM. Solo reconsiderarlas con evidencia o una limitación medida.
- **Dependencias:** F9 y contratos de versión. La investigación puede empezar antes, pero la beta requiere el recorrido útil de H2.

### Mejoras pequeñas que acompañan a las entregas

| Área actual | Mejora acotada                                                                                                     | Se entrega con                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Resumen     | Mostrar el archivo observado más grande; aclarar cobertura y tamaño lógico.                                        | F2a + F8a                                        |
| Tabla       | `fileCount` de carpetas y cabecera clara; no añadir muchos filtros antes de definir alcance.                       | F7 / F2b                                         |
| Árbol       | Conservar búsqueda de elementos cargados hasta que exista búsqueda global real; distinguir ambos alcances.         | F2b                                              |
| Dona        | Paleta desde tokens y cifras accesibles, sin duplicar información ni controles.                                    | F15a / F5                                        |
| Detalle     | Ruta útil, extensión, fecha y acción visible de ubicación.                                                         | F1a / F7                                         |
| Ajustes     | Añadir opciones solo con la función correspondiente; separar idioma, formato y acciones de riesgo.                 | F11 / F15b / F1c                                 |
| Escaneo     | Política de exclusiones explícita y visible si se incorpora; nunca excluir silenciosamente para aparentar rapidez. | Investigación de escala en H0; función posterior |
| Calidad     | Pruebas de carpetas profundas/anchas y respuestas acotadas; no confundir carga diferida con coste constante.       | Todos los hitos                                  |

---

## 4. Priorización y dependencias

### 4.1 Criterio de decisión

Priorizar, por este orden: **seguridad y veracidad → posibilidad de completar el primer recorrido → aprendizaje con usuarios → profundidad de análisis → automatización**. Un impacto alto no elimina dependencias ni vuelve bajo el riesgo.

| Prioridad                | Iniciativas                                  | Razón                                                                   | Confianza                                                    |
| ------------------------ | -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| P0 · Base                | H0, F9, F11, F8a, F15a                       | Evitar fallos engañosos, promesas incorrectas y regresiones.            | Alta sobre la existencia de la brecha técnica.               |
| P1 · Primer valor        | F2a, F1a, F16a, F19a                         | Encontrar algo útil, entender el progreso y poder instalarlo.           | Media sobre el impacto; falta prueba con usuarios.           |
| P1 · Reducir fricción    | F6a, F10, F14a                               | Iniciar, entender cobertura y operar sin pasos repetidos.               | Media; pueden recortarse ampliaciones para proteger la beta. |
| P2 · Profundidad         | F7, F5, F2b, F4a/b, F13a, F3                 | Resolver necesidades observadas de análisis o repetición.               | Media–baja hasta validar el segmento.                        |
| P2 · Comodidad           | F6b, F14b/c, F15b, F16b, F1b                 | Mejoras independientes; no deben retrasar el flujo central.             | Media–baja.                                                  |
| P3 · Riesgo/alcance alto | F8b/c, F1c, F12, F13b, F17                   | Precisión nativa, mutaciones o complejidad operativa adicional.         | Baja sobre retorno/esfuerzo hasta investigar.                |
| No comprometida          | F18, MFT, cuentas, sincronización, app móvil | Sin problema validado que justifique complejidad o exposición de datos. | Insuficiente.                                                |

**Excepción por seguridad:** aunque F8b/c no sea prioridad para el análisis de solo lectura, su validación acotada pasa a ser necesaria antes de habilitar F1c en contextos afectados. No posponer la advertencia de tamaño lógico mientras se investiga.

### 4.2 Dependencias que determinan el orden

| Entrega                   | Necesita                                                                           | No necesita esperar a              |
| ------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| F9                        | Contrato de identidad/versión y errores mínimos F11.                               | Instalador final.                  |
| F2a                       | H0, snapshots identificados y errores coherentes.                                  | F7, F5, papelera o historial.      |
| F1a                       | Selección existente y validación IPC/objetivo.                                     | Menú contextual o modo de borrado. |
| F19a                      | F9; H2 listo para la beta útil.                                                    | IA, treemap o limpieza.            |
| F10                       | Códigos F11 y registro de omisiones acotado.                                       | Modo administrador.                |
| F5 + filtros de categoría | Agregados; F2 ampliada para el enlace al ranking.                                  | Fechas o lectura de contenido.     |
| F3                        | F7 para antigüedad, cobertura F10 y catálogo probado.                              | Acciones destructivas.             |
| F4b                       | Resúmenes F4a compatibles, con identidad y cobertura.                              | Snapshots completos o F7.          |
| F1c                       | Política de seguridad, revalidación, F8 acotada y estado desactualizado/reescaneo. | Promesa de deshacer automático.    |

Trabajar en paralelo solo donde no se dupliquen contratos: por ejemplo, probar empaquetado mientras se implementa el ranking. **Propuesta de capacidad:** una entrega principal y una investigación acotada en curso; no abrir todas las iniciativas P1 a la vez.

---

## 5. Roadmap orientado a resultados

### 5.1 Qué se pretende validar primero

La beta no pretende ser un limpiador completo. Debe demostrar que alguien del segmento elegido puede **instalar, analizar, localizar un elemento relevante y mostrarlo en el Explorador**, entendiendo las limitaciones de los datos.

No hay evidencia suficiente para comprometer «0–6 semanas» o «4–12 meses». Los horizontes siguientes expresan orden y condiciones de salida; se estimará calendario al conocer capacidad, alcance aceptado y resultados de las investigaciones.

### 5.2 Estado real del trabajo

| Hito                             | Estado al 2026-09-17         | Evidencia / siguiente acción                                                         |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| H0 · Limpieza y límites          | **Cerrado (verificado)**     | Ver «Evidencia de cierre de H0» debajo.                                              |
| H1 · Motor listo y comprensible  | **Cerrado (verificado)**     | Ver «Evidencia de cierre de H1» debajo. F15a queda iniciada, no cerrada.             |
| H2–H3 · Primer hallazgo y beta   | **Propuestos**               | Decidir antes el alcance del límite de entradas (pendientes de H0).                  |
| H4 · Profundidad/recurrencia     | **Backlog condicionado**     | Elegir la siguiente necesidad a partir de pruebas con usuarios.                      |
| H5–H6 · Acciones y largo alcance | **Investigación o diferido** | Requieren evidencia y garantías adicionales; no autorizan implementación automática. |

Esta tabla distingue **diseño**, **cambios locales** y **entrega validada**. No marcar un hito como completado solo porque exista código.

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

- `tests/electron-smoke.cjs` espera textos en inglés, pero Electron toma el idioma del sistema. En un Windows en español falla antes de probar nada. Recargar la página tras fijar el idioma con CDP cierra la ventana, así que hay que resolverlo aparte (por ejemplo, con un perfil `userData` temporal para las pruebas). La verificación de H0 se hizo con una copia temporal adaptada al español.
- **Decisión de producto antes de H2/H3:** con 250.000 entradas y el heap por defecto, analizar `C:\` completo falla. Hay que decidir entre aceptar ese alcance y explicarlo en la interfaz, aumentar el heap y los límites tras medir, o cambiar el almacenamiento del snapshot (§5.6, «Tamaño de datasets objetivo»).
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

- El título y el botón del diálogo nativo de carpetas (`main.js`) siguen en inglés. Traducirlos exige pasar textos validados por IPC.
- Con colores forzados, las filas no seleccionadas del árbol también muestran borde (el borde transparente se vuelve visible). La selección se distingue por grosor y color, pero el aspecto es recargado.
- F19a (prueba de empaquetado en una máquina limpia) no se investigó en este hito.
- `tests/electron-smoke.cjs` sigue dependiendo del idioma del sistema (pendiente de H0); en H1 se actualizó la lista de claves del puente y se verificó con la copia en español.

### 5.3 Secuencia de entregas

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
- **Calidad:** cerrar F15a para las vistas entregadas; demostrar selección, foco, carga, vacío, error y parcialidad en inglés/español.
- **No incluye:** apertura de ejecutables, papelera, treemap o búsqueda global ilimitada.
- **Demostración de entrega:** recorrido grabado o checklist reproducible desde elegir carpeta hasta mostrar un elemento, usando solo fixtures, no rutas personales.

#### H3 · Beta Windows instalable y prueba de valor

**Resultado:** validar el flujo con personas que no tengan entorno de desarrollo.

- **Incluye:** F19a y correcciones del recorrido H1–H2. Completar F6a/F14a si quedaron pendientes; no convertir la beta en un inventario de funcionalidades.
- **Criterios de salida técnicos:** prueba en máquina limpia sin Node/JDK/Maven instalados; sin red para analizar; arranque, cierre, actualización de prueba y desinstalación con política de datos documentada. Sin procesos huérfanos ni necesidad de desactivar protecciones.
- **Criterios de salida de producto:** sesiones moderadas con participantes del segmento inicial, resultados registrados y decisión explícita sobre la siguiente iteración. El número propuesto y sus límites figuran en §5.5.
- **No incluye:** soporte equivalente para macOS/Linux ni borrado dentro de la app.
- **Decisión posterior:** si no se cumple la puerta de §5.5, corregir y repetir la prueba antes de añadir F3/F4/F12, aunque algunos participantes completen el recorrido. Si la barrera es solo instalación, priorizar distribución antes de enriquecer gráficos.

#### H4 · Profundizar según el problema observado

**Resultado:** resolver la siguiente pregunta importante, no añadir todas las vistas a la vez.

| Evidencia observada en la beta                   | Siguiente entrega candidata                  | Condición de aceptación principal                                                 |
| ------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------- |
| «No sé qué clase de archivos ocupa esto».        | F5, después filtros de categoría en F2.      | Agregados reconciliados y alcance visible.                                        |
| «Quiero encontrar algo antiguo o por su nombre». | F7 y/o F2b.                                  | Filtros combinables, fechas honestas y consultas acotadas.                        |
| «Quiero saber qué creció».                       | F4a → F4b.                                   | Informes persistentes comparables; desconocido distinto de cero.                  |
| «Necesito documentarlo o pedir ayuda».           | F13a.                                        | Exportación fiel al alcance, revisable y sin fórmulas activas.                    |
| «Lo encuentro, pero no sé qué revisar».          | Piloto pequeño F3 con F7/F10.                | Explicaciones comprendidas, falsos positivos revisados y sin automatizar borrado. |
| «Repito siempre los mismos pasos».               | F6b, F14b/c o F15b, según problema concreto. | Menos pasos sin ocultar límites ni alterar snapshots previos.                     |

Elegir **una** de estas líneas y revisar resultados antes de abrir la siguiente. F1b y F16b son ampliaciones opcionales, no requisitos de recurrencia.

#### H5 · Acciones de limpieza, solo con garantías explícitas

**Resultado condicionado:** permitir una acción individual sin inducir decisiones falsas sobre el archivo o el espacio.

- **Entrada obligatoria:** necesidad de actuar dentro de la app confirmada; política de objetivos permitidos; precisión F8b/c para el alcance elegido; límites de privilegios y rutas revisados; plan de fallos y datos desactualizados.
- **Primera entrega posible:** F1c individual, con modo de análisis por defecto, confirmación, resultado verificable y reescaneo. Si no se puede validar el destino o el soporte de papelera, bloquear; nunca degradar a borrado permanente.
- **Pruebas de salida:** archivo movido/cambiado, permisos, enlaces/reparse points, carpeta protegida, unidad no soportada y sincronización. No restar tamaños antiguos ni anunciar espacio liberado al enviar a papelera.
- **Diferido:** selección múltiple, deshacer propio, vaciado y actualización incremental del snapshot. Cada ampliación necesita su propio diseño y pruebas.
- **Decisión:** si no se consiguen estas garantías, mantener F1a como salida útil del producto. No existe obligación de transformarlo en limpiador.

#### H6 · Apuestas posteriores, sin fecha comprometida

- **F12:** solo si la prueba de tareas demuestra que una vista espacial mejora ranking/tabla.
- **F17:** solo si existe uso recurrente y se acepta explícitamente actividad en segundo plano.
- **F13b y snapshots completos de F4:** solo si la profundidad o formato de informes actuales resulta insuficiente.
- **F8 ampliada:** nuevos proveedores/volúmenes únicamente con matriz de soporte y datos de demanda.
- **F18, MFT, nube y móvil:** fuera del plan de ejecución hasta validar un problema, coste y diseño de privacidad.

### 5.4 Definición de terminado compartida

Una entrega se cierra cuando cumple **todos** los puntos aplicables:

1. Criterios funcionales de su ficha demostrados con fixtures reproducibles, incluyendo cero resultados, errores, cancelación y cobertura parcial.
2. API, modelos y validadores coherentes; solicitudes y respuestas acotadas. No mezclar snapshots ni interpretar desconocido como cero.
3. Interacción por teclado, foco y anuncios revisados; inglés/español; layout compacto y texto ampliado. Las pruebas automáticas no sustituyen revisión manual de accesibilidad.
4. Sin regresiones en TypeScript, build, pruebas de datos, Electron, UI y backend pertinentes. La integración real se prueba cuando cambia un contrato entre procesos.
5. Casos de rendimiento definidos **antes de empezar**: cantidad de entradas, profundidad, anchura, longitud de rutas, dos scans, heap/configuración y hardware. Registrar latencia, memoria y tiempo de cancelación. Fijar umbrales tras obtener la línea base; no declarar «rápido» sin medición.
6. Datos, permisos y errores revisados: no exponer rutas/logs ni ampliar IPC más de lo necesario; no introducir envíos de datos o telemetría por defecto.
7. Documentación y estado del roadmap actualizados, con evidencia de pruebas y limitaciones. Conventional Commits granulares; una investigación solo se cierra con una decisión documentada, no cuenta como función entregada.

### 5.5 Validación y métricas sin telemetría obligatoria

**[Suposición de investigación]** Empezar con 5–8 participantes del segmento elegido y tareas sobre carpetas de prueba. Sirve para descubrir fricciones, no para inferir porcentajes de adopción de toda la población. Repetir tras corregir problemas.

| Pregunta                           | Medición propuesta                                                                                                   | Cómo evita conclusiones engañosas                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| ¿Se puede empezar?                 | Instalaciones y arranques correctos / intentos, con motivos de fallo.                                                | Máquina y condiciones registradas; no excluir fallos.    |
| ¿Se encuentra algo útil?           | Participantes que localizan el objetivo y muestran su ubicación sin ayuda / participantes que intentan la tarea.     | Informar el número absoluto y la muestra pequeña.        |
| ¿Cuánto cuesta llegar al hallazgo? | Tiempo desde resultados disponibles hasta identificar el objetivo; tiempo total de instalación/escaneo por separado. | No atribuir a la UX toda la velocidad del disco.         |
| ¿Se comprenden las cifras?         | Pedir explicar tamaño lógico, parcialidad e histórico con sus palabras.                                              | No medir comprensión solo con clics.                     |
| ¿La app es robusta?                | Crashes, errores bloqueantes, fallos de cancelación y presupuesto de memoria en la matriz de pruebas.                | Incluir escenarios de fallo, no solo el recorrido feliz. |
| ¿Hay una razón para volver?        | Entrevista de seguimiento y ejemplos concretos de necesidades de comparación.                                        | No inventar retención sin observación longitudinal.      |

**Puerta propuesta para continuar tras la beta:** ningún defecto bloqueante de seguridad/datos en los casos soportados; al menos 4 de los primeros 5 participantes completan el recorrido principal sin ayuda; todos los fallos quedan registrados y priorizados. Es un objetivo de prueba propuesto, no un resultado ni validación estadística.

Registrar notas y tiempos localmente con consentimiento. No capturar rutas personales ni contenido de archivos. Cualquier instrumentación persistente o envío de diagnósticos sería una decisión separada y opcional.

### 5.6 Decisiones abiertas que pueden cambiar el orden

| Decisión                                             | Evidencia necesaria                                        | Consecuencia para el roadmap                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Usuario principal: general, desarrollador o soporte. | Entrevistas y tareas observadas en H3.                     | Reordenar F3, F4 y F13; no construir las tres a la vez.                                          |
| Windows y volúmenes soportados en la beta.           | Prueba de empaquetado y matriz de filesystem.              | Acotar F19/F6b; no anunciar soporte que no se ha verificado.                                     |
| Necesidad real de borrar dentro de la app.           | Usuarios que no resuelven la tarea con F1a.                | Activar o descartar H5.                                                                          |
| Relevancia de OneDrive y otros proveedores.          | Casos reales y prueba técnica sin descargar contenido.     | Ampliar F8 o bloquear acciones solo en contextos no verificados.                                 |
| Mantenimiento de reglas y formatos históricos.       | Responsable y capacidad de pruebas/migración definidos.    | Limitar F3/F4 al alcance sostenible.                                                             |
| Tamaño de datasets objetivo.                         | Mediciones en árboles profundos/anchos con heap declarado. | Decidir paginación, almacenamiento persistente o cambio de arquitectura antes de aumentar topes. |

**Siguiente paso recomendado:** H0 y H1 están cerrados. Antes de H2, tomar la decisión de alcance sobre el límite de entradas y decidir si se completa F15a con una revisión manual de alto contraste. Este documento mejora el plan; no autoriza ejecutar de una vez el resto del roadmap.
