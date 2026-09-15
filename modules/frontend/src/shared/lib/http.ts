export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
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
      );
    }
    if (!response.ok) {
      const message =
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : "The request could not be completed. Please try again.";
      throw new AppError(message, response.status);
    }
    return body as T;
  } catch (error) {
    if (timedOut)
      throw new AppError(
        "The local service took too long to respond. You can retry safely.",
      );
    if (init.signal?.aborted)
      throw new DOMException("The request was cancelled.", "AbortError");
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Could not connect to the local analysis service. Start the backend and try again.",
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
