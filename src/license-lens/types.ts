// ─────────────────────────────────────────────────────────────
// License Lens · 复核会台 —— 数据模型
// 只描述结构，不包含任何业务判断与读写逻辑。
// ─────────────────────────────────────────────────────────────

/** 扫描器给出的风险状态 */
export type Risk = 'ok' | 'warn' | 'risk';

/** 扫描得到的依赖（包）信息 */
export interface PackageDep {
  id: number;
  name: string;
  version: string;
  license: string;
  source: string;
  status: Risk;
  note: string;
}

/** 会台上一项依赖的复核进度 */
export type ReviewState = 'pending' | 'assigned' | 'confirmed' | 'stale';

/** 复核结论 */
export type Decision = 'approve' | 'retain' | 'escalate';

/**
 * 复核意见。意见一旦形成就绑定「当时的」版本 / 许可证 / 风险快照
 * （snapshot*），即使后续重新扫描、当前包信息已变化，批注原文也不动。
 */
export interface Review {
  depId: number;
  reviewer: string | null;

  // —— 意见绑定的历史快照（做判断时的包信息）——
  snapshotVersion: string;
  snapshotLicense: string;
  snapshotRisk: Risk;

  decision?: Decision;
  comment?: string;
  /** 首次完成时间 */
  completedAt?: string;

  /**
   * 待重审后再次确认：快照被刷新到当时的包信息，
   * 旧批注与旧结论作为 history 保留。
   */
  reconfirmations: Reconfirmation[];
}

/** 一次重审留痕：保留旧批注，记录新确认 */
export interface Reconfirmation {
  at: string;
  reviewer: string;
  fromVersion: string;
  fromLicense: string;
  fromRisk: Risk;
  previousDecision: Decision;
  previousComment: string;
  toVersion: string;
  toLicense: string;
  toRisk: Risk;
  decision: Decision;
  comment: string;
}

export type MeetingStage = 'active' | 'frozen';

/** 一次复核会议 */
export interface Meeting {
  id: string;
  number: number;
  project: string;
  host: string;
  stage: MeetingStage;
  startedAt: string;
  frozenAt?: string;
  /** 重新扫描 / 开会等事件流水，供会台展示 */
  changelog: ChangeEntry[];
  /** 冻结时定格的快照 */
  snapshot?: MeetingSnapshot;
}

export interface ChangeEntry {
  at: string;
  kind: 'start' | 'rescan' | 'freeze' | 'add';
  text: string;
}

/** 冻结瞬间的不可变快照，导出即基于它 */
export interface MeetingSnapshot {
  meeting: Meeting;
  takenAt: string;
  packages: PackageDep[];
  reviews: Record<number, Review>;
}

/** 整个应用状态 */
export interface AppState {
  meeting: Meeting;
  deps: PackageDep[];
  /** depId -> 复核意见（当前会议内） */
  reviews: Record<number, Review>;
  /** 历次已冻结会议，仅作回溯，不再可编辑 */
  past: MeetingSnapshot[];
}
