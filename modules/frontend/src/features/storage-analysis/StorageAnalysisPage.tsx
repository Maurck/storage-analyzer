import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "react-query";
import { useStorageScan } from "./hooks/useStorageScan";
import { useServiceStatus } from "./hooks/useServiceStatus";
import { ServiceStatusBanner } from "./components/ServiceStatusBanner";
import { ScanProgress } from "./components/ScanProgress";
import { DirectoryNode, NodeCache } from "./model/directory.types";
import { getDirectory } from "./api/directory.api";
import { DirectoryTree } from "./components/DirectoryTree";
import { SpaceDistribution } from "./components/SpaceDistribution";
import { ContentsTable } from "./components/ContentsTable";
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
import { formatBytes, formatNumber } from "../../shared/lib/format";
import {
  describeCode,
  useErrorMessage,
} from "../../shared/i18n/useErrorMessage";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { SplitPane } from "../../layouts/SplitPane";
import { AppShell } from "../../layouts/AppShell";
import { SettingsDialog } from "../settings/SettingsDialog";
import { useTranslation } from "../../shared/i18n/LanguageProvider";

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
  const [showChart, setShowChart] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const pathDialog = useRef<HTMLDialogElement>(null);
  const explorerDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const currentSnapshot = useRef<string>();
  const compact = useMediaQuery("(max-width: 767px)");
  currentSnapshot.current = snapshot?.id;
  const root = snapshot?.root;
  const selected = nodes[selectedPath] ?? root;

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

  function selectNode(node: DirectoryNode) {
    setSelectedPath(node.absolutePath);
    setBranchError(null);
    setCopyStatus("");
    setDrawerOpen(false);
    void loadNode(nodes[node.absolutePath] ?? node);
  }

  async function begin(path: string) {
    if (busy || !serviceReady || !path.trim()) return;
    setPickerError("");
    cancel.reset();
    await start.mutateAsync(path.trim());
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
      const path = await window.storageAnalyzer.selectDirectory();
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
          <SettingsDialog dialogRef={settingsDialog} />
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
        <div className="page-actions">
          {snapshot && (
            <Button
              variant="secondary"
              onClick={() => {
                void begin(snapshot.path).catch(() => {});
              }}
              disabled={busy || !serviceReady}
            >
              <Icon name="refresh" size={17} />
              {t("page.rescan")}
            </Button>
          )}
          <Button
            onClick={() => {
              void chooseFolder();
            }}
            disabled={busy || !serviceReady}
            loading={start.isLoading}
          >
            <Icon name="folder-open" size={18} />
            {t("page.selectFolder")}
          </Button>
        </div>
      </section>
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
      {query.isError && (
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
        <WelcomeState onChooseFolder={chooseFolder} disabled={!serviceReady} />
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
                      name={selected.type === "FILE" ? "file" : "folder-open"}
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
                      {selected.partial && " · " + t("selection.incomplete")}
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
                  <IconButton
                    label={t("selection.copyPath")}
                    variant="ghost"
                    onClick={() => {
                      void copyPath();
                    }}
                  >
                    <Icon name="copy" size={18} />
                  </IconButton>
                  {selected.type === "FOLDER" && (
                    <IconButton
                      label={
                        showChart
                          ? t("selection.hideChart")
                          : t("selection.showChart")
                      }
                      aria-pressed={showChart}
                      variant="ghost"
                      onClick={() => setShowChart((value) => !value)}
                    >
                      <Icon name="grid" size={18} />
                    </IconButton>
                  )}
                </div>
              </div>
              <p className="selected-full-path" title={selected.absolutePath}>
                {selected.absolutePath}
              </p>
              {copyStatus && (
                <p role="status" className="copy-status">
                  {copyStatus}
                </p>
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
                {showChart && (
                  <SpaceDistribution node={selected} onSelect={selectNode} />
                )}
                <ContentsTable
                  key={selected.absolutePath}
                  node={selected}
                  onSelect={selectNode}
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
          </SplitPane>
        </>
      )}
    </AppShell>
  );
}
