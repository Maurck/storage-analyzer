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
  "settings.recentTitle": "Recent folders",
  "settings.rememberRecent": "Save recent folders",
  "settings.rememberRecentHint":
    "Only on this computer. Turning this off stops saving folders and hides the list without deleting it. Nothing on the disk is deleted.",
  "settings.recentCount": "{count} saved",
  "settings.recentCleared": "Recent folders cleared",
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
  "page.rescan": "Rescan {name}",
  "page.selectFolder": "New analysis",
  "page.quickAccess": "Recent and common folders",

  "work.title": "Analysis of {name}",
  "work.analyzedAt": "Analyzed {date}",
  "work.stateComplete": "Complete",
  "work.statePartial": "Partial",
  "work.statePreserved": "Kept from the last analysis",
  "work.statePrevious": "Previous results",
  "work.snapshotNote":
    "Results are a reading of that moment, not live monitoring. Analyze again to see later changes.",

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
  "summary.howCalculated": "How sizes are calculated",
  "summary.subfolders": "Subfolders",
  "summary.skipped": "Skipped items",
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
  "selection.copyPath": "Copy path",
  "selection.copied": "Path copied",
  "selection.copyFailed":
    "Could not copy. Select and copy the path displayed below.",
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

  "distribution.title": "Distribution",
  "distribution.figureLabel":
    "{name}: {size} in listed items. Exact sizes and percentages are available in the contents table below.",
  "distribution.other": "Other items",

  "contents.title": "Folder contents",
  "contents.largestFirst": "Largest first by default",
  "contents.emptyTitle": "This folder is empty",
  "contents.emptyDescription": "There are no items to display in this folder.",
  "contents.searchLabel": "Filter this folder’s items",
  "contents.searchPlaceholder": "Filter this folder…",
  "contents.directOnly": "The filter only reads items directly in {name}.",
  "contents.searchSubfolders": "Search “{query}” in {name} and subfolders",
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
  "contents.revealed": "From largest files",
  "contents.revealedSearch": "From search results",
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
  "folderDialog.nativeTitle": "Select a folder to analyze",

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
  "api.PATH_NOT_IN_SCAN": "This item was not found in the analysis.",

  "scanError.ROOT_UNREADABLE": "The selected folder could not be read.",
  "scanError.ENTRY_LIMIT":
    "This folder holds more than {limit} items, the most one analysis can hold on this computer. Choose a smaller folder.",
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

  "common.close": "Close",
  "common.dismiss": "Dismiss this message",
  "api.INVALID_PARAMETER": "The request was not valid. Please try again.",

  "view.label": "View",
  "view.folder": "Folder contents",
  "view.largest": "Largest files",

  "largest.title": "Largest files in this analysis",
  "largest.description":
    "The largest files found in {root}. Only what this analysis covered is included, not the whole disk.",
  "largest.minSizeLabel": "Minimum size",
  "largest.anySize": "Any size",
  "largest.atLeast": "{size} or more",
  "largest.caption":
    "Largest files in {root}, largest first. Sizes are logical file sizes.",
  "largest.columnName": "Name",
  "largest.columnLocation": "Location",
  "largest.columnSize": "Size",
  "largest.columnActions": "Actions",
  "largest.rootLocation": "Top of the analyzed folder",
  "largest.count": "Showing {shown} of {matching} matching files",
  "largest.onlyLargest": "Only the {limit} largest are listed.",
  "largest.partial":
    "This analysis skipped some items, so files inside them are not ranked.",
  "largest.emptyTitle": "No files to rank",
  "largest.emptyAny": "This analysis found no files.",
  "largest.emptyFiltered": "No file is {size} or larger.",
  "largest.loading": "Ranking files",
  "largest.errorTitle": "Could not rank the files",

  "finding.back": "Back to largest files",
  "finding.summary": "{size} · {share} of what this analysis measured",
  "finding.openFolder": "View folder in the analysis",
  "finding.opening": "Opening its folder",
  "finding.openError": "Could not open the folder of {name}",
  "finding.size": "Logical size",
  "finding.rank": "Position",
  "finding.rankValue": "No. {rank} among the largest files in this analysis",
  "finding.location": "Folder",
  "finding.path": "Full path",
  "finding.note":
    "These details come from this analysis. The file may have changed since; rescan to update them.",
  "finding.returnNote": "You came here from {name} in Largest files.",
  "finding.matchValue": "No. {rank} of {total} matching files, by size",
  "finding.backToResults": "Back to search results",
  "finding.returnNoteSearch":
    "You came here from {name} in your search results.",

  "search.label": "Search files by name or path",
  "search.placeholder": "Search files by name or path…",
  "search.scopeLegend": "Search in",
  "search.scopeAll": "Whole analysis",
  "search.scopeFolder": "{name} and subfolders",
  "search.whereAll": "the whole analysis",
  "search.whereFolder": "{name} and its subfolders",
  "search.scopeNote":
    "Search covers every file in {where}, including folders you have not opened.",
  "search.scopeHint":
    "To search one folder and its subfolders, select it in the explorer first.",
  "search.titleAll": "Files in this analysis",
  "search.titleFolder": "Files in {name} and its subfolders",
  "search.description":
    "Files whose name or path from {root} contains your text, largest first. Only what this analysis covered is included.",
  "search.partial":
    "Some items here were skipped, so files inside them cannot appear in the results.",
  "search.errorTitle": "Could not search the files",
  "search.loading": "Searching files",
  "search.searching": "Searching…",
  "search.emptyTitle": "No matching files",
  "search.emptyQuery": "No file in {where} has “{query}” in its name or path.",
  "search.emptyAll": "There are no files in {where}.",
  "search.emptyMin": "Only files of {size} or more are included.",
  "search.searchAll": "Search the whole analysis",
  "search.anySize": "Include files of any size",
  "search.clear": "Clear the search",
  "search.caption":
    "Files in {where} that match the search, largest first. Sizes are logical file sizes.",
  "search.range": "{from}–{to} of {total} matching files",
  "search.windowLimit":
    "Only the first {limit} can be browsed. Narrow the search to see the rest.",
  "search.pagination": "Search results pagination",

  "show.button": "Show in Explorer",
  "show.itemLabel": "Show {name} in Explorer",
  "show.errorTitle": "Could not show {name}",
  "show.ITEM_MISSING":
    "It is no longer where the analysis found it. It may have been moved or deleted since; rescan to update the results.",
  "show.ITEM_UNAVAILABLE":
    "Windows did not let the app check it. It may need permission.",
  "show.SERVICE_UNAVAILABLE":
    "The analysis engine did not answer. Try again when it is ready.",
  "show.INVALID_REQUEST": "This item cannot be shown.",
  "show.unknown": "The item could not be shown.",

  "skipped.open": "View skipped items",
  "skipped.title": "Skipped items",
  "skipped.description":
    "These items were not measured or were only partly read, so totals that include them are lower bounds.",
  "skipped.close": "Close skipped items",
  "skipped.caption": "Skipped items and why they were skipped",
  "skipped.columnItem": "Item",
  "skipped.columnReason": "Reason",
  "skipped.root": "The analyzed folder",
  "skipped.range": "{from}–{to} of {total} skipped items",
  "skipped.truncated": "Only the first {recorded} of {total} were recorded.",
  "skipped.empty": "Nothing was skipped.",
  "skipped.loading": "Loading skipped items",
  "skipped.errorTitle": "Could not load the skipped items",

  "quick.title": "Start quickly",
  "quick.recent": "Recent folders",
  "quick.remove": "Remove {name} from recent folders",
  "quick.clear": "Clear recent folders",
  "quick.common": "Common folders",
  "quick.home": "Your user folder",
  "quick.desktop": "Desktop",
  "quick.documents": "Documents",
  "quick.downloads": "Downloads",
  "quick.pictures": "Pictures",
  "quick.music": "Music",
  "quick.videos": "Videos",

  "shortcuts.title": "Keyboard shortcuts",
  "shortcuts.chooseFolder": "Choose a folder",
  "shortcuts.rescan": "Rescan",
  "shortcuts.search": "Search the visible list",
  "shortcuts.parent": "Go to the parent folder",
  "shortcuts.note":
    "Shortcuts do nothing while you type in a field or while a dialog is open.",

  "capacity.title": "Analysis capacity",
  "capacity.description":
    "On this computer, one analysis can hold about {count} items with paths of about {length} characters. Larger folders stop with an explanation.",
  "capacity.unavailable": "Shown once the analysis engine is ready.",
};
