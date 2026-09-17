// Keys are grouped by the surface that shows them. English is the reference:
// its keys define the TranslationKey type, so a missing Spanish entry is a
// compile error rather than a blank label at runtime.
export const en = {
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
    "The local analysis service is not responding. Wait until it is ready and try again.",
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
  "summary.logicalSize": "Logical file size, not disk usage",
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

  "common.loading": "Loading",
  "tree.loading": "Loading {name}",

  "error.invalid-scan":
    "The local service returned an invalid scan. Please restart the analysis.",
  "error.invalid-data":
    "The analysis data is incomplete. Check that the app and its analysis engine are up to date.",
  "error.incomplete-scan":
    "The completed analysis did not include a folder. Please try again.",
  "error.service-unavailable":
    "Another service is answering on the analysis port.",
  "error.unknownService":
    "The analysis engine reported a problem without explaining it. Please try again.",

  "api.INVALID_REQUEST": "The request was not valid. Choose a folder again.",
  "api.PATH_REQUIRED": "Enter the absolute path of a folder.",
  "api.PATH_INVALID": "This folder path is not valid.",
  "api.PATH_NOT_ABSOLUTE":
    "Enter a full path that starts at the drive, such as C:\\Users\\you.",
  "api.FOLDER_NOT_FOUND":
    "This folder does not exist. It may have been moved or renamed.",
  "api.NOT_A_FOLDER": "Choose a folder, not a file or a shortcut.",
  "api.FOLDER_UNREADABLE": "This folder cannot be read. Check its permissions.",
  "api.SCANS_AT_CAPACITY":
    "Two analyses are already running. Cancel one or wait for it to finish.",
  "api.SCANNER_BUSY": "The analysis engine is busy. Try again in a moment.",
  "api.SCAN_NOT_FOUND":
    "This analysis has expired or no longer exists. Start a new one.",
  "api.SCAN_NOT_COMPLETE":
    "Folder details are available once the analysis finishes.",
  "api.PATH_OUTSIDE_SCAN": "This folder is not part of the current analysis.",
  "api.PATH_NOT_IN_SCAN": "This folder was not found in the analysis.",

  "scanError.ROOT_UNREADABLE": "The selected folder could not be read.",
  "scanError.ENTRY_LIMIT":
    "This folder holds more than {limit} items, the most one analysis can hold. Choose a smaller folder.",
  "scanError.MEMORY_BUDGET":
    "The analysis engine ran out of room for results. Choose a smaller folder, or cancel another analysis and try again.",
  "scanError.OUT_OF_MEMORY":
    "The analysis engine ran out of memory. Choose a smaller folder or restart the app, then try again.",
  "scanError.SCAN_FAILED":
    "The analysis could not finish. Check that the folder is accessible and try again.",

  "nodeIssue.EXCLUDED_LINK": "Links and special files are not followed.",
  "nodeIssue.DEPTH_LIMIT": "Too deep to analyze; its contents are not counted.",
  "nodeIssue.PATH_UNREADABLE":
    "Could not be read. It may need permission or may have moved.",
  "nodeIssue.CONTENTS_PARTIALLY_UNREADABLE":
    "Some of its items could not be read.",
  "nodeIssue.unknown": "This item could not be fully measured.",

  "service.statusChecking": "Connecting",
  "service.statusStarting": "Starting the engine",
  "service.statusUnavailable": "Engine unavailable",
  "service.checkingTitle": "Connecting to the analysis engine…",
  "service.startingTitle": "Preparing the analysis engine…",
  "service.startingDescription":
    "This can take a few seconds, a little longer the first time. You can choose a folder as soon as it is ready.",
  "service.unavailableTitle": "The analysis engine is not responding",
  "service.unavailableDescription":
    "It may still be starting, or it may have stopped. New analyses are unavailable until it responds; the app keeps checking.",
  "service.stoppedTitle": "The analysis engine stopped responding",
  "service.stoppedDescription":
    "New analyses are unavailable until it responds again; the app keeps checking.",
  "service.resultsKept":
    "The results on screen are from the last analysis. Folders that have not loaded yet cannot be opened until the engine responds.",
  "service.portInUseTitle": "Another program is using the engine’s address",
  "service.portInUseDescription":
    "The analysis engine needs {origin}, but another program answers there. Close that program and try again.",
  "service.versionTitle": "The analysis engine is a different version",
  "service.versionDescription":
    "The engine answering at {origin} does not match this version of the app. Stop it and try again so the app can start its own.",
  "service.unsupportedTitle": "Start the analysis engine separately",
  "service.unsupportedDescription":
    "On this system the app cannot start its engine by itself. Start the backend as its guide describes, then try again.",
  "service.timeoutTitle": "The analysis engine is taking too long to start",
  "service.timeoutDescription":
    "The app stopped waiting for it. Try again, or restart the app if it never becomes ready.",
  "service.exitedTitle": "The analysis engine stopped",
  "service.exitedDescription": "It closed unexpectedly. Try again to start it.",
  "service.retrying": "Trying again",

  "progress.reading": "Reading {path}",
  "progress.elapsed": "{time} elapsed",
  "progress.stalled":
    "No new items in the last few seconds. Some folders are slow to read: you can keep waiting or cancel.",
  "progress.noResponse":
    "Waiting for the analysis engine to answer. The time shown is from its last reply.",

  "summary.sizeNote":
    "Sizes add up file lengths, as Explorer shows them, not the space they take on disk. Compressed and sparse files take less, files with several hard links count once per path, and cloud-only files (for example in OneDrive) count in full while taking little or no local space. Deleting files does not necessarily free the same amount.",
  "summary.volume":
    "Drive at the start of the analysis: {free} free of {total}",
  "summary.volumeUnknown": "Drive capacity: unknown",
};
