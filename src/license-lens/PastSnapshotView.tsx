import { ArrowLeft, Check, Download, Snowflake } from 'lucide-react';
import type { MeetingSnapshot } from './types';
import {
  DECISION_TEXT, RISK_TEXT, reviewState,
} from './judgments';
import { exportSnapshotMarkdown } from './storage';
import { licenseColors, StateBadge } from './PackageTable';

interface Props {
  snapshot: MeetingSnapshot;
  onBack: () => void;
}

const fmt = (iso?: string) => iso
  ? new Date(iso).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

/** 冻结快照只读视图：归档，不可编辑 */
export default function PastSnapshotView({ snapshot, onBack }: Props) {
  const { meeting, packages, reviews } = snapshot;
  return (
    <main>
      <header>
        <div>
          <div className="crumb">ARCHIVE / <b>MEETING #{meeting.number}</b></div>
          <h1>冻结快照 · 会议 #{meeting.number}</h1>
          <p>{fmt(meeting.frozenAt)} 由 {meeting.host} 冻结 · 此后任何改动均在新会议中进行</p>
        </div>
        <div className="head-actions">
          <button className="outline" onClick={onBack}><ArrowLeft size={15} /> 返回当前会议</button>
          <button className="primary" onClick={() => exportSnapshotMarkdown(snapshot)}>
            <Download size={15} /> 导出 Markdown
          </button>
        </div>
      </header>

      <section className="snapshot-banner">
        <Snowflake size={18} />
        <div>
          <b>不可变会议记录</b>
          <p>
            {packages.length} 个依赖 · 开会 {fmt(meeting.startedAt)} · 冻结 {fmt(meeting.frozenAt)}
            ，以下表格中的版本、许可证、风险与复核意见全部定格在冻结瞬间。
          </p>
        </div>
      </section>

      <section className="table-pane snapshot-table">
        <div className="table">
          <div className="tr th">
            <span>依赖</span><span>版本 / 许可证</span><span>风险</span><span>复核人 / 结论</span><span>完成时间</span>
          </div>
          {packages.map(p => {
            const r = reviews[p.id];
            const st = reviewState(p, r); // 快照内必然全部 confirmed
            return (
              <div className="tr" key={p.id}>
                <span className="dep-name"><span className={`pkg-dot dot-${p.status}`} />{p.name}</span>
                <span className="version-cell">
                  <b>{p.version}</b>
                  <i className="license" style={{ color: licenseColors[p.license] || '#888', background: `${licenseColors[p.license] || '#888'}18` }}>
                    {p.license}
                  </i>
                </span>
                <span className={`risk-${p.status}`}>{RISK_TEXT[p.status]}</span>
                <span>
                  {r?.reviewer ? (
                    <>
                      <b className="reviewer-name">{r.reviewer}</b>
                      <small className="decision-line">
                        {r.decision ? DECISION_TEXT[r.decision] : '—'}
                        {r.reconfirmations.length > 0 && ` · 重审 ${r.reconfirmations.length} 次`}
                      </small>
                    </>
                  ) : (
                    <span className="muted">未参与复核</span>
                  )}
                </span>
                <span className="muted">{fmt(r?.completedAt)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="snapshot-notes">
        <h2><Check size={15} /> 批注与重审留痕</h2>
        {packages.map(p => {
          const r = reviews[p.id];
          if (!r) return null;
          return (
            <div key={p.id} className="note-card">
              <div className="note-head">
                <b>{p.name}</b>
                <StateBadge state={reviewState(p, r)} />
              </div>
              <p>{r.comment || '（无批注）'}</p>
              {r.reconfirmations.map((h, i) => (
                <div key={i} className="history-item compact">
                  <div className="history-head">
                    <b>{fmt(h.at)}</b>
                    <span>{h.fromVersion}·{h.fromLicense}</span> → <span className="to">{h.toVersion}·{h.toLicense}</span>
                  </div>
                  <p className="old-comment">旧批注（{DECISION_TEXT[h.previousDecision]}）：{h.previousComment || '（无批注）'}</p>
                  <p className="new-comment">重审意见（{DECISION_TEXT[h.decision]}）：{h.comment || '（无批注）'}</p>
                </div>
              ))}
            </div>
          );
        })}
      </section>
    </main>
  );
}
