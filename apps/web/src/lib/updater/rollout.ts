/**
 * انتشار پله‌ای (staged rollout).
 * هر دستگاه یک شناسه‌ی پایدار می‌گیرد؛ از هشِ آن یک سطل ۰..۹۹ می‌سازیم.
 * سطل کوچک‌تر از درصد rollout ⇒ این دستگاه نسخه را می‌گیرد.
 * نکته: سطل به نسخه‌ی هدف گره خورده تا هر ریلیز گروه متفاوتی را اول بگیرد.
 */

const DEVICE_KEY = "sr.device.id";

export function deviceId(): string {
  if (typeof localStorage === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** FNV-1a 32 بیتی — سریع و پایدار بین پلتفرم‌ها. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function bucketFor(target: string, id = deviceId()): number {
  return fnv1a(`${id}:${target}`) % 100;
}

export function isInRollout(target: string, rollout: number, id?: string): boolean {
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;
  return bucketFor(target, id) < rollout;
}
