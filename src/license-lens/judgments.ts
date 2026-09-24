// ─────────────────────────────────────────────────────────────
// 判断层（纯函数）
// 所有业务规则集中在这里：不读 localStorage、不碰 React、
// 不产生副作用 —— 给定输入，给出判断结果，方便复核与测试。
// ─────────────────────────────────────────────────────────────

import type {
  AppState, Decision, PackageDep, Review, ReviewState, Risk,
} from './types';

/** 当前包信息的指纹：版本 + 许可证 + 风险状态 */
export function fingerprint(p: { version: string; license: string; status: Risk }): string {
  return `${p.version}@${p.license}@${p.status}`;
}

/** 意见绑定时的指纹 */
export function reviewFingerprint(r: Review): string {
  return `${r.snapshotVersion}@${r.snapshotLicense}@${r.snapshotRisk}`;
}

/**
 * 计算一项依赖当前在会台上的复核状态：
 *  - pending   未指定复核人
 *  - assigned  已指定，尚未完成意见
 *  - confirmed 意见已完成，且绑定的快照与当前包信息一致
 *  - stale     意见完成后重新扫描，版本/许可证/风险发生变化 → 待重审
 */
export function reviewState(dep: PackageDep, r?: Review): ReviewState {
  if (!r || !r.reviewer) return 'pending';
  if (!r.completedAt || !r.decision) return 'assigned';
  return reviewFingerprint(r) === fingerprint(dep) ? 'confirmed' : 'stale';
}

/** 哪些字段在重新扫描后发生了变化 */
export function diffPackage(
  r: Review,
  dep: PackageDep,
): { version: boolean; license: boolean; risk: boolean } {
  return {
    version: r.snapshotVersion !== dep.version,
    license: r.snapshotLicense !== dep.license,
    risk: r.snapshotRisk !== dep.status,
  };
}

export interface MeetingProgress {
  total: number;
  pending: number;
  assigned: number;
  confirmed: number;
  stale: number;
  /** 需要意见的包（扫描器判定 warn/risk） */
  attention: number;
  /** 其中尚未完成（含待重审）的数量 */
  attentionOpen: number;
  canFreeze: boolean;
}

/** 主持人能否冻结会议：所有需要关注的包都已在当前快照上确认 */
export function progressOf(state: Pick<AppState, 'deps' | 'reviews'>): MeetingProgress {
  let pending = 0, assigned = 0, confirmed = 0, stale = 0;
  let attention = 0, attentionOpen = 0;

  for (const dep of state.deps) {
    const st = reviewState(dep, state.reviews[dep.id]);
    if (st === 'pending') pending++;
    else if (st === 'assigned') assigned++;
    else if (st === 'confirmed') confirmed++;
    else stale++;

    if (dep.status !== 'ok') {
      attention++;
      if (st !== 'confirmed') attentionOpen++;
    }
  }
  return {
    total: state.deps.length,
    pending, assigned, confirmed, stale,
    attention, attentionOpen,
    // 冻结门槛：没有待重审；需要关注的包全部确认。
    // ok 包允许保持未分派（不阻塞发布会议冻结）。
    canFreeze: stale === 0 && attentionOpen === 0 && attention > 0,
  };
}

/** 指派复核人（未完成前的占位意见） */
export function assignReviewer(
  reviews: Record<number, Review>,
  dep: PackageDep,
  reviewer: string,
): Record<number, Review> {
  const existing = reviews[dep.id];
  if (existing?.reviewer === reviewer) return reviews;
  return {
    ...reviews,
    [dep.id]: {
      depId: dep.id,
      reviewer,
      snapshotVersion: existing?.snapshotVersion ?? dep.version,
      snapshotLicense: existing?.snapshotLicense ?? dep.license,
      snapshotRisk: existing?.snapshotRisk ?? dep.status,
      // 改派复核人：旧批注保留给接手人参考，但完成状态重新打开，
      // 需由新复核人重新提交意见。
      decision: existing?.reviewer && existing.completedAt ? undefined : existing?.decision,
      comment: existing?.comment,
      completedAt: existing?.reviewer && existing.completedAt ? undefined : existing?.completedAt,
      reconfirmations: existing?.reconfirmations ?? [],
    },
  };
}

/** 复核人提交意见 —— 绑定当前包信息快照 */
export function submitReview(
  reviews: Record<number, Review>,
  dep: PackageDep,
  reviewer: string,
  decision: Decision,
  comment: string,
  at: string,
): Record<number, Review> {
  const prev = reviews[dep.id];
  const next: Review = {
    depId: dep.id,
    reviewer,
    snapshotVersion: dep.version,
    snapshotLicense: dep.license,
    snapshotRisk: dep.status,
    decision,
    comment: comment.trim(),
    completedAt: prev?.completedAt ?? at,
    reconfirmations: prev?.reconfirmations ?? [],
  };
  // 已经是待重审状态下再次提交 = 重审确认：旧批注转存为留痕
  if (prev?.completedAt && prev.decision && reviewFingerprint(prev) !== fingerprint(dep)) {
    next.reconfirmations = [
      ...(prev.reconfirmations ?? []),
      {
        at,
        reviewer: prev.reviewer ?? reviewer,
        fromVersion: prev.snapshotVersion,
        fromLicense: prev.snapshotLicense,
        fromRisk: prev.snapshotRisk,
        previousDecision: prev.decision,
        previousComment: prev.comment ?? '',
        toVersion: dep.version,
        toLicense: dep.license,
        toRisk: dep.status,
        decision,
        comment: comment.trim(),
      },
    ];
  }
  return { ...reviews, [dep.id]: next };
}

/**
 * 重新扫描后的判定：新包信息与旧意见快照比对，
 * 不修改任何批注 —— 状态 stale 由 reviewState 现算。
 * 返回新的 deps 列表（保持原有 id / 顺序，新增包追加）。
 */
export function mergeScan(
  prevDeps: PackageDep[],
  scanned: PackageDep[],
): { deps: PackageDep[]; changed: PackageDep[]; added: PackageDep[] } {
  const byName = new Map(prevDeps.map(d => [d.name, d]));
  let nextId = prevDeps.reduce((m, d) => Math.max(m, d.id), 0);
  // 同名包沿用旧 id（这样旧意见才能与它比对）；新包分配新 id
  const deps: PackageDep[] = scanned.map(s => {
    const old = byName.get(s.name);
    return old ? { ...s, id: old.id } : { ...s, id: ++nextId };
  });
  const scannedNames = new Set(scanned.map(s => s.name));
  // 扫描结果中消失的包：演示场景下保守地保留在清单末尾（真实场景由扫描器决定）
  for (const old of prevDeps) {
    if (!scannedNames.has(old.name)) deps.push(old);
  }
  const changed: PackageDep[] = [];
  const added: PackageDep[] = [];
  for (const d of deps) {
    const old = byName.get(d.name);
    if (!old) added.push(d);
    else if (fingerprint(old) !== fingerprint(d)) changed.push(d);
  }
  return { deps, changed, added };
}

/** 风险对应的中文标签 */
export const RISK_TEXT: Record<Risk, string> = {
  ok: '安全',
  warn: '需复核',
  risk: '高风险',
};

export const DECISION_TEXT: Record<Decision, string> = {
  approve: '同意使用',
  retain: '保留声明',
  escalate: '升级风险 / 替换',
};

export const STATE_TEXT: Record<ReviewState, string> = {
  pending: '待分派',
  assigned: '待复核',
  confirmed: '已确认',
  stale: '待重审',
};
