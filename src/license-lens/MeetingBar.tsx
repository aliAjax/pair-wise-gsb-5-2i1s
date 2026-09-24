import { useState } from 'react';
import {
  ArrowRight, Download, Lock, PlayCircle, RefreshCw, Snowflake,
} from 'lucide-react';
import type { AppState } from './types';
import type { MeetingProgress } from './judgments';
import { exportSnapshotMarkdown } from './storage';

interface Props {
  state: AppState;
  progress: MeetingProgress;
  onRescan: () => void;
  onFreeze: () => { ok: boolean; reason?: string };
  onNextMeeting: () => void;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function MeetingBar({ state, progress, onRescan, onFreeze, onNextMeeting }: Props) {
  const [error, setError] = useState<string | null>(null);
  const frozen = state.meeting.stage === 'frozen';

  const tryFreeze = () => {
    const r = onFreeze();
    setError(r.ok ? null : (r.reason ?? '暂不能冻结'));
  };

  return (
    <>
      <section className={`meeting-bar ${frozen ? 'is-frozen' : ''}`}>
        <div className="meeting-id">
          {frozen
            ? <div className="meeting-badge frozen-badge"><Snowflake size={14} /> 已冻结</div>
            : <div className="meeting-badge live-badge"><span className="dot-live" /> 进行中</div>}
          <div>
            <b>复核会议 #{state.meeting.number} · {state.meeting.project}</b>
            <small>
              主持人 {state.meeting.host} · {fmtTime(state.meeting.startedAt)} 开始
              {state.meeting.frozenAt && ` · ${fmtTime(state.meeting.frozenAt)} 冻结`}
            </small>
          </div>
        </div>

        <div className="meeting-progress">
          <ProgressChip label="已确认" value={progress.confirmed} tone="ok" />
          <ProgressChip label="待重审" value={progress.stale} tone="stale" />
          <ProgressChip label="待复核/分派" value={progress.assigned + progress.pending} tone="warn" />
        </div>

        <div className="meeting-actions">
          {!frozen && (
            <>
              <button className="outline" onClick={onRescan}>
                <RefreshCw size={14} /> 重新扫描
              </button>
              <button
                className="primary freeze-btn"
                disabled={!progress.canFreeze}
                title={progress.canFreeze ? '冻结后会议只读，可导出快照' : '待重审 / 待复核项清零后才能冻结'}
                onClick={tryFreeze}
              >
                <Snowflake size={14} /> 冻结会议快照
              </button>
            </>
          )}
          {frozen && (
            <>
              <button
                className="outline"
                onClick={() => exportSnapshotMarkdown(state.past[0])}
              >
                <Download size={14} /> 导出快照
              </button>
              <button className="primary next-btn" onClick={onNextMeeting}>
                <PlayCircle size={14} /> 改动另开新会议 <ArrowRight size={13} />
              </button>
            </>
          )}
        </div>
      </section>

      {error && <div className="freeze-error"><Lock size={13} /> {error}</div>}
      {frozen && (
        <div className="freeze-note">
          <Snowflake size={13} /> 本会议已定格：包信息、意见与批注均为冻结时快照，页面只读。
          后续重新扫描带来的任何改动，请点击「另开新会议」处理。
        </div>
      )}
    </>
  );
}

function ProgressChip({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'stale' | 'warn' }) {
  return (
    <div className={`chip chip-${tone} ${value > 0 ? 'lit' : ''}`}>
      <b>{value}</b><span>{label}</span>
    </div>
  );
}
