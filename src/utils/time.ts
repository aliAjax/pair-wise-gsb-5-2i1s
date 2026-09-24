// ─────────────────────────────────────────────────────────────
// 展示辅助：本地时间格式化（页面层使用）
// ─────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO -> datetime-local 输入框值（本地时区） */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local 值 -> ISO */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

/** 默认计划完成时间：明天 18:00 */
export function defaultDueInput(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatFull(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function isOverdue(iso: string | null, now = new Date()): boolean {
  return !!iso && new Date(iso).getTime() < now.getTime();
}
