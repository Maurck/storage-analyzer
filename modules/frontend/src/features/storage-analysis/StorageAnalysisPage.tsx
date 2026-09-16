import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "react-query";
import { useStorageScan } from "./hooks/useStorageScan";
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
import { Spinner } from "../../shared/ui/Spinner";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Alert } from "../../shared/components/Alert";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { formatBytes, formatNumber } from "../../shared/lib/format";
import { errorMessage } from "../../shared/lib/http";
import { useMediaQuery } from "../../shared/hooks/useMediaQuery";
import { SplitPane } from "../../layouts/SplitPane";
import { AppShell } from "../../layouts/AppShell";

export function StorageAnalysisPage() {
  const { scan, snapshot, start, cancel, query, busy, expired } =
    useStorageScan();
  const client = useQueryClient();
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
        setBranchError({ node, message: errorMessage(error) });
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
    if (busy || !path.trim()) return;
    setPickerError("");
    cancel.reset();
    await start.mutateAsync(path.trim());
    pathDialog.current?.close();
  }

  async function chooseFolder() {
    setPickerError("");
    start.reset();
    if (!window.storageAnalyzer) {
      pathDialog.current?.showModal();
      pathDialog.current?.querySelector<HTMLInputElement>("#folder-path")?.focus();
      return;
    }
    try {
      const path = await window.storageAnalyzer.selectDirectory();
      if (path) await begin(path);
    } catch (error) {
      setPickerError(errorMessage(error));
    }
  }

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(selected!.absolutePath);
      setCopyStatus("Path copied");
    } catch {
      setCopyStatus(
        "Could not copy. Select and copy the path displayed below.",
      );
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
        <h2>Explorer</h2>
        <span className="subtle-badge">
          {formatNumber(Object.keys(nodes).length)} loaded
        </span>
        {compact && (
          <IconButton
            label="Close explorer"
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
    ? "Scanning"
    : scan?.status === "COMPLETE"
      ? scan.root?.partial
        ? "Completed with skipped items"
        : "Analysis complete"
      : scan?.status === "CANCELLED"
        ? "Scan cancelled"
        : "Ready to explore";

  return (
    <AppShell
      status={statusText}
      busy={busy}
      overlays={
        <>
          <FolderPathDialog
            dialogRef={pathDialog}
            pending={start.isLoading}
            error={start.isError ? errorMessage(start.error) : undefined}
            onAnalyze={begin}
          />
          {compact && (
            <dialog
              ref={explorerDialog}
              className="explorer-dialog"
              aria-label="File explorer"
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
            <span className="eyebrow-line" /> KNOW YOUR STORAGE
          </div>
          <h1 id="page-title">
            Storage overview<span className="heading-period">.</span>
          </h1>
          <p>See what’s taking up space. Find what matters.</p>
        </div>
        <div className="page-actions">
          {snapshot && (
            <Button
              variant="secondary"
              onClick={() => {
                void begin(snapshot.path).catch(() => {});
              }}
              disabled={busy}
            >
              <Icon name="refresh" size={17} />
              Rescan
            </Button>
          )}
          <Button
            onClick={() => {
              void chooseFolder();
            }}
            disabled={busy}
            loading={start.isLoading}
          >
            <Icon name="folder-open" size={18} />
            Select folder
          </Button>
        </div>
      </section>
      <div className="global-feedback" aria-live="polite" aria-atomic="true">
        <span className="sr-only">{statusText}</span>
      </div>
      {(pickerError || start.isError) && (
        <div className="page-feedback">
          <ErrorState
            title="Could not start the analysis"
            description={pickerError || errorMessage(start.error)}
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
              expired ? "Analysis session expired" : "Connection interrupted"
            }
            description={
              expired
                ? "The local service restarted or this analysis expired. Choose a folder to start a new scan."
                : `${errorMessage(query.error)}${snapshot ? " Your previous results are still available." : ""}`
            }
            retryLabel={expired ? "Select another folder" : "Try again"}
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
            title="Analysis could not finish"
            description={
              scan.error || "Choose an accessible folder and try again."
            }
            onRetry={() => {
              void begin(scan.path).catch(() => {});
            }}
          />
        </div>
      )}
      {scan?.status === "CANCELLED" && (
        <div className="page-feedback">
          <Alert variant="info" title="Scan cancelled">
            {snapshot
              ? "Your previous results are still available."
              : "Choose a folder whenever you’re ready to start again."}
          </Alert>
        </div>
      )}
      {busy && (
        <section className="scan-progress" aria-label="Analysis progress">
          <Spinner label="Scanning files" />
          <div className="scan-progress-text">
            <strong>Analyzing your folder…</strong>
            <span className="scan-path" title={scan?.path}>
              {scan?.path || "Starting analysis…"}
            </span>
            <span>
              {formatNumber(scan?.processedFiles ?? 0)} files ·{" "}
              {formatBytes(scan?.processedBytes ?? 0)} found ·{" "}
              {formatNumber(scan?.skippedCount ?? 0)} skipped
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => cancel.mutate()}
            loading={cancel.isLoading}
            disabled={!scan}
          >
            Cancel scan
          </Button>
        </section>
      )}
      {cancel.isError && (
        <div className="page-feedback">
          <Alert variant="error" title="Could not cancel">
            {errorMessage(cancel.error)} Use Cancel scan to retry.
          </Alert>
        </div>
      )}
      {!root && !busy && <WelcomeState onChooseFolder={chooseFolder} />}
      {!root && busy && (
        <div className="initial-skeleton" aria-hidden="true">
          <Skeleton height={112} />
          <Skeleton height={320} />
          <Skeleton height={180} />
        </div>
      )}
      {root && selected && (
        <>
          <ScanSummary root={root} skippedCount={snapshot?.skippedCount ?? 0} />
          <SplitPane
            sidebar={
              !compact ? (
                <aside className="explorer-panel" aria-label="File explorer">
                  {explorer}
                </aside>
              ) : null
            }
          >
            <div className="selection-header">
              <nav className="path-breadcrumbs" aria-label="Folder path">
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
                        ` · ${formatNumber(selected.fileCount)} files`}
                      {selected.partial && " · Incomplete"}
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
                      Explorer
                    </Button>
                  )}
                  <IconButton
                    label="Copy folder path"
                    variant="ghost"
                    onClick={() => {
                      void copyPath();
                    }}
                  >
                    <Icon name="copy" size={18} />
                  </IconButton>
                  {selected.type === "FOLDER" && (
                    <IconButton
                      label={showChart ? "Hide chart" : "Show chart"}
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
                title={`Could not open ${branchError.node.name}`}
                description={branchError.message}
                onRetry={() => {
                  void loadNode(branchError.node);
                }}
              />
            )}
            {loadingPaths.has(selected.absolutePath) ? (
              <div className="detail-skeleton" role="status">
                <span className="sr-only">Loading folder contents</span>
                <Skeleton height={260} />
                <Skeleton height={220} />
              </div>
            ) : selected.type === "FILE" ? (
              <div className="file-detail">
                <EmptyState
                  title="File details"
                  description="This file contributes to the total logical size of its parent folder."
                  icon={<Icon name="file" size={36} />}
                />
                <dl>
                  <div>
                    <dt>File name</dt>
                    <dd>{selected.name}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{formatBytes(selected.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>Path</dt>
                    <dd>{selected.absolutePath}</dd>
                  </div>
                </dl>
              </div>
            ) : selected.type === "ERROR" ? (
              <ErrorState
                title="This item could not be read"
                description={
                  selected.error ||
                  "Check the folder’s permissions, then rescan to try again."
                }
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
                  title="Open this folder"
                  description="Load its contents to explore the next level."
                  action={
                    <Button
                      onClick={() => {
                        void loadNode(selected);
                      }}
                    >
                      Load contents
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
