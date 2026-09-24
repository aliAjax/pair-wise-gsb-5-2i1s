// ─────────────────────────────────────────────────────────────
// 判断层：纯函数领域逻辑
// 不接触 React、localStorage、DOM；所有判定可独立测试
// ─────────────────────────────────────────────────────────────

import type {
  BindingDiff,
  Decision,
  Meeting,
  MeetingCounts,
  Opinion,
  PackageBinding,
  PackageInfo,
  ReviewRecord,
  ReviewState,
  RiskStatus,
} from '../types';

/** 风险状态对应展示文案的 key（展示层负责翻译） */
export const STATUS_LABEL: Record<RiskStatus, string> = {
  ok: '安全',
  warn: '需要复核',
  risk: '高风险',
};

export const DECISION_LABEL: Record<Decision, string> = {
  approve: '可接受',
  mitigate: '附条件通过',
  replace: '需替换',
};

/** 只有 warn / risk 进入复核会台逐项确认；ok 包无需意见 */
export function needsReview(pkg: PackageInfo): boolean {
  return pkg.status !== 'ok';
}

export function packageBinding(pkg: PackageInfo): PackageBinding {
  return { version: pkg.version, license: pkg.license, status: pkg.status };
}

/** 重新扫描后，旧意见绑定与当前包信息的差异；无差异返回 null */
export function bindingDiff(opinion: Opinion, pkg: PackageInfo): BindingDiff[] {
  const now = packageBinding(pkg);
  const diffs: BindingDiff[] = [];
  if (opinion.version !== now.version) {
    diffs.push({ field: 'version', from: opinion.version, to: now.version });
  }
  if (opinion.license !== now.license) {
    diffs.push({ field: 'license', from: opinion.license, to: now.license });
  }
  if (opinion.status !== now.status) {
    diffs.push({ field: 'status', from: opinion.status, to: now.status });
  }
  return diffs;
}

export function isBindingCurrent(opinion: Opinion | null, pkg: PackageInfo | undefined): boolean {
  if (!opinion || !pkg) return false;
  return bindingDiff(opinion, pkg).length === 0;
}

export function emptyReview(pkgId: number): ReviewRecord {
  return { pkgId, reviewerId: null, dueAt: null, opinion: null, history: [] };
}

export function getReview(meeting: Meeting, pkgId: number): ReviewRecord {
  return meeting.reviews[pkgId] ?? emptyReview(pkgId);
}

/**
 * 复核状态判定：
 * - not-needed  安全包，无需复核
 * - pending     待复核：待复核包尚无意见
 * - stale       待重审：已有意见，但绑定的版本/许可证/风险状态已与最新扫描不一致
 * - confirmed   已确认：意见与当前包信息一致
 */
export function reviewState(
  meeting: Meeting,
  pkg: PackageInfo,
): ReviewState {
  if (!needsReview(pkg)) return 'not-needed';
  const review = getReview(meeting, pkg.id);
  if (!review.opinion) return 'pending';
  return isBindingCurrent(review.opinion, pkg) ? 'confirmed' : 'stale';
}

export function meetingCounts(meeting: Meeting): MeetingCounts {
  const counts: MeetingCounts = {
    total: meeting.packages.length,
    target: 0,
    pending: 0,
    confirmed: 0,
    stale: 0,
  };
  for (const pkg of meeting.packages) {
    if (!needsReview(pkg)) continue;
    counts.target += 1;
    const state = reviewState(meeting, pkg);
    if (state === 'confirmed') counts.confirmed += 1;
    else if (state === 'stale') counts.stale += 1;
    else counts.pending += 1;
  }
  return counts;
}

/** 会议可冻结的前提：全部待复核项都已确认（无待复核 / 待重审） */
export function canFreeze(meeting: Meeting): boolean {
  if (meeting.frozenAt) return false;
  const c = meetingCounts(meeting);
  return c.target > 0 && c.pending + c.stale === 0;
}

export function frozenBlockers(meeting: Meeting): string[] {
  const c = meetingCounts(meeting);
  const blockers: string[] = [];
  if (c.pending > 0) blockers.push(`${c.pending} 项尚未复核`);
  if (c.stale > 0) blockers.push(`${c.stale} 项等待重审`);
  return blockers;
}

// ── 不可变状态操作（均返回新 Meeting） ──────────────────────────

export function isFrozen(meeting: Meeting): boolean {
  return meeting.frozenAt !== null;
}

export function assignReviewer(
  meeting: Meeting,
  pkgId: number,
  reviewerId: string,
  dueAt: string,
): Meeting {
  if (isFrozen(meeting)) throw new Error('会议已冻结，不能改派复核人');
  const prev = getReview(meeting, pkgId);
  const next: ReviewRecord = { ...prev, reviewerId, dueAt };
  return { ...meeting, reviews: { ...meeting.reviews, [pkgId]: next } };
}

export interface SubmitInput {
  reviewerId: string;
  decision: Decision;
  comment: string;
  dueAt: string;
  now: string;
}

/**
 * 提交（重审）意见：
 * - 必须已指派复核人
 * - 绑定当前扫描的版本 / 许可证 / 风险状态
 * - 若已有旧意见，先归档到 history（批注保留）
 */
export function submitOpinion(
  meeting: Meeting,
  pkgId: number,
  input: SubmitInput,
): Meeting {
  if (isFrozen(meeting)) throw new Error('会议已冻结，不能提交意见');
  const pkg = meeting.packages.find((p) => p.id === pkgId);
  if (!pkg) throw new Error('依赖不存在');
  if (!needsReview(pkg)) throw new Error('安全依赖无需复核');
  const prev = getReview(meeting, pkgId);
  const binding = packageBinding(pkg);
  const opinion: Opinion = {
    ...binding,
    reviewerId: input.reviewerId,
    decision: input.decision,
    comment: input.comment,
    submittedAt: input.now,
    scanNo: meeting.scanNo,
  };
  const history = prev.opinion ? [...prev.history, prev.opinion] : prev.history;
  const next: ReviewRecord = {
    ...prev,
    reviewerId: input.reviewerId,
    dueAt: input.dueAt,
    opinion,
    history,
  };
  return { ...meeting, reviews: { ...meeting.reviews, [pkgId]: next } };
}

/**
 * 应用一次新扫描：
 * - 按 id 保留已有复核记录（意见不删除，绑定过期即自动派生为 stale）
 * - 新包生成空记录；本次扫描中消失的包其记录一并移除
 */
export function applyScan(meeting: Meeting, scanned: PackageInfo[], scannedAt: string): Meeting {
  if (isFrozen(meeting)) throw new Error('会议已冻结，不能重新扫描；请另开新会议');
  const reviews: Record<number, ReviewRecord> = {};
  for (const pkg of scanned) {
    reviews[pkg.id] = meeting.reviews[pkg.id] ?? emptyReview(pkg.id);
  }
  return {
    ...meeting,
    packages: scanned,
    reviews,
    scanNo: meeting.scanNo + 1,
    lastScanAt: scannedAt,
  };
}

/** 手动添加依赖（不影响其他包的意见状态） */
export function addPackage(meeting: Meeting, pkg: PackageInfo): Meeting {
  if (isFrozen(meeting)) throw new Error('会议已冻结，不能添加依赖');
  if (meeting.packages.some((p) => p.id === pkg.id)) throw new Error('依赖已存在');
  return {
    ...meeting,
    packages: [...meeting.packages, pkg],
    reviews: { ...meeting.reviews, [pkg.id]: emptyReview(pkg.id) },
  };
}

/**
 * 冻结会议快照：深拷贝当前状态并打上冻结时间，
 * 导出报告以冻结内容为准，之后任何扫描 / 意见改动只能进入新会议。
 */
export function freezeMeeting(meeting: Meeting, frozenAt: string): Meeting {
  if (!canFreeze(meeting)) {
    throw new Error(`还有待确认项，无法冻结：${frozenBlockers(meeting).join('、')}`);
  }
  const snapshot: Meeting = JSON.parse(JSON.stringify(meeting));
  snapshot.frozenAt = frozenAt;
  return snapshot;
}

/**
 * 另开新会议：沿用最新包信息，复核意见全部重新走流程
 * （保留上一任复核人指派与截止时间，方便继续协作；意见不带入）
 */
export function startNextMeeting(
  current: Meeting,
  archive: Meeting[],
  createdAt: string,
): { current: Meeting; archive: Meeting[] } {
  const no = Math.max(current.meetingNo, ...archive.map((m) => m.meetingNo)) + 1;
  const reviews: Record<number, ReviewRecord> = {};
  for (const pkg of current.packages) {
    const prev = getReview(current, pkg.id);
    reviews[pkg.id] = {
      ...emptyReview(pkg.id),
      reviewerId: prev.reviewerId,
      dueAt: prev.dueAt,
    };
  }
  const next: Meeting = {
    id: `meeting-${no}-${createdAt}`,
    meetingNo: no,
    title: `${current.baseTitle} · 第 ${no} 次复核会`,
    baseTitle: current.baseTitle,
    hostId: current.hostId,
    createdAt,
    frozenAt: null,
    scanNo: current.scanNo,
    lastScanAt: current.lastScanAt,
    packages: JSON.parse(JSON.stringify(current.packages)),
    reviews,
  };
  return { current: next, archive: [...archive, current] };
}
