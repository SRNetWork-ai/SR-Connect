import { serverEndpoint } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * سقف زمانی هر درخواست. بدون این، یک اتصال نیمه‌باز می‌تواند UI را
 * برای همیشه روی حالت «در حال بارگذاری» نگه دارد.
 */
const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(serverEndpoint(path), {
      ...init,
      credentials: "include",
      headers: {
        // FormData باید boundary خودش را بسازد، پس content-type دستی نمی‌گذاریم.
        ...(init?.body && !isForm ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: init?.signal ?? controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApiError(408, "سرور در زمان مناسب پاسخ نداد");
    }
    throw new ApiError(0, "ارتباط با سرور برقرار نشد");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  // پراکسی یا صفحه‌ی خطای HTML نباید به SyntaxError مبهم تبدیل شود.
  let data: Record<string, unknown> = {};
  try {
    if (text) data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (!res.ok) throw new ApiError(res.status, `پاسخ نامعتبر از سرور (${res.status})`);
    throw new ApiError(502, "پاسخ سرور قابل خواندن نبود");
  }
  if (!res.ok) throw new ApiError(res.status, (data.error as string) ?? `خطای ${res.status}`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  /** آپلود چندفایلی؛ برای پیوست پیام و آواتار. */
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
};
