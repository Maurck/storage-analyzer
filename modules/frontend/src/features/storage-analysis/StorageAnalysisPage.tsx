import React, { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "react-query";
import { useStorageScan } from "./hooks/useStorageScan";
import { useServiceStatus } from "./hooks/useServiceStatus";
import { ServiceStatusBanner } from "./components/ServiceStatusBanner";
import { ScanProgress } from "./components/ScanProgress";
import { useShowItem } from "./hooks/useShowItem";
import { SHORTCUTS, useShortcuts } from "./hooks/useShortcuts";
import { DirectoryNode, NodeCache, RankedFile } from "./model/directory.types";
import { getAncestors, getCapacity, getDirectory } from "./api/directory.api";
import {
  LargestFiles,
  LargestState,
  initialLargestState,
} from "./components/LargestFiles";
import { SkippedItemsDialog } from "./components/SkippedItemsDialog";
import { QuickStart } from "./components/QuickStart";
import { DirectoryTree } from "./components/DirectoryTree";
import { SpaceDistribution } from "./components/SpaceDistribution";
import {
  ContentsState,
  ContentsTable,
  PAGE_SIZE,
  contentsItems,
  initialContentsState,
} from "./components/ContentsTable";
import { ScanSummary } from "./components/ScanSummary";
import { WelcomeState } from "./components/WelcomeState";
import { FolderPathDialog } from "./components/FolderPathDialog";
import { Button } from "../../shared/ui/Button";
import { IconButton } from "../../shared/ui/IconButton";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Alert } from "../../shared/components/Alert";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import {
  formatBytes,
  formatDateTime,
  formatNumber,
} from "../../shared/lib/format";
import {
  describeCode,
  useErrorMessage,
} from "../../shared/i18n/useErrorMessage";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { SplitPane } from "../../layouts/SplitPane";
import { SegmentedControl } from "../../shared/ui/SegmentedControl";
import { CommonFolder, desktopBridge } from "../../shared/lib/desktopBridge";
import {
  clearRecentFolders,
  forgetFolder,
  readRecentFolders,
  readRememberRecent,
  rememberFolder,
  writeRememberRecent,
} from "../../shared/lib/recentFolders";
import { AppShell } from "../../layouts/AppShell";
import { SettingsDialog } from "../settings/SettingsDialog";
import { QuickAccessMenu } from "./components/QuickAccessMenu";
import { useTranslation } from "../../shared/i18n/LanguageProvider";

const resultStateLabels = {
  complete: "work.stateComplete",
  partial: "work.statePartial",
  preserved: "work.statePreserved",
  previous: "work.statePrevious",
} as const;

export function StorageAnalysisPage() {
  const { scan, snapshot, start, cancel, query, busy, expired } =
    useStorageScan();
  const client = useQueryClient();
  const service = useServiceStatus();
  const serviceReady = service.status.state === "ready";
  const i18n = useTranslation();
  const { t } = i18n;
  const describeError = useErrorMessage();
  const [nodes, setNodes] = useState<NodeCache>({});
  const [selectedPath, setSelectedPath] = useState("");
  const [loadingPaths, setLoadingPaths] = useState(new Set<string>());
  const [branchError, setBranchError] = useState<{
    node: DirectoryNode;
    message: string;
  } | null>(null);
  const [pickerError, setPickerError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [view, setView] = useState<"folder" | "largest">("folder");
  // What each view shows, kept per scan so that going from one to the other
  // and back never rebuilds a finding.
  const [largestState, setLargestState] =
    useState<LargestState>(initialLargestState);
  const [restoreLargest, setRestoreLargest] = useState(false);
  const [contentsStates, setContentsStates] = useState<
    Record<string, ContentsState>
  >({});
  // A ranked file opened in its folder, and the way back to the ranking.
  const [reveal, setReveal] = useState<{
    folder: string;
    target: string;
    name: string;
    paths: string[];
    token: number;
    focus: boolean;
  } | null>(null);
  const revealToken = useRef(0);
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [recent, setRecent] = useState(readRecentFolders);
  const [rememberRecent, setRememberRecent] = useState(readRememberRecent);
  // Turning the preference off hides the list; only clearing deletes it.
  const visibleRecent = rememberRecent ? recent : [];
  const [common, setCommon] = useState<CommonFolder[]>([]);
  const skippedDialog = useRef<HTMLDialogElement>(null);
  const pathDialog = useRef<HTMLDialogElement>(null);
  const explorerDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const currentSnapshot = useRef<string>();
  const compact = useMediaQuery("(max-width: 767px)");
  currentSnapshot.current = snapshot?.id;
  const root = snapshot?.root;
  const selected = nodes[selectedPath] ?? root;
  const showSelected = useShowItem(snapshot?.id);
  const capacity = useQuery(["capacity"], ({ signal }) => getCapacity(signal), {
    enabled: serviceReady,
    staleTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    desktopBridge()
      ?.getCommonFolders?.()
      .then(setCommon)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (skippedOpen) skippedDialog.current?.showModal();
    else skippedDialog.current?.close();
  }, [skippedOpen]);

  useEffect(() => {
    if (!snapshot?.root) return;
    const initial: NodeCache = { [snapshot.root.absolutePath]: snapshot.root };
    snapshot.root.subdirectories.forEach((child) => {
      initial[child.absolutePath] = child;
    });
    setNodes(initial);
    setSelectedPath(snapshot.root.absolutePath);
    setLoadingPaths(new Set());
    setBranchError(null);
    // A new analysis starts clean: filters and findings belong to their scan.
    setLargestState(initialLargestState);
    setRestoreLargest(false);
    setContentsStates({});
    setReveal(null);
  }, [snapshot?.id]);

  useEffect(() => {
    if (compact && drawerOpen) explorerDialog.current?.showModal();
    else explorerDialog.current?.close();
  }, [compact, drawerOpen]);

  async function loadNode(node: DirectoryNode) {
    if (!snapshot || node.childrenLoaded || node.type !== "FOLDER") return;
    const id = snapshot.id;
    setLoadingPaths((value) => new Set(value).add(node.absolutePath));
    setBranchError(null);
    try {
      const loaded = await client.fetchQuery(
        ["directory", id, node.absolutePath],
        ({ signal }) => getDirectory(id, node.absolutePath, signal),
        { staleTime: Infinity, retry: 1 },
      );
      if (currentSnapshot.current !== id) return;
      setNodes((value) => {
        const next = { ...value, [loaded.absolutePath]: loaded };
        loaded.subdirectories.forEach((child) => {
          if (!next[child.absolutePath]?.childrenLoaded)
            next[child.absolutePath] = child;
        });
        return next;
      });
    } catch (error) {
      if (currentSnapshot.current === id)
        setBranchError({ node, message: describeError(error) });
    } finally {
      if (currentSnapshot.current === id)
        setLoadingPaths((value) => {
          const next = new Set(value);
          next.delete(node.absolutePath);
          return next;
        });
    }
  }

  /**
   * Opens a ranked file's folder with only the folders that lead to it, puts
   * the file on the table's visible page and keeps the way back.
   */
  async function openFolderOf(file: RankedFile) {
    if (!snapshot) return;
    const id = snapshot.id;
    const token = ++revealToken.current;
    const ancestry = await client.fetchQuery(
      ["ancestors", id, file.absolutePath],
      ({ signal }) => getAncestors(id, file.absolutePath, signal),
      { staleTime: Infinity, retry: 1 },
    );
    // A later request or another analysis has taken over.
    if (currentSnapshot.current !== id || revealToken.current !== token) return;
    const folder = ancestry.ancestors[ancestry.ancestors.length - 1];
    if (!folder) return;
    ancestry.ancestors.forEach((ancestor) =>
      client.setQueryData(["directory", id, ancestor.absolutePath], ancestor),
    );
    setNodes((value) => {
      const next = { ...value };
      ancestry.ancestors.forEach((ancestor) => {
        next[ancestor.absolutePath] = ancestor;
        ancestor.subdirectories.forEach((child) => {
          if (!next[child.absolutePath]?.childrenLoaded)
            next[child.absolutePath] = child;
        });
      });
      return next;
    });
    setContentsStates((states) => {
      const cleared: ContentsState = {
        ...(states[folder.absolutePath] ?? initialContentsState),
        search: "",
        filter: "all",
      };
      const index = contentsItems(folder, cleared).findIndex(
        (child) => child.absolutePath === ancestry.entry.absolutePath,
      );
      return {
        ...states,
        [folder.absolutePath]: {
          ...cleared,
          page: Math.max(0, Math.floor(index / PAGE_SIZE)),
        },
      };
    });
    setLargestState((state) => ({ ...state, detail: false }));
    setSelectedPath(folder.absolutePath);
    setBranchError(null);
    setCopyStatus("");
    showSelected.clearFailure();
    setReveal({
      folder: folder.absolutePath,
      target: ancestry.entry.absolutePath,
      name: ancestry.entry.name,
      paths: ancestry.ancestors.map((ancestor) => ancestor.absolutePath),
      token,
      focus: true,
    });
    setView("folder");
  }

  function switchView(next: "folder" | "largest") {
    setView(next);
    setRestoreLargest(false);
    if (next === "largest") setReveal(null);
  }

  function backToLargest() {
    setView("largest");
    setRestoreLargest(true);
    setReveal(null);
  }

  const revealFocused = useCallback(
    () => setReveal((value) => value && { ...value, focus: false }),
    [],
  );

  function selectNode(node: DirectoryNode) {
    setSelectedPath(node.absolutePath);
    setView("folder");
    setBranchError(null);
    setCopyStatus("");
    showSelected.clearFailure();
    setDrawerOpen(false);
    void loadNode(nodes[node.absolutePath] ?? node);
  }

  async function begin(path: string) {
    if (busy || !serviceReady || !path.trim()) return;
    setPickerError("");
    cancel.reset();
    const started = await start.mutateAsync(path.trim());
    if (rememberRecent)
      setRecent((folders) => rememberFolder(folders, started.path));
    pathDialog.current?.close();
  }

  async function chooseFolder() {
    if (!serviceReady) return;
    setPickerError("");
    start.reset();
    if (!window.storageAnalyzer) {
      pathDialog.current?.showModal();
      pathDialog.current
        ?.querySelector<HTMLInputElement>("#folder-path")
        ?.focus();
      return;
    }
    try {
      const path = await window.storageAnalyzer.selectDirectory({
        title: t("folderDialog.nativeTitle"),
        buttonLabel: t("folderDialog.analyze"),
      });
      if (path) await begin(path);
    } catch (error) {
      setPickerError(describeError(error));
    }
  }

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(selected!.absolutePath);
      setCopyStatus(t("selection.copied"));
    } catch {
      setCopyStatus(t("selection.copyFailed"));
    }
  }

  function breadcrumbs(): DirectoryNode[] {
    if (!root || !selected) return [];
    const trail: DirectoryNode[] = [selected];
    const seen = new Set([selected.absolutePath]);
    let path = selected.absolutePath;
    while (path !== root.absolutePath) {
      const parent = Object.values(nodes).find((node) =>
        node.subdirectories.some((child) => child.absolutePath === path),
      );
      if (!parent || seen.has(parent.absolutePath)) break;
      trail.unshift(parent);
      seen.add(parent.absolutePath);
      path = parent.absolutePath;
    }
    if (trail[0].absolutePath !== root.absolutePath) trail.unshift(root);
    return trail;
  }

  function rescan() {
    if (snapshot) void begin(snapshot.path).catch(() => {});
  }

  useShortcuts({
    chooseFolder: () => {
      if (!busy) void chooseFolder();
    },
    rescan: () => {
      if (!busy) rescan();
    },
    search: () => {
      const target =
        view === "folder"
          ? document.querySelector<HTMLInputElement>("#contents-search")
          : null;
      (
        target ?? document.querySelector<HTMLInputElement>("#tree-search")
      )?.focus();
    },
    parent: () => {
      const trail = breadcrumbs();
      if (view === "folder" && trail.length > 1)
        selectNode(trail[trail.length - 2]);
    },
  });

  const explorer = root && (
    <>
      <div className="explorer-heading">
        <h2>{t("explorer.title")}</h2>
        <span className="subtle-badge">
          {t("explorer.loaded", {
            count: formatNumber(Object.keys(nodes).length),
          })}
        </span>
        {compact && (
          <IconButton
            label={t("explorer.close")}
            variant="ghost"
            onClick={() => setDrawerOpen(false)}
          >
            <Icon name="close" />
          </IconButton>
        )}
      </div>
      <DirectoryTree
        key={snapshot!.id}
        root={root}
        nodes={nodes}
        selectedPath={selectedPath}
        onSelect={selectNode}
        onLoad={loadNode}
        loadingPaths={loadingPaths}
        reveal={reveal ?? undefined}
      />
    </>
  );
  const statusText = busy
    ? t("status.scanning")
    : service.status.state === "checking"
      ? t("service.statusChecking")
      : service.status.state === "starting"
        ? t("service.statusStarting")
        : !serviceReady
          ? t("service.statusUnavailable")
          : scan?.status === "COMPLETE"
            ? scan.root?.partial
              ? t("status.completePartial")
              : t("status.complete")
            : scan?.status === "CANCELLED"
              ? t("status.cancelled")
              : t("status.ready");

  // What the results on screen are: a finished analysis, or the last one kept
  // while a new analysis runs or the engine is away.
  const resultState = busy
    ? "previous"
    : !serviceReady
      ? "preserved"
      : root?.partial
        ? "partial"
        : "complete";
  const analyzedAt = snapshot?.finishedAt ?? snapshot?.startedAt ?? undefined;
  const pageActions = (
    <div className="page-actions">
      {snapshot && root && (
        <Button
          variant="secondary"
          onClick={rescan}
          disabled={busy || !serviceReady}
          aria-keyshortcuts={SHORTCUTS.rescan}
        >
          <Icon name="refresh" size={17} />
          {t("page.rescan", { name: root.name })}
        </Button>
      )}
      <div className="new-analysis">
        <Button
          onClick={() => {
            void chooseFolder();
          }}
          disabled={busy || !serviceReady}
          loading={start.isLoading}
          aria-keyshortcuts={SHORTCUTS.chooseFolder}
        >
          <Icon name="folder-open" size={18} />
          {t("page.selectFolder")}
        </Button>
        {root && (
          <QuickAccessMenu
            recent={visibleRecent}
            common={common}
            disabled={busy || !serviceReady}
            onAnalyze={(path) => {
              void begin(path).catch(() => {});
            }}
            onForget={(path) =>
              setRecent((folders) => forgetFolder(folders, path))
            }
            onClear={() => setRecent(clearRecentFolders())}
          />
        )}
      </div>
    </div>
  );

  return (
    <AppShell
      status={statusText}
      busy={busy || ["checking", "starting"].includes(service.status.state)}
      offline={
        !busy &&
        ["unavailable", "failed", "incompatible"].includes(service.status.state)
      }
      onOpenSettings={() => settingsDialog.current?.showModal()}
      overlays={
        <>
          <SettingsDialog
            dialogRef={settingsDialog}
            capacity={capacity.data}
            rememberRecent={rememberRecent}
            onRememberRecentChange={(value) => {
              writeRememberRecent(value);
              setRememberRecent(value);
            }}
            recentCount={recent.length}
            onClearRecent={() => setRecent(clearRecentFolders())}
          />
          <SkippedItemsDialog
            dialogRef={skippedDialog}
            scanId={snapshot?.id}
            open={skippedOpen}
            onClose={() => setSkippedOpen(false)}
          />
          <FolderPathDialog
            dialogRef={pathDialog}
            pending={start.isLoading}
            unavailable={!serviceReady}
            error={start.isError ? describeError(start.error) : undefined}
            onAnalyze={begin}
          />
          {compact && (
            <dialog
              ref={explorerDialog}
              className="explorer-dialog"
              aria-label={t("explorer.label")}
              onClose={() => setDrawerOpen(false)}
            >
              {explorer}
            </dialog>
          )}
        </>
      }
    >
      {root && snapshot ? (
        <section className="work-header" aria-labelledby="page-title">
          <div className="work-heading">
            <h1 id="page-title">{t("work.title", { name: root.name })}</h1>
            <p className="work-meta">
              <span className={`state-tag state-tag--${resultState}`}>
                {t(resultStateLabels[resultState])}
              </span>
              {analyzedAt && (
                <time dateTime={analyzedAt}>
                  {t("work.analyzedAt", { date: formatDateTime(analyzedAt) })}
                </time>
              )}
              <span className="work-path" title={snapshot.path}>
                {snapshot.path}
              </span>
            </p>
          </div>
          {pageActions}
        </section>
      ) : (
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" /> {t("page.eyebrow")}
            </div>
            <h1 id="page-title">
              {t("page.title")}
              <span className="heading-period">.</span>
            </h1>
            <p>{t("page.subtitle")}</p>
          </div>
          {pageActions}
        </section>
      )}
      <ServiceStatusBanner
        status={service.status}
        hasResults={!!snapshot}
        retrying={service.retrying}
        onRetry={() => {
          void service.retry();
        }}
      />
      <div className="global-feedback" aria-live="polite" aria-atomic="true">
        <span className="sr-only">{statusText}</span>
      </div>
      {(pickerError || start.isError) && (
        <div className="page-feedback">
          <ErrorState
            title={t("error.startTitle")}
            description={pickerError || describeError(start.error)}
            onRetry={() => {
              void chooseFolder();
            }}
          />
        </div>
      )}
      {/* When the engine is away, its banner already explains the failure. */}
      {query.isError && (expired || serviceReady) && (
        <div className="page-feedback">
          <ErrorState
            title={
              expired ? t("error.expiredTitle") : t("error.connectionTitle")
            }
            description={
              expired
                ? t("error.expiredDescription")
                : describeError(query.error) +
                  (snapshot ? t("error.previousResults") : "")
            }
            retryLabel={
              expired ? t("error.selectAnother") : t("error.tryAgain")
            }
            onRetry={() => {
              if (expired) void chooseFolder();
              else void query.refetch();
            }}
          />
        </div>
      )}
      {scan?.status === "ERROR" && (
        <div className="page-feedback">
          <ErrorState
            title={t("error.scanFailedTitle")}
            description={describeCode(
              i18n,
              "scanError",
              scan.errorCode,
              "error.scanFailedDescription",
              scan.errorParams,
            )}
            onRetry={() => {
              void begin(scan.path).catch(() => {});
            }}
          />
        </div>
      )}
      {scan?.status === "CANCELLED" && (
        <div className="page-feedback">
          <Alert variant="info" title={t("status.cancelled")}>
            {snapshot
              ? t("error.cancelledWithResults")
              : t("error.cancelledNoResults")}
          </Alert>
        </div>
      )}
      {busy && (
        <ScanProgress
          scan={scan}
          unresponsive={query.isError}
          cancelling={cancel.isLoading}
          onCancel={() => cancel.mutate()}
        />
      )}
      {cancel.isError && (
        <div className="page-feedback">
          <Alert variant="error" title={t("error.couldNotCancel")}>
            {describeError(cancel.error)} {t("error.couldNotCancelHint")}
          </Alert>
        </div>
      )}
      {!root && !busy && (
        <WelcomeState
          onChooseFolder={chooseFolder}
          disabled={!serviceReady}
          quickStart={
            (visibleRecent.length > 0 || common.length > 0) && (
              <QuickStart
                recent={visibleRecent}
                common={common}
                disabled={!serviceReady}
                onAnalyze={(path) => {
                  void begin(path).catch(() => {});
                }}
                onForget={(path) =>
                  setRecent((folders) => forgetFolder(folders, path))
                }
                onClear={() => setRecent(clearRecentFolders())}
              />
            )
          }
        />
      )}
      {!root && busy && (
        <div className="initial-skeleton" aria-hidden="true">
          <Skeleton height={112} />
          <Skeleton height={320} />
          <Skeleton height={180} />
        </div>
      )}
      {root && selected && (
        <>
          <ScanSummary
            root={root}
            skippedCount={snapshot?.skippedCount ?? 0}
            volume={snapshot?.volume}
            onOpenSkipped={() => setSkippedOpen(true)}
          />
          <SplitPane
            sidebar={
              !compact ? (
                <aside
                  className="explorer-panel"
                  aria-label={t("explorer.label")}
                >
                  {explorer}
                </aside>
              ) : null
            }
          >
            <SegmentedControl<"folder" | "largest">
              name="workspace-view"
              className="view-switch"
              legend={t("view.label")}
              value={view}
              onChange={switchView}
              options={[
                { value: "folder", label: t("view.folder") },
                { value: "largest", label: t("view.largest") },
              ]}
            />
            {view === "largest" ? (
              <LargestFiles
                key={snapshot!.id}
                scanId={snapshot!.id}
                root={root}
                state={largestState}
                onStateChange={setLargestState}
                restoreList={restoreLargest}
                onOpenSkipped={() => setSkippedOpen(true)}
                onOpenFolder={openFolderOf}
                headingAction={
                  compact && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDrawerOpen(true)}
                    >
                      <Icon name="menu" size={17} />
                      {t("selection.explorer")}
                    </Button>
                  )
                }
              />
            ) : (
              <>
                {reveal && (
                  <div className="return-bar">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={backToLargest}
                    >
                      <Icon name="arrow-left" size={17} />
                      {t("finding.back")}
                    </Button>
                    <span className="muted">
                      {t("finding.returnNote", { name: reveal.name })}
                    </span>
                  </div>
                )}
                <div className="selection-header">
                  <nav
                    className="path-breadcrumbs"
                    aria-label={t("selection.breadcrumbLabel")}
                  >
                    {breadcrumbs().map((node, index, all) => (
                      <React.Fragment key={node.absolutePath}>
                        {index > 0 && <Icon name="chevron-right" size={14} />}
                        <button
                          onClick={() => selectNode(node)}
                          aria-current={
                            index === all.length - 1 ? "location" : undefined
                          }
                          title={node.absolutePath}
                        >
                          {index === 0 && <Icon name="folder" size={15} />}
                          <span>{node.name}</span>
                        </button>
                      </React.Fragment>
                    ))}
                  </nav>
                  <div className="selection-title-row">
                    <div className="selection-title">
                      <span className="selection-icon">
                        <Icon
                          name={
                            selected.type === "FILE" ? "file" : "folder-open"
                          }
                          size={24}
                        />
                      </span>
                      <div>
                        <h2>{selected.name}</h2>
                        <span className="muted">
                          {formatBytes(selected.sizeBytes)}
                          {selected.type === "FOLDER" &&
                            " · " +
                              t("selection.files", {
                                count: formatNumber(selected.fileCount),
                              })}
                          {selected.partial &&
                            " · " + t("selection.incomplete")}
                        </span>
                      </div>
                    </div>
                    <div className="selection-actions">
                      {compact && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDrawerOpen(true)}
                        >
                          <Icon name="menu" size={17} />
                          {t("selection.explorer")}
                        </Button>
                      )}
                      {showSelected.available && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void showSelected.show(
                              selected.name,
                              selected.absolutePath,
                            );
                          }}
                        >
                          <Icon name="folder-open" size={17} />
                          {t("show.button")}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void copyPath();
                        }}
                      >
                        <Icon name="copy" size={17} />
                        {t("selection.copyPath")}
                      </Button>
                    </div>
                  </div>
                  <p
                    className="selected-full-path"
                    title={selected.absolutePath}
                  >
                    {selected.absolutePath}
                  </p>
                  {copyStatus && (
                    <p role="status" className="copy-status">
                      {copyStatus}
                    </p>
                  )}
                  {showSelected.failure && (
                    <Alert
                      variant="error"
                      title={t("show.errorTitle", {
                        name: showSelected.failure.name,
                      })}
                    >
                      {showSelected.failure.message}
                    </Alert>
                  )}
                </div>
                {branchError && (
                  <ErrorState
                    title={t("error.branchTitle", {
                      name: branchError.node.name,
                    })}
                    description={branchError.message}
                    onRetry={() => {
                      void loadNode(branchError.node);
                    }}
                  />
                )}
                {loadingPaths.has(selected.absolutePath) ? (
                  <div className="detail-skeleton" role="status">
                    <span className="sr-only">
                      {t("selection.loadingContents")}
                    </span>
                    <Skeleton height={260} />
                    <Skeleton height={220} />
                  </div>
                ) : selected.type === "FILE" ? (
                  <div className="file-detail">
                    <EmptyState
                      title={t("file.title")}
                      description={t("file.description")}
                      icon={<Icon name="file" size={36} />}
                    />
                    <dl>
                      <div>
                        <dt>{t("file.name")}</dt>
                        <dd>{selected.name}</dd>
                      </div>
                      <div>
                        <dt>{t("file.size")}</dt>
                        <dd>{formatBytes(selected.sizeBytes)}</dd>
                      </div>
                      <div>
                        <dt>{t("file.path")}</dt>
                        <dd>{selected.absolutePath}</dd>
                      </div>
                    </dl>
                  </div>
                ) : selected.type === "ERROR" ? (
                  <ErrorState
                    title={t("error.itemUnreadableTitle")}
                    description={describeCode(
                      i18n,
                      "nodeIssue",
                      selected.errorCode,
                      "error.itemUnreadableDescription",
                    )}
                  />
                ) : selected.childrenLoaded ? (
                  <>
                    {/* One line of composition before the rows it summarizes. */}
                    <SpaceDistribution node={selected} onSelect={selectNode} />
                    <ContentsTable
                      key={selected.absolutePath}
                      node={selected}
                      onSelect={selectNode}
                      state={
                        contentsStates[selected.absolutePath] ??
                        initialContentsState
                      }
                      onStateChange={(state) =>
                        setContentsStates((states) => ({
                          ...states,
                          [selected.absolutePath]: state,
                        }))
                      }
                      revealed={
                        reveal?.folder === selected.absolutePath
                          ? reveal.target
                          : undefined
                      }
                      focusRevealed={
                        reveal?.folder === selected.absolutePath && reveal.focus
                      }
                      onRevealFocused={revealFocused}
                    />
                  </>
                ) : (
                  !branchError && (
                    <EmptyState
                      title={t("load.title")}
                      description={t("load.description")}
                      action={
                        <Button
                          disabled={!serviceReady}
                          onClick={() => {
                            void loadNode(selected);
                          }}
                        >
                          {t("load.button")}
                        </Button>
                      }
                    />
                  )
                )}
              </>
            )}
          </SplitPane>
        </>
      )}
    </AppShell>
  );
}
