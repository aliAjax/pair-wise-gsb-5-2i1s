// ─────────────────────────────────────────────────────────────
// 保存层：版本化 localStorage 持久化
// 只负责序列化 / 反序列化 / 校验，不包含业务判断与 UI
// ─────────────────────────────────────────────────────────────

import type { Meeting, PersistedState } from '../types';
import { HOST_ID, INITIAL_SCAN } from '../data/scanData';

const STORAGE_KEY = 'license-lens-review-v1';

/** 创建第一次复核会议 */
export function createFirstMeeting(now: string = new Date().toISOString()): Meeting {
  const reviews: Meeting['reviews'] = {};
  for (const pkg of INITIAL_SCAN) {
    reviews[pkg.id] = { pkgId: pkg.id, reviewerId: null, dueAt: null, opinion: null, history: [] };
  }
  return {
    id: `meeting-1-${now}`,
    meetingNo: 1,
    title: 'Aurora-Web · 第 1 次复核会',
    baseTitle: 'Aurora-Web',
    hostId: HOST_ID,
    createdAt: now,
    frozenAt: null,
    scanNo: 0,
    lastScanAt: now,
    packages: JSON.parse(JSON.stringify(INITIAL_SCAN)),
    reviews,
  };
}

export function defaultState(now?: string): PersistedState {
  return { version: 1, current: createFirstMeeting(now), archive: [] };
}

function looksValid(data: unknown): data is PersistedState {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<PersistedState>;
  return (
    d.version === 1 &&
    !!d.current &&
    Array.isArray(d.current.packages) &&
    typeof d.current.reviews === 'object' &&
    Array.isArray(d.archive)
  );
}

/** 读取；数据缺失或版本不符时回退到全新会议 */
export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    if (looksValid(parsed)) return parsed;
    // 旧版 License Lens（license-lens）数据无法复用，安全重置
    return defaultState();
  } catch {
    return defaultState();
  }
}

/** 保存；失败（隐私模式 / 配额）时只告警，不影响页面操作 */
export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('复核数据保存失败', err);
  }
}

export function exportToFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
