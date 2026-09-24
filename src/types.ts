// ─────────────────────────────────────────────────────────────
// 数据层：复核会台的领域模型（只描述数据，不含任何逻辑与展示）
// ─────────────────────────────────────────────────────────────

/** 扫描器判定的风险状态 */
export type RiskStatus = 'ok' | 'warn' | 'risk';

/** 复核结论 */
export type Decision = 'approve' | 'mitigate' | 'replace';

/**
 * 包信息快照：意见提交时，绑定当时的版本 / 许可证 / 风险状态。
 * 重新扫描后三者任一变化，原意见即自动失效为「待重审」。
 */
export interface PackageBinding {
  version: string;
  license: string;
  status: RiskStatus;
}

/** 扫描得到的依赖包信息 */
export interface PackageInfo {
  id: number;
  name: string;
  version: string;
  license: string;
  source: string;
  status: RiskStatus;
  /** 扫描备注 */
  note: string;
}

/** 参与复核的人员 */
export interface Reviewer {
  id: string;
  name: string;
  role: '法务' | '开发' | '主持人';
}

/** 一条复核意见，绑定提交时的包快照 */
export interface Opinion extends PackageBinding {
  reviewerId: string;
  decision: Decision;
  comment: string;
  /** 实际完成时间 */
  submittedAt: string;
  /** 意见基于第几次扫描 */
  scanNo: number;
}

/** 单个依赖的复核记录：指派信息 + 当前意见 + 历次旧意见 */
export interface ReviewRecord {
  pkgId: number;
  reviewerId: string | null;
  /** 计划完成时间（截止时间） */
  dueAt: string | null;
  /** 当前生效意见；重新扫描后若与包信息不一致会被判为「待重审」 */
  opinion: Opinion | null;
  /** 重审后归档的旧意见，批注永久保留 */
  history: Opinion[];
}

/** 一次复核会议；冻结后只读，改动必须另开新会议 */
export interface Meeting {
  id: string;
  meetingNo: number;
  title: string;
  baseTitle: string;
  hostId: string;
  createdAt: string;
  frozenAt: string | null;
  /** 当前扫描批次（第几次扫描） */
  scanNo: number;
  lastScanAt: string;
  packages: PackageInfo[];
  reviews: Record<number, ReviewRecord>;
}

/** 持久化结构 */
export interface PersistedState {
  version: 1;
  current: Meeting;
  archive: Meeting[];
}

/** 复核派生状态（由领域层根据意见绑定与当前扫描实时判定） */
export type ReviewState = 'pending' | 'confirmed' | 'stale' | 'not-needed';

export interface BindingDiff {
  field: keyof PackageBinding;
  from: string;
  to: string;
}

export interface MeetingCounts {
  total: number;
  target: number;
  pending: number;
  confirmed: number;
  stale: number;
}
