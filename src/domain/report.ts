// ─────────────────────────────────────────────────────────────
// 判断层：冻结快照的复核报告导出（纯文本，不触发下载）
// ─────────────────────────────────────────────────────────────

import type { Meeting, Opinion, Reviewer, RiskStatus } from '../types';
import { DECISION_LABEL, getReview, needsReview, STATUS_LABEL } from './meeting';

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

function reviewerName(reviewers: Reviewer[], id: string | null): string {
  return reviewers.find((r) => r.id === id)?.name ?? '未指派';
}

function opinionBlock(o: Opinion, reviewers: Reviewer[]): string {
  return [
    `- 结论：${DECISION_LABEL[o.decision]}`,
    `- 复核人：${reviewerName(reviewers, o.reviewerId)}`,
    `- 完成时间：${fmt(o.submittedAt)}`,
    `- 批注：${o.comment || '（无）'}`,
  ].join('\n');
}

/** 依据冻结后的会议快照生成 Markdown 报告 */
export function buildReport(meeting: Meeting, reviewers: Reviewer[]): string {
  if (!meeting.frozenAt) {
    throw new Error('只能导出已冻结的会议快照');
  }
  const host = reviewerName(reviewers, meeting.hostId);
  const lines: string[] = [
    `# ${meeting.title} — 许可证复核报告`,
    '',
    `- 会议编号：#${meeting.meetingNo}`,
    `- 主持人：${host}`,
    `- 会议创建：${fmt(meeting.createdAt)}`,
    `- 快照冻结：${fmt(meeting.frozenAt)}`,
    `- 冻结时扫描批次：第 ${meeting.scanNo} 次扫描（${fmt(meeting.lastScanAt)}）`,
    '',
    '## 依赖清单（冻结快照）',
    '',
    '| 依赖 | 版本 | 许可证 | 风险状态 | 来源 |',
    '|---|---|---|---|---|',
    ...meeting.packages.map(
      (p) => `| ${p.name} | ${p.version} | ${p.license} | ${STATUS_LABEL[p.status as RiskStatus]} | ${p.source} |`,
    ),
    '',
    '## 复核意见（绑定冻结时版本 / 许可证 / 风险状态）',
    '',
  ];

  const targets = meeting.packages.filter(needsReview);
  for (const pkg of targets) {
    const review = getReview(meeting, pkg.id);
    lines.push(`### ${pkg.name}@${pkg.version}（${pkg.license} · ${STATUS_LABEL[pkg.status]}）`);
    lines.push(`- 指派复核人：${reviewerName(reviewers, review.reviewerId)}`);
    if (review.dueAt) lines.push(`- 计划完成：${fmt(review.dueAt)}`);
    lines.push('');
    if (review.opinion) {
      lines.push('当前意见：');
      lines.push(opinionBlock(review.opinion, reviewers));
      lines.push('');
    }
    for (const [i, old] of review.history.entries()) {
      lines.push(`历史批注 ${i + 1}（基于 ${old.version} / ${old.license} / ${STATUS_LABEL[old.status]}，${fmt(old.submittedAt)}）：`);
      lines.push(opinionBlock(old, reviewers));
      lines.push('');
    }
  }

  lines.push('> 本报告由主持人在全部待复核项确认完毕后冻结快照导出；');
  lines.push('> 冻结后的重新扫描与意见改动属于另一次复核会议。');
  return lines.join('\n');
}
