export type Language = "en" | "es";

export const languages: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

// Keys are grouped by the surface that shows them. English is the reference:
// its keys define the TranslationKey type, so a missing Spanish entry is a
// compile error rather than a blank label at runtime.
const en = {
  "app.loading": "Opening Storage Analyzer",

  "shell.skipToContent": "Skip to main content",
  "shell.brandHome": "Storage Analyzer home",
  "shell.workspace": "WORKSPACE",
  "shell.footerLocal": "Runs locally on your device",
  "shell.footerUnits": "Sizes in KB, MB and GB · Read-only analysis",
  "shell.openSettings": "Settings",

  "settings.title": "Settings",
  "settings.close": "Close settings",
  "settings.done": "Done",
  "settings.language": "Language",
  "settings.languageHint": "Applies immediately.",
  "settings.sizesNote":
    "Sizes keep the format Windows Explorer uses on this computer, whichever language you pick.",

  "status.scanning": "Scanning",
  "status.completePartial": "Completed with skipped items",
  "status.complete": "Analysis complete",
  "status.cancelled": "Scan cancelled",
  "status.ready": "Ready to explore",

  "page.eyebrow": "KNOW YOUR STORAGE",
  "page.title": "Storage overview",
  "page.subtitle": "See what’s taking up space. Find what matters.",
  "page.rescan": "Rescan",
  "page.selectFolder": "Select folder",

  "welcome.eyebrow": "A CLEARER VIEW OF YOUR FILES",
  "welcome.title": "A little clarity. A lot of space.",
  "welcome.description":
    "Choose a folder to uncover its largest files, explore what’s inside, and understand how your storage adds up.",
  "welcome.chooseFolder": "Choose a folder",
  "welcome.privacy": "Local analysis. Your files stay on your device.",
  "welcome.featureBreakdown": "Visual breakdown",
  "welcome.featureFind": "Find large files",
  "welcome.featureExplore": "Explore every folder",

  "error.tryAgain": "Try again",
  "error.unknown": "Something went wrong. Please try again.",
  "error.unreadable-response":
    "The local service returned an unreadable response. Please try again.",
  "error.request-failed":
    "The request could not be completed. Please try again.",
  "error.timeout":
    "The local service took too long to respond. You can retry safely.",
  "error.offline":
    "Could not connect to the local analysis service. Start the backend and try again.",
  "error.already-starting": "An analysis is already starting.",
  "error.startTitle": "Could not start the analysis",
  "error.expiredTitle": "Analysis session expired",
  "error.expiredDescription":
    "The local service restarted or this analysis expired. Choose a folder to start a new scan.",
  "error.connectionTitle": "Connection interrupted",
  "error.previousResults": " Your previous results are still available.",
  "error.selectAnother": "Select another folder",
  "error.scanFailedTitle": "Analysis could not finish",
  "error.scanFailedDescription": "Choose an accessible folder and try again.",
  "error.cancelledWithResults": "Your previous results are still available.",
  "error.cancelledNoResults":
    "Choose a folder whenever you’re ready to start again.",
  "error.couldNotCancel": "Could not cancel",
  "error.couldNotCancelHint": "Use Cancel scan to retry.",
  "error.branchTitle": "Could not open {name}",
  "error.itemUnreadableTitle": "This item could not be read",
  "error.itemUnreadableDescription":
    "Check the folder’s permissions, then rescan to try again.",

  "progress.label": "Analysis progress",
  "progress.spinner": "Scanning files",
  "progress.heading": "Analyzing your folder…",
  "progress.starting": "Starting analysis…",
  "progress.counts": "{files} files · {bytes} found · {skipped} skipped",
  "progress.cancel": "Cancel scan",

  "summary.label": "Analysis summary",
  "summary.knownSize": "Known size",
  "summary.totalSize": "Total size",
  "summary.logicalSize": "Logical size · Explorer units",
  "summary.filesAnalyzed": "Files analyzed",
  "summary.filesAcross": "Across the selected folder",
  "summary.subfolders": "Subfolders",
  "summary.subfoldersHint": "A hierarchy to explore",
  "summary.skipped": "Skipped items",
  "summary.skippedIncomplete": "Some sizes may be incomplete",
  "summary.skippedNone": "No read errors reported",
  "summary.partialTitle": "Some items could not be measured",
  "summary.partialDescription":
    "Results show readable file bytes only. Symbolic links, inaccessible files, or scan limits may leave totals incomplete.",

  "explorer.title": "Explorer",
  "explorer.loaded": "{count} loaded",
  "explorer.close": "Close explorer",
  "explorer.label": "File explorer",
  "explorer.searchLabel": "Search loaded items",
  "explorer.searchPlaceholder": "Search loaded items…",
  "explorer.hint": "Open a folder to load its contents.",
  "explorer.treeLabel": "Folders and files",
  "explorer.noMatches": "No loaded items match “{query}”.",
  "explorer.resize": "Resize explorer",
  "explorer.navigate": "Navigate",
  "explorer.select": "Select",

  "tree.skippedItem": "skipped item",
  "tree.file": "file",
  "tree.folder": "folder",
  "tree.incomplete": "incomplete",

  "selection.breadcrumbLabel": "Folder path",
  "selection.files": "{count} files",
  "selection.incomplete": "Incomplete",
  "selection.explorer": "Explorer",
  "selection.copyPath": "Copy folder path",
  "selection.copied": "Path copied",
  "selection.copyFailed":
    "Could not copy. Select and copy the path displayed below.",
  "selection.hideChart": "Hide chart",
  "selection.showChart": "Show chart",
  "selection.loadingContents": "Loading folder contents",

  "file.title": "File details",
  "file.description":
    "This file contributes to the total logical size of its parent folder.",
  "file.name": "File name",
  "file.size": "Size",
  "file.path": "Path",

  "load.title": "Open this folder",
  "load.description": "Load its contents to explore the next level.",
  "load.button": "Load contents",

  "distribution.eyebrow": "AT A GLANCE",
  "distribution.title": "Space distribution",
  "distribution.partial": "Partial results",
  "distribution.logical": "Logical size",
  "distribution.emptyTitle": "No storage to chart",
  "distribution.emptyDescription":
    "This folder contains no readable file bytes. Empty folders and skipped items are listed below.",
  "distribution.figureLabel":
    "{name}: {size} in listed items. Exact sizes and percentages are available in the contents table below.",
  "distribution.inThisFolder": "IN THIS FOLDER",
  "distribution.other": "Other items",

  "contents.title": "Folder contents",
  "contents.largestFirst": "Largest first by default",
  "contents.emptyTitle": "This folder is empty",
  "contents.emptyDescription": "There are no items to display in this folder.",
  "contents.searchLabel": "Search this folder",
  "contents.searchPlaceholder": "Search this folder…",
  "contents.filterLabel": "Filter by type",
  "contents.allTypes": "All types",
  "contents.folders": "Folders",
  "contents.files": "Files",
  "contents.skippedItems": "Skipped items",
  "contents.reset": "Reset",
  "contents.noMatchTitle": "No matching items",
  "contents.noMatchDescription":
    "Try another name or clear the active filters.",
  "contents.clearFilters": "Clear filters",
  "contents.caption":
    "Contents of {name}. Sizes are logical file sizes as Windows Explorer reports them, not allocated disk space.",
  "contents.columnName": "Name",
  "contents.columnType": "Type",
  "contents.columnSize": "Size",
  "contents.columnShare": "Share",
  "contents.partial": "Partial",
  "contents.typeFile": "File",
  "contents.typeSkipped": "Skipped",
  "contents.typeFolder": "Folder",
  "contents.range": "{from}–{to} of {total} items",
  "contents.noItems": "0 items",
  "contents.pagination": "Contents pagination",
  "contents.previousPage": "Previous page",
  "contents.nextPage": "Next page",
  "contents.pageOf": "Page {page} of {pages}",

  "folderDialog.title": "Choose a folder",
  "folderDialog.close": "Close folder dialog",
  "folderDialog.description":
    "Enter the absolute path of a folder on the machine running the analysis service.",
  "folderDialog.label": "Folder path",
  "folderDialog.cancel": "Cancel",
  "folderDialog.analyze": "Analyze folder",
};

export type TranslationKey = keyof typeof en;

const es: Record<TranslationKey, string> = {
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
  "page.rescan": "Volver a analizar",
  "page.selectFolder": "Elegir carpeta",

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
    "No se pudo conectar con el servicio de análisis local. Arranca el backend e inténtalo de nuevo.",
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
  "summary.logicalSize": "Tamaño lógico · Unidades del Explorador",
  "summary.filesAnalyzed": "Archivos analizados",
  "summary.filesAcross": "En toda la carpeta elegida",
  "summary.subfolders": "Subcarpetas",
  "summary.subfoldersHint": "Una jerarquía para explorar",
  "summary.skipped": "Elementos omitidos",
  "summary.skippedIncomplete": "Algunos tamaños pueden estar incompletos",
  "summary.skippedNone": "Sin errores de lectura",
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
  "selection.copyPath": "Copiar la ruta de la carpeta",
  "selection.copied": "Ruta copiada",
  "selection.copyFailed":
    "No se pudo copiar. Selecciona y copia la ruta que aparece abajo.",
  "selection.hideChart": "Ocultar el gráfico",
  "selection.showChart": "Mostrar el gráfico",
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

  "distribution.eyebrow": "DE UN VISTAZO",
  "distribution.title": "Distribución del espacio",
  "distribution.partial": "Resultados parciales",
  "distribution.logical": "Tamaño lógico",
  "distribution.emptyTitle": "No hay nada que graficar",
  "distribution.emptyDescription":
    "Esta carpeta no contiene bytes legibles. Las carpetas vacías y los elementos omitidos aparecen abajo.",
  "distribution.figureLabel":
    "{name}: {size} en los elementos listados. Los tamaños y porcentajes exactos están en la tabla de contenido de abajo.",
  "distribution.inThisFolder": "EN ESTA CARPETA",
  "distribution.other": "Otros elementos",

  "contents.title": "Contenido de la carpeta",
  "contents.largestFirst": "De mayor a menor por defecto",
  "contents.emptyTitle": "Esta carpeta está vacía",
  "contents.emptyDescription": "No hay elementos que mostrar en esta carpeta.",
  "contents.searchLabel": "Buscar en esta carpeta",
  "contents.searchPlaceholder": "Buscar en esta carpeta…",
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
};

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en,
  es,
};
