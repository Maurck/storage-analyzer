import { useCallback, useEffect, useRef, useState } from "react";
import { API_VERSION, APPLICATION, getHealth } from "../api/directory.api";
import {
  BackendFailureReason,
  BackendLifecycle,
  desktopBridge,
} from "../../../shared/lib/desktopBridge";

export type ServiceStatus =
  /** No answer yet; nothing is known. */
  | { state: "checking" }
  /** The desktop app is still starting the backend. */
  | { state: "starting" }
  | { state: "ready" }
  /** Nothing answers. `wasReady` tells a stopped service from one never seen. */
  | { state: "unavailable"; wasReady: boolean }
  /** The desktop app gave up starting the backend. */
  | { state: "failed"; reason: BackendFailureReason }
  /** Something answers, but it is not a backend this interface can use. */
  | { state: "incompatible"; reason: "other-service" | "api-version" };

type Probe = "compatible" | "other-service" | "api-version" | "unreachable";

// Checks are cheap loopback requests. They slow down while nothing answers
// and never restart anything: only the person's retry does that.
const READY_INTERVAL = 5000;
const WAITING_INTERVALS = [1000, 1000, 2000, 2000, 5000, 10000];

async function probe(signal: AbortSignal): Promise<Probe> {
  try {
    const health = await getHealth(signal);
    if (health.application !== APPLICATION) return "other-service";
    return health.apiVersion === API_VERSION ? "compatible" : "api-version";
  } catch (error) {
    if (signal.aborted) throw error;
    // An answer that is not our health document comes from another program;
    // no answer at all means the service is not there (yet).
    const status = (error as { status?: number }).status ?? 0;
    const code = (error as { code?: string }).code;
    return status > 0 ||
      code === "service-unavailable" ||
      code === "unreadable-response"
      ? "other-service"
      : "unreachable";
  }
}

export function combine(
  found: Probe | undefined,
  lifecycle: BackendLifecycle | undefined,
  wasReady: boolean,
): ServiceStatus {
  if (found === "compatible") return { state: "ready" };
  if (found === "other-service" || found === "api-version") {
    return { state: "incompatible", reason: found };
  }
  if (lifecycle?.state === "failed") {
    return { state: "failed", reason: lifecycle.reason };
  }
  if (lifecycle?.state === "starting") return { state: "starting" };
  if (found === undefined) return { state: "checking" };
  return { state: "unavailable", wasReady };
}

export function useServiceStatus() {
  const [found, setFound] = useState<Probe>();
  const [lifecycle, setLifecycle] = useState<BackendLifecycle>();
  const [retrying, setRetrying] = useState(false);
  const wasReady = useRef(false);
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const controller = useRef<AbortController>();
  const mounted = useRef(true);

  const check = useCallback(async () => {
    clearTimeout(timer.current);
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    let result: Probe;
    try {
      result = await probe(current.signal);
    } catch {
      return; // superseded by a newer check
    }
    if (!mounted.current || controller.current !== current) return;
    if (result === "compatible") {
      wasReady.current = true;
      attempt.current = 0;
    } else {
      attempt.current += 1;
    }
    setFound(result);
    const delay =
      result === "compatible"
        ? READY_INTERVAL
        : WAITING_INTERVALS[
            Math.min(attempt.current - 1, WAITING_INTERVALS.length - 1)
          ];
    timer.current = setTimeout(() => void check(), delay);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const bridge = desktopBridge();
    const unsubscribe = bridge?.onBackendStatus?.((status) => {
      // The desktop app knows first. Forget the previous answer so its new
      // state is never shown next to a stale "not responding", then check now.
      setFound(undefined);
      setLifecycle(status);
      attempt.current = 0;
      void check();
    });
    bridge
      ?.getBackendStatus?.()
      .then((status) => mounted.current && setLifecycle(status))
      .catch(() => {});
    void check();
    return () => {
      mounted.current = false;
      unsubscribe?.();
      clearTimeout(timer.current);
      controller.current?.abort();
    };
  }, [check]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      const bridge = desktopBridge();
      // The desktop app decides whether its engine needs starting: after a
      // failed start, or when a reused engine no longer answers.
      if (lifecycle?.managed && bridge?.retryBackend) {
        if (lifecycle.state === "failed") {
          setLifecycle({ managed: true, state: "starting" });
        }
        const next = await bridge.retryBackend().catch(() => lifecycle);
        if (mounted.current) setLifecycle(next);
      }
      attempt.current = 0;
      await check();
    } finally {
      if (mounted.current) setRetrying(false);
    }
  }, [check, lifecycle]);

  return {
    status: combine(found, lifecycle, wasReady.current),
    retry,
    retrying,
  };
}
