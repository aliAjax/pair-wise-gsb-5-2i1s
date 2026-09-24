// ─────────────────────────────────────────────────────────────
// 保存层：只负责序列化 / 反序列化 / 持久化
// 不知道任何业务规则；换后端时只需替换这一文件。
// ─────────────────────────────────────────────────────────────

import type { AppState } from './types';

const KEY = 'license-lens-review-v1';

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    // 基本形状校验，避免历史脏数据把页面带崩
    if (!parsed.meeting || !Array.isArray(parsed.deps) || typeof parsed.reviews !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级（例如隐私模式），不影响会台使用
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** 把冻结快照导出为 Markdown 文件（导出 = 只读快照的呈现，不回写状态） */
export function exportSnapshotMarkdown(snapshot: AppState['past'][number]): void {
  const { meeting, packages, reviews } = snapshot;
  const stamp = (iso?: string) => (iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '—');

  const lines: string[] = [];
  lines.push(`# License Lens 复核会议 #${meeting.number} 冻结快照`);
  lines.push('');
  lines.push(`- 项目：${meeting.project}`);
  lines.push(`- 主持人：${meeting.host}`);
  lines.push(`- 开会时间：${stamp(meeting.startedAt)}`);
  lines.push(`- 冻结时间：${stamp(meeting.frozenAt)}`);
  lines.push('');
  lines.push('| 依赖 | 版本 | 许可证 | 风险 | 复核人 | 结论 | 完成时间 |');
  lines.push('|---|---|---|---|---|---|---|');
  const riskText: Record<string, string> = { ok: '安全', warn: '需复核', risk: '高风险' };
  const decisionText: Record<string, string> = {
    approve: '同意使用', retain: '保留声明', escalate: '升级风险 / 替换',
  };
  for (const p of packages) {
    const r = reviews[p.id];
    lines.push(
      `| ${p.name} | ${p.version} | ${p.license} | ${riskText[p.status]} `
      + `| ${r?.reviewer ?? '—'} | ${r?.decision ? decisionText[r.decision] : '—'} `
      + `| ${stamp(r?.completedAt)} |`,
    );
  }
  lines.push('');
  lines.push('## 批注与重审留痕');
  lines.push('');
  for (const p of packages) {
    const r = reviews[p.id];
    if (!r) continue;
    lines.push(`### ${p.name}`);
    if (r.comment) lines.push(`- 当前批注（${r.snapshotVersion} / ${r.snapshotLicense}）：${r.comment}`);
    for (const h of r.reconfirmations) {
      lines.push(
        `- 重审 ${stamp(h.at)}：${h.fromVersion}·${h.fromLicense} → ${h.toVersion}·${h.toLicense}；`
        + `旧意见「${decisionText[h.previousDecision]}：${h.previousComment || '（无批注）'}」已保留；`
        + `新意见「${decisionText[h.decision]}：${h.comment || '（无批注）'}」`,
      );
    }
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `license-lens-meeting-${meeting.number}-frozen.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}
