import { serverEndpoint } from "@/lib/config";
import type { Artifact } from "./types";

export interface DownloadProgress {
  received: number;
  total: number;
  ratio: number;
  bytesPerSecond: number;
}

/**
 * دانلود استریمی با پیشرفت واقعی.
 * اگر سرور Content-Length ندهد از size مانیفست استفاده می‌کنیم.
 */
export async function downloadArtifact(
  artifact: Artifact,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const url = artifact.url.startsWith("http") ? artifact.url : serverEndpoint(artifact.url);
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`دانلود بسته ناموفق بود (کد ${res.status})`);

  const total = Number(res.headers.get("content-length")) || artifact.size || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  const startedAt = performance.now();
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
    onProgress({
      received,
      total,
      ratio: total ? Math.min(received / total, 1) : 0,
      bytesPerSecond: received / seconds,
    });
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
