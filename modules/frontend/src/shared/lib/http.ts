/** Codes for the failures this application detects itself, so the interface
 *  can word them in the reader's language. */
export type ErrorCode =
  | "unreadable-response"
  | "request-failed"
  | "timeout"
  | "offline"
  | "already-starting"
  | "invalid-scan"
  | "invalid-data"
  | "incomplete-scan"
  | "service-unavailable";

/** A code relayed by the backend, such as FOLDER_NOT_FOUND. */
const apiCodePattern = /^[A-Z][A-Z0-9_]{0,63}$/;
export const isApiCode = (value: unknown): value is string =>
  typeof value === "string" && apiCodePattern.test(value);

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
    public readonly code?: ErrorCode,
    /** The backend's stable code; its message is only an English fallback. */
    public readonly apiCode?: string,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 20000, ...fetchInit } = init;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      timedOut = true;
      controller.abort();
    }
  }, timeoutMs);
  const abort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  try {
    const headers = new Headers(fetchInit.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, {
      ...fetchInit,
      signal: controller.signal,
      headers,
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new AppError(
        "The local service returned an unreadable response. Please try again.",
        response.status,
        "unreadable-response",
      );
    }
    if (!response.ok) {
      const fields =
        body && typeof body === "object"
          ? (body as { message?: unknown; code?: unknown })
          : {};
      const message =
        typeof fields.message === "string" ? fields.message : null;
      const apiCode = isApiCode(fields.code) ? fields.code : undefined;
      throw new AppError(
        message ?? "The request could not be completed. Please try again.",
        response.status,
        message || apiCode ? undefined : "request-failed",
        apiCode,
      );
    }
    return body as T;
  } catch (error) {
    if (timedOut)
      throw new AppError(
        "The local service took too long to respond. You can retry safely.",
        0,
        "timeout",
      );
    if (init.signal?.aborted)
      throw new DOMException("The request was cancelled.", "AbortError");
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Could not connect to the local analysis service. Wait until it is ready and try again.",
      0,
      "offline",
    );
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
