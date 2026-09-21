import type { Dictionary } from "../translations";

export const es: Dictionary = {
  "app.loading": "Abriendo Storage Analyzer",

  "shell.skipToContent": "Saltar al contenido principal",
  "shell.brandHome": "Inicio de Storage Analyzer",
  "shell.workspace": "ESPACIO DE TRABAJO",
  "shell.footerLocal": "Se ejecuta localmente en tu dispositivo",
  "shell.footerUnits": "Tamaños en KB, MB y GB · Análisis de solo lectura",
  "shell.openSettings": "Configuración",

  "settings.title": "Configuración",
  "settings.close": "Cerrar la configuración",
  "settings.done": "Listo",
  "settings.language": "Idioma",
  "settings.languageHint": "Se aplica al instante.",
  "settings.recentTitle": "Carpetas recientes",
  "settings.rememberRecent": "Guardar carpetas recientes",
  "settings.rememberRecentHint":
    "Solo en este equipo. Desactivarlo deja de guardar carpetas y oculta la lista sin borrarla. No se borra nada del disco.",
  "settings.recentCount": "{count} guardadas",
  "settings.recentCleared": "Carpetas recientes borradas",
  "settings.sizesNote":
    "Los tamaños mantienen el formato que usa el Explorador de Windows en este equipo, sea cual sea el idioma que elijas.",

  "status.scanning": "Analizando",
  "status.completePartial": "Completado con elementos omitidos",
  "status.complete": "Análisis completado",
  "status.cancelled": "Análisis cancelado",
  "status.ready": "Listo para explorar",

  "page.eyebrow": "CONOCE TU ALMACENAMIENTO",
  "page.title": "Resumen de almacenamiento",
  "page.subtitle": "Mira qué ocupa espacio. Encuentra lo que importa.",
  "page.rescan": "Volver a analizar {name}",
  "page.selectFolder": "Nuevo análisis",
  "page.quickAccess": "Carpetas recientes y habituales",

  "work.title": "Análisis de {name}",
  "work.analyzedAt": "Analizado el {date}",
  "work.stateComplete": "Completo",
  "work.statePartial": "Parcial",
  "work.statePreserved": "Conservado del último análisis",
  "work.statePrevious": "Resultados anteriores",
  "work.snapshotNote":
    "Los resultados son una lectura de ese momento, no una supervisión en vivo. Vuelve a analizar para ver cambios posteriores.",

  "welcome.eyebrow": "UNA VISTA MÁS CLARA DE TUS ARCHIVOS",
  "welcome.title": "Un poco de claridad. Mucho espacio.",
  "welcome.description":
    "Elige una carpeta para descubrir sus archivos más grandes, explorar lo que contiene y entender cómo se suma tu almacenamiento.",
  "welcome.chooseFolder": "Elegir una carpeta",
  "welcome.privacy": "Análisis local. Tus archivos no salen de tu dispositivo.",
  "welcome.featureBreakdown": "Desglose visual",
  "welcome.featureFind": "Encuentra archivos grandes",
  "welcome.featureExplore": "Explora cada carpeta",

  "error.tryAgain": "Reintentar",
  "error.unknown": "Algo salió mal. Inténtalo de nuevo.",
  "error.unreadable-response":
    "El servicio local devolvió una respuesta ilegible. Inténtalo de nuevo.",
  "error.request-failed":
    "No se pudo completar la petición. Inténtalo de nuevo.",
  "error.timeout":
    "El servicio local tardó demasiado en responder. Puedes reintentar sin riesgo.",
  "error.offline":
    "El servicio de análisis local no responde. Espera a que esté listo e inténtalo de nuevo.",
  "error.already-starting": "Ya se está iniciando un análisis.",
  "error.startTitle": "No se pudo iniciar el análisis",
  "error.expiredTitle": "La sesión de análisis expiró",
  "error.expiredDescription":
    "El servicio local se reinició o este análisis expiró. Elige una carpeta para empezar uno nuevo.",
  "error.connectionTitle": "Conexión interrumpida",
  "error.previousResults": " Tus resultados anteriores siguen disponibles.",
  "error.selectAnother": "Elegir otra carpeta",
  "error.scanFailedTitle": "El análisis no pudo terminar",
  "error.scanFailedDescription":
    "Elige una carpeta accesible e inténtalo de nuevo.",
  "error.cancelledWithResults": "Tus resultados anteriores siguen disponibles.",
  "error.cancelledNoResults":
    "Elige una carpeta cuando quieras volver a empezar.",
  "error.couldNotCancel": "No se pudo cancelar",
  "error.couldNotCancelHint": "Usa Cancelar análisis para reintentar.",
  "error.branchTitle": "No se pudo abrir {name}",
  "error.itemUnreadableTitle": "No se pudo leer este elemento",
  "error.itemUnreadableDescription":
    "Revisa los permisos de la carpeta y vuelve a analizar.",

  "progress.label": "Progreso del análisis",
  "progress.spinner": "Analizando archivos",
  "progress.heading": "Analizando tu carpeta…",
  "progress.starting": "Iniciando el análisis…",
  "progress.counts":
    "{files} archivos · {bytes} encontrados · {skipped} omitidos",
  "progress.cancel": "Cancelar análisis",

  "summary.label": "Resumen del análisis",
  "summary.knownSize": "Tamaño conocido",
  "summary.totalSize": "Tamaño total",
  "summary.logicalSize": "Tamaño lógico de los archivos, no espacio en disco",
  "summary.filesAnalyzed": "Archivos analizados",
  "summary.howCalculated": "Cómo se calculan los tamaños",
  "summary.subfolders": "Subcarpetas",
  "summary.skipped": "Elementos omitidos",
  "summary.partialTitle": "No se pudieron medir algunos elementos",
  "summary.partialDescription":
    "Los resultados solo incluyen los bytes legibles. Los enlaces simbólicos, los archivos inaccesibles o los límites del análisis pueden dejar los totales incompletos.",

  "explorer.title": "Explorador",
  "explorer.loaded": "{count} cargados",
  "explorer.close": "Cerrar el explorador",
  "explorer.label": "Explorador de archivos",
  "explorer.searchLabel": "Buscar entre los elementos cargados",
  "explorer.searchPlaceholder": "Buscar entre lo cargado…",
  "explorer.hint": "Abre una carpeta para cargar su contenido.",
  "explorer.treeLabel": "Carpetas y archivos",
  "explorer.noMatches": "Ningún elemento cargado coincide con “{query}”.",
  "explorer.resize": "Cambiar el ancho del explorador",
  "explorer.navigate": "Navegar",
  "explorer.select": "Seleccionar",

  "tree.skippedItem": "elemento omitido",
  "tree.file": "archivo",
  "tree.folder": "carpeta",
  "tree.incomplete": "incompleto",

  "selection.breadcrumbLabel": "Ruta de la carpeta",
  "selection.files": "{count} archivos",
  "selection.incomplete": "Incompleto",
  "selection.explorer": "Explorador",
  "selection.copyPath": "Copiar ruta",
  "selection.copied": "Ruta copiada",
  "selection.copyFailed":
    "No se pudo copiar. Selecciona y copia la ruta que aparece abajo.",
  "selection.loadingContents": "Cargando el contenido de la carpeta",

  "file.title": "Detalles del archivo",
  "file.description":
    "Este archivo suma al tamaño lógico total de la carpeta que lo contiene.",
  "file.name": "Nombre del archivo",
  "file.size": "Tamaño",
  "file.path": "Ruta",

  "load.title": "Abre esta carpeta",
  "load.description": "Carga su contenido para explorar el siguiente nivel.",
  "load.button": "Cargar el contenido",

  "distribution.title": "Distribución",
  "distribution.figureLabel":
    "{name}: {size} en los elementos listados. Los tamaños y porcentajes exactos están en la tabla de contenido de abajo.",
  "distribution.other": "Otros elementos",

  "contents.title": "Contenido de la carpeta",
  "contents.largestFirst": "De mayor a menor por defecto",
  "contents.emptyTitle": "Esta carpeta está vacía",
  "contents.emptyDescription": "No hay elementos que mostrar en esta carpeta.",
  "contents.searchLabel": "Filtrar los elementos de esta carpeta",
  "contents.searchPlaceholder": "Filtrar esta carpeta…",
  "contents.directOnly":
    "El filtro solo lee los elementos que están directamente en {name}.",
  "contents.searchSubfolders": "Buscar “{query}” en {name} y subcarpetas",
  "contents.filterLabel": "Filtrar por tipo",
  "contents.allTypes": "Todos los tipos",
  "contents.folders": "Carpetas",
  "contents.files": "Archivos",
  "contents.skippedItems": "Elementos omitidos",
  "contents.reset": "Restablecer",
  "contents.noMatchTitle": "Ningún elemento coincide",
  "contents.noMatchDescription": "Prueba con otro nombre o quita los filtros.",
  "contents.clearFilters": "Quitar los filtros",
  "contents.caption":
    "Contenido de {name}. Los tamaños son los tamaños lógicos de archivo tal como los muestra el Explorador de Windows, no el espacio ocupado en disco.",
  "contents.columnName": "Nombre",
  "contents.columnType": "Tipo",
  "contents.columnSize": "Tamaño",
  "contents.columnShare": "Proporción",
  "contents.partial": "Parcial",
  "contents.revealed": "Desde los más grandes",
  "contents.revealedSearch": "Desde la búsqueda",
  "contents.typeFile": "Archivo",
  "contents.typeSkipped": "Omitido",
  "contents.typeFolder": "Carpeta",
  "contents.range": "{from}–{to} de {total} elementos",
  "contents.noItems": "0 elementos",
  "contents.pagination": "Paginación del contenido",
  "contents.previousPage": "Página anterior",
  "contents.nextPage": "Página siguiente",
  "contents.pageOf": "Página {page} de {pages}",

  "folderDialog.title": "Elige una carpeta",
  "folderDialog.close": "Cerrar el diálogo de carpeta",
  "folderDialog.description":
    "Escribe la ruta absoluta de una carpeta del equipo donde se ejecuta el servicio de análisis.",
  "folderDialog.label": "Ruta de la carpeta",
  "folderDialog.cancel": "Cancelar",
  "folderDialog.analyze": "Analizar la carpeta",
  "folderDialog.nativeTitle": "Elige una carpeta para analizar",

  "common.loading": "Cargando",
  "tree.loading": "Cargando {name}",

  "error.invalid-scan":
    "El servicio local devolvió un análisis no válido. Vuelve a iniciar el análisis.",
  "error.invalid-data":
    "Los datos del análisis están incompletos. Comprueba que la app y su motor de análisis estén actualizados.",
  "error.incomplete-scan":
    "El análisis terminado no incluía ninguna carpeta. Inténtalo de nuevo.",
  "error.service-unavailable":
    "Otro servicio está respondiendo en el puerto del análisis.",
  "error.unknownService":
    "El motor de análisis informó de un problema sin explicarlo. Inténtalo de nuevo.",

  "api.INVALID_REQUEST":
    "La solicitud no era válida. Vuelve a elegir una carpeta.",
  "api.PATH_REQUIRED": "Escribe la ruta absoluta de una carpeta.",
  "api.PATH_INVALID": "Esta ruta de carpeta no es válida.",
  "api.PATH_NOT_ABSOLUTE":
    "Escribe una ruta completa que empiece por la unidad, como C:\\Users\\tu-usuario.",
  "api.FOLDER_NOT_FOUND":
    "Esta carpeta no existe. Puede que se haya movido o cambiado de nombre.",
  "api.NOT_A_FOLDER": "Elige una carpeta, no un archivo ni un acceso directo.",
  "api.FOLDER_UNREADABLE":
    "No se puede leer esta carpeta. Revisa sus permisos.",
  "api.SCANS_AT_CAPACITY":
    "Ya hay dos análisis en curso. Cancela uno o espera a que termine.",
  "api.SCANNER_BUSY":
    "El motor de análisis está ocupado. Inténtalo de nuevo en un momento.",
  "api.SCAN_NOT_FOUND":
    "Este análisis caducó o ya no existe. Inicia uno nuevo.",
  "api.SCAN_NOT_COMPLETE":
    "Los detalles de las carpetas estarán disponibles cuando termine el análisis.",
  "api.PATH_OUTSIDE_SCAN": "Esta carpeta no forma parte del análisis actual.",
  "api.PATH_NOT_IN_SCAN": "Este elemento no aparece en el análisis.",

  "scanError.ROOT_UNREADABLE": "No se pudo leer la carpeta elegida.",
  "scanError.ENTRY_LIMIT":
    "Esta carpeta contiene más de {limit} elementos, el máximo que admite un análisis en este equipo. Elige una carpeta más pequeña.",
  "scanError.MEMORY_BUDGET":
    "El motor de análisis se quedó sin espacio para los resultados. Elige una carpeta más pequeña, o cancela otro análisis e inténtalo de nuevo.",
  "scanError.OUT_OF_MEMORY":
    "El motor de análisis se quedó sin memoria. Elige una carpeta más pequeña o reinicia la app y vuelve a intentarlo.",
  "scanError.SCAN_FAILED":
    "El análisis no pudo terminar. Comprueba que la carpeta sea accesible e inténtalo de nuevo.",

  "nodeIssue.EXCLUDED_LINK": "Los vínculos y archivos especiales no se siguen.",
  "nodeIssue.DEPTH_LIMIT":
    "Demasiado profundo para analizarlo; su contenido no se cuenta.",
  "nodeIssue.PATH_UNREADABLE":
    "No se pudo leer. Puede que requiera permisos o que se haya movido.",
  "nodeIssue.CONTENTS_PARTIALLY_UNREADABLE":
    "No se pudieron leer algunos de sus elementos.",
  "nodeIssue.unknown": "No se pudo medir este elemento por completo.",

  "service.statusChecking": "Conectando",
  "service.statusStarting": "Iniciando el motor",
  "service.statusUnavailable": "Motor no disponible",
  "service.checkingTitle": "Conectando con el motor de análisis…",
  "service.startingTitle": "Preparando el motor de análisis…",
  "service.startingDescription":
    "Puede tardar unos segundos, algo más la primera vez. Podrás elegir una carpeta en cuanto esté listo.",
  "service.unavailableTitle": "El motor de análisis no responde",
  "service.unavailableDescription":
    "Puede que aún se esté iniciando o que se haya detenido. No se pueden iniciar análisis hasta que responda; la app sigue comprobándolo.",
  "service.stoppedTitle": "El motor de análisis dejó de responder",
  "service.stoppedDescription":
    "No se pueden iniciar análisis hasta que vuelva a responder; la app sigue comprobándolo.",
  "service.resultsKept":
    "Los resultados en pantalla son del último análisis. Las carpetas que aún no se cargaron no se pueden abrir hasta que el motor responda.",
  "service.portInUseTitle": "Otro programa usa la dirección del motor",
  "service.portInUseDescription":
    "El motor de análisis necesita {origin}, pero ahí responde otro programa. Ciérralo e inténtalo de nuevo.",
  "service.versionTitle": "El motor de análisis es de otra versión",
  "service.versionDescription":
    "El motor que responde en {origin} no corresponde a esta versión de la app. Detenlo e inténtalo de nuevo para que la app inicie el suyo.",
  "service.unsupportedTitle": "Inicia el motor de análisis por separado",
  "service.unsupportedDescription":
    "En este sistema la app no puede iniciar su motor por sí sola. Inicia el backend como indica su guía y vuelve a intentarlo.",
  "service.timeoutTitle":
    "El motor de análisis está tardando demasiado en iniciarse",
  "service.timeoutDescription":
    "La app dejó de esperarlo. Inténtalo de nuevo, o reinicia la app si nunca llega a estar listo.",
  "service.exitedTitle": "El motor de análisis se detuvo",
  "service.exitedDescription":
    "Se cerró de forma inesperada. Inténtalo de nuevo para iniciarlo.",
  "service.retrying": "Reintentando",

  "progress.reading": "Leyendo {path}",
  "progress.elapsed": "{time} transcurridos",
  "progress.stalled":
    "No hay elementos nuevos desde hace unos segundos. Algunas carpetas tardan en leerse: puedes seguir esperando o cancelar.",
  "progress.noResponse":
    "Esperando respuesta del motor de análisis. El tiempo mostrado es el de su última respuesta.",

  "summary.sizeNote":
    "Los tamaños suman la longitud de los archivos, como los muestra el Explorador, no el espacio que ocupan en disco. Los archivos comprimidos y dispersos ocupan menos, los archivos con varios vínculos físicos se cuentan una vez por ruta y los archivos solo en la nube (por ejemplo, en OneDrive) cuentan completos aunque ocupen poco o nada en el equipo. Borrar archivos no libera necesariamente la misma cantidad.",
  "summary.volume": "Unidad al empezar el análisis: {free} libres de {total}",
  "summary.volumeUnknown": "Capacidad de la unidad: desconocida",

  "common.close": "Cerrar",
  "common.dismiss": "Descartar este aviso",
  "api.INVALID_PARAMETER": "La solicitud no era válida. Inténtalo de nuevo.",

  "view.label": "Vista",
  "view.folder": "Contenido de la carpeta",
  "view.largest": "Archivos más grandes",

  "largest.title": "Archivos más grandes de este análisis",
  "largest.description":
    "Los archivos más grandes encontrados en {root}. Solo incluye lo que cubrió este análisis, no todo el disco.",
  "largest.minSizeLabel": "Tamaño mínimo",
  "largest.anySize": "Cualquier tamaño",
  "largest.atLeast": "{size} o más",
  "largest.caption":
    "Archivos más grandes de {root}, de mayor a menor. Los tamaños son tamaños lógicos de archivo.",
  "largest.columnName": "Nombre",
  "largest.columnLocation": "Ubicación",
  "largest.columnSize": "Tamaño",
  "largest.columnActions": "Acciones",
  "largest.rootLocation": "Raíz de la carpeta analizada",
  "largest.count":
    "Se muestran {shown} de {matching} archivos que cumplen el filtro",
  "largest.onlyLargest": "Solo se muestran los {limit} más grandes.",
  "largest.partial":
    "Este análisis omitió algunos elementos, así que los archivos que contienen no aparecen en la lista.",
  "largest.emptyTitle": "No hay archivos que mostrar",
  "largest.emptyAny": "Este análisis no encontró archivos.",
  "largest.emptyFiltered": "Ningún archivo ocupa {size} o más.",
  "largest.loading": "Ordenando archivos",
  "largest.errorTitle": "No se pudieron ordenar los archivos",

  "finding.back": "Volver a los archivos más grandes",
  "finding.summary": "{size} · {share} de lo medido en este análisis",
  "finding.openFolder": "Ver carpeta en el análisis",
  "finding.opening": "Abriendo su carpeta",
  "finding.openError": "No se pudo abrir la carpeta de {name}",
  "finding.size": "Tamaño lógico",
  "finding.rank": "Posición",
  "finding.rankValue":
    "N.º {rank} entre los archivos más grandes de este análisis",
  "finding.location": "Carpeta",
  "finding.path": "Ruta completa",
  "finding.note":
    "Estos datos son de este análisis. El archivo puede haber cambiado desde entonces; vuelve a analizar para actualizarlos.",
  "finding.returnNote": "Llegaste aquí desde {name} en Archivos más grandes.",
  "finding.matchValue": "N.º {rank} de {total} archivos que coinciden, por tamaño",
  "finding.backToResults": "Volver a los resultados",
  "finding.returnNoteSearch":
    "Llegaste aquí desde {name} en tus resultados de búsqueda.",

  "search.label": "Buscar archivos por nombre o ruta",
  "search.placeholder": "Buscar archivos por nombre o ruta…",
  "search.scopeLegend": "Buscar en",
  "search.scopeAll": "Todo el análisis",
  "search.scopeFolder": "{name} y subcarpetas",
  "search.whereAll": "todo el análisis",
  "search.whereFolder": "{name} y sus subcarpetas",
  "search.scopeNote":
    "La búsqueda recorre todos los archivos de {where}, incluidas las carpetas que no has abierto.",
  "search.scopeHint":
    "Para buscar solo en una carpeta y sus subcarpetas, selecciónala antes en el explorador.",
  "search.titleAll": "Archivos de este análisis",
  "search.titleFolder": "Archivos de {name} y sus subcarpetas",
  "search.description":
    "Archivos cuyo nombre o ruta desde {root} contiene el texto, de mayor a menor. Solo incluye lo que abarcó este análisis.",
  "search.partial":
    "Aquí se omitieron algunos elementos, así que los archivos que contienen no pueden aparecer en los resultados.",
  "search.errorTitle": "No se pudieron buscar los archivos",
  "search.loading": "Buscando archivos",
  "search.searching": "Buscando…",
  "search.emptyTitle": "Ningún archivo coincide",
  "search.emptyQuery":
    "Ningún archivo de {where} tiene “{query}” en su nombre o ruta.",
  "search.emptyAll": "No hay archivos en {where}.",
  "search.emptyMin": "Solo se incluyen archivos de {size} o más.",
  "search.searchAll": "Buscar en todo el análisis",
  "search.anySize": "Incluir archivos de cualquier tamaño",
  "search.clear": "Borrar la búsqueda",
  "search.caption":
    "Archivos de {where} que coinciden con la búsqueda, de mayor a menor. Los tamaños son lógicos.",
  "search.range": "{from}–{to} de {total} archivos que coinciden",
  "search.windowLimit":
    "Solo se pueden recorrer los primeros {limit}. Precisa la búsqueda para ver el resto.",
  "search.pagination": "Paginación de los resultados de búsqueda",

  "show.button": "Mostrar en el Explorador",
  "show.itemLabel": "Mostrar {name} en el Explorador",
  "show.errorTitle": "No se pudo mostrar {name}",
  "show.ITEM_MISSING":
    "Ya no está donde lo encontró el análisis. Puede que se haya movido o borrado después; vuelve a analizar para actualizar los resultados.",
  "show.ITEM_UNAVAILABLE":
    "Windows no permitió que la app lo comprobara. Puede que requiera permisos.",
  "show.SERVICE_UNAVAILABLE":
    "El motor de análisis no respondió. Inténtalo de nuevo cuando esté listo.",
  "show.INVALID_REQUEST": "Este elemento no se puede mostrar.",
  "show.unknown": "No se pudo mostrar el elemento.",

  "skipped.open": "Ver elementos omitidos",
  "skipped.title": "Elementos omitidos",
  "skipped.description":
    "Estos elementos no se midieron o solo se leyeron en parte, así que los totales que los incluyen son un mínimo.",
  "skipped.close": "Cerrar elementos omitidos",
  "skipped.caption": "Elementos omitidos y por qué se omitieron",
  "skipped.columnItem": "Elemento",
  "skipped.columnReason": "Motivo",
  "skipped.root": "La carpeta analizada",
  "skipped.range": "{from}–{to} de {total} elementos omitidos",
  "skipped.truncated":
    "Solo se registraron los primeros {recorded} de {total}.",
  "skipped.empty": "No se omitió nada.",
  "skipped.loading": "Cargando elementos omitidos",
  "skipped.errorTitle": "No se pudieron cargar los elementos omitidos",

  "quick.title": "Empieza rápido",
  "quick.recent": "Carpetas recientes",
  "quick.remove": "Quitar {name} de las carpetas recientes",
  "quick.clear": "Borrar carpetas recientes",
  "quick.common": "Carpetas habituales",
  "quick.home": "Tu carpeta de usuario",
  "quick.desktop": "Escritorio",
  "quick.documents": "Documentos",
  "quick.downloads": "Descargas",
  "quick.pictures": "Imágenes",
  "quick.music": "Música",
  "quick.videos": "Vídeos",

  "shortcuts.title": "Atajos de teclado",
  "shortcuts.chooseFolder": "Elegir una carpeta",
  "shortcuts.rescan": "Volver a analizar",
  "shortcuts.search": "Buscar en la lista visible",
  "shortcuts.parent": "Ir a la carpeta superior",
  "shortcuts.note":
    "Los atajos no hacen nada mientras escribes en un campo o hay un diálogo abierto.",

  "capacity.title": "Capacidad de análisis",
  "capacity.description":
    "En este equipo, un análisis admite unos {count} elementos con rutas de unos {length} caracteres. Las carpetas más grandes se detienen con una explicación.",
  "capacity.unavailable": "Se muestra cuando el motor de análisis esté listo.",
  "category.VIDEO": "Vídeos",
  "category.IMAGE": "Imágenes",
  "category.AUDIO": "Audio",
  "category.DOCUMENT": "Documentos",
  "category.ARCHIVE": "Archivos comprimidos",
  "category.DISK_IMAGE": "Imágenes de disco",
  "category.PROGRAM": "Programas e instaladores",
  "category.OTHER": "Otros tipos",
  "category.NO_EXTENSION": "Sin extensión",
  "category.withExtension": "{category} · .{extension}",

  "date.unknown": "Desconocida",
  "date.future": "posterior al análisis",
  "date.meaning":
    "Cuándo se escribió el archivo por última vez, según lo leyó el análisis. No indica cuándo se abrió o se usó por última vez.",

  "filters.label": "Filtros",
  "filters.typeLabel": "Tipo",
  "filters.anyType": "Todos los tipos",
  "filters.extensionLabel": "Extensión",
  "filters.anyExtension": "Todas las extensiones",
  "filters.extensionOption": ".{extension} · {size}",
  "filters.modifiedLabel": "Modificado",
  "filters.modifiedAny": "Cualquier fecha",
  "filters.modifiedLast30": "En los últimos 30 días",
  "filters.modifiedLastYear": "En el último año",
  "filters.modifiedOver1": "Hace más de un año",
  "filters.modifiedOver3": "Hace más de 3 años",
  "filters.chipSince": "Modificados desde el {date}",
  "filters.chipBefore": "Modificados antes del {date}",
  "filters.remove": "Quitar el filtro: {name}",
  "filters.clear": "Quitar los filtros",
  "filters.dateNote":
    "Los filtros de fecha dejan fuera los archivos sin fecha conocida y cuentan desde el final de este análisis.",
  "filters.emptyFiltered": "Solo se listan los archivos que cumplen todos los filtros.",

  "types.title": "Tipos",
  "types.figureLabel":
    "Archivos de {where} por tipo, {size} en total. Elige un tipo para listar solo sus archivos; los tamaños exactos están en el filtro de tipo.",
  "types.segment": "{category}: {size}, {share}",
  "types.error": "No se pudieron desglosar estos archivos por tipo.",

  "largest.columnType": "Tipo",
  "largest.columnModified": "Modificado",
  "largest.sortBySize": "Ordenar por tamaño, de mayor a menor",
  "largest.sortByDate": "Ordenar por fecha de modificación",

  "finding.matchValueOldest":
    "N.º {rank} de {total} archivos que coinciden, del más antiguo al más reciente",
  "finding.matchValueNewest":
    "N.º {rank} de {total} archivos que coinciden, del más reciente al más antiguo",
  "finding.type": "Tipo",
  "finding.modified": "Modificado",

  "contents.columnModified": "Modificado",
  "contents.folderFiles": "{count} archivos",
};
