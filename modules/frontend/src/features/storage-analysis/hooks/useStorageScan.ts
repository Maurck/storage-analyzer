import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { cancelScan, getScan, startScan } from "../api/directory.api";
import { Scan } from "../model/directory.types";
import { AppError } from "../../../shared/lib/http";

export function useStorageScan() {
  const client = useQueryClient();
  const [session, setSession] = useState<Scan | null>(null);
  const [snapshot, setSnapshot] = useState<Scan | null>(null);
  const activeId = useRef<string>();
  const startPending = useRef(false);
  const query = useQuery<Scan, Error>(
    ["scan", session?.id],
    ({ signal }) => getScan(session!.id, signal),
    {
      enabled: !!session,
      initialData: session ?? undefined,
      refetchInterval: (data, currentQuery) =>
        currentQuery.state.error instanceof AppError &&
        currentQuery.state.error.status === 404
          ? false
          : data?.status === "SCANNING"
            ? 800
            : false,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: false,
      retry: (failures, error) =>
        !(error instanceof AppError && error.status === 404) && failures < 1,
    },
  );
  const start = useMutation(
    async (path: string) => {
      if (startPending.current)
        throw new AppError(
          "An analysis is already starting.",
          0,
          "already-starting",
        );
      startPending.current = true;
      try {
        return await startScan(path);
      } finally {
        startPending.current = false;
      }
    },
    {
      onSuccess: (scan) => {
        activeId.current = scan.id;
        client.setQueryData(["scan", scan.id], scan);
        setSession(scan);
      },
    },
  );
  const cancel = useMutation(() => cancelScan(session!.id), {
    onSuccess: async (scan) => {
      await client.cancelQueries(["scan", scan.id]);
      client.setQueryData(["scan", scan.id], scan);
      if (activeId.current === scan.id) setSession(scan);
    },
  });
  useEffect(() => {
    if (query.data?.status === "COMPLETE") setSnapshot(query.data);
  }, [query.data]);
  const expired = query.error instanceof AppError && query.error.status === 404;
  return {
    scan: expired ? undefined : query.data,
    expired,
    snapshot,
    start,
    cancel,
    query,
    busy:
      start.isLoading ||
      cancel.isLoading ||
      (!expired && query.data?.status === "SCANNING"),
  };
}
