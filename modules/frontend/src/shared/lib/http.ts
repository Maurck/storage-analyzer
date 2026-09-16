/** Codes for the messages this module raises itself, so the interface can
 *  show them in the reader's language. Messages relayed by the backend have
 *  no code and are shown as the service worded them. */
export type ErrorCode =
  | "unreadable-response"
  | "request-failed"
  | "timeout"
  | "offline"
  | "already-starting";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
    public readonly code?: ErrorCode,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      timedOut = true;
      controller.abort();
    }
  }, 20000);
  const abort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  try {
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
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
      const message =
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : null;
      throw new AppError(
        message ?? "The request could not be completed. Please try again.",
        response.status,
        message ? undefined : "request-failed",
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
      "Could not connect to the local analysis service. Start the backend and try again.",
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
