import {
  AlertTriangle, ChevronDown, FileCode2, Layers3, ScrollText,
  ShieldCheck, Snowflake, Sparkles,
} from 'lucide-react';
import type { AppState, MeetingSnapshot } from './types';
import type { MeetingProgress } from './judgments';

interface Props {
  state: AppState;
  progress: MeetingProgress;
  selectedPastId: string | null;
  onSelectPast: (id: string | null) => void;
  onReset: () => void;
}

export default function Sidebar({ state, progress, selectedPastId, onSelectPast, onReset }: Props) {
  const pastSnapshots = state.past;
  return (
    <aside>
      <div className="brand">
        <div className="brand-icon"><ShieldCheck size={18} /></div>
        <div>
          <b>License Lens</b>
          <small>REVIEW DESK</small>
        </div>
      </div>

      <div className="nav-title">当前会议 #{state.meeting.number}</div>
      <button
        className={`nav ${selectedPastId === null ? 'active' : ''}`}
        onClick={() => onSelectPast(null)}
      >
        <Layers3 size={16} />复核会台
        <span>{progress.total}</span>
      </button>
      <button className="nav" onClick={() => onSelectPast(null)}>
        <AlertTriangle size={16} />待重审
        {progress.stale > 0 && <span className="red">{progress.stale}</span>}
      </button>
      <button className="nav" onClick={() => onSelectPast(null)}>
        <FileCode2 size={16} />待复核
        {progress.attentionOpen > 0 && <span className="red">{progress.attentionOpen}</span>}
      </button>

      {pastSnapshots.length > 0 && (
        <>
          <div className="nav-title" style={{ marginTop: 18 }}>冻结存档</div>
          {pastSnapshots.map((snap: MeetingSnapshot) => (
            <button
              key={snap.meeting.id}
              className={`nav ${selectedPastId === snap.meeting.id ? 'active' : ''}`}
              onClick={() => onSelectPast(snap.meeting.id)}
            >
              <ScrollText size={16} />
              会议 #{snap.meeting.number}
              <span className="frozen-tag"><Snowflake size={11} /> 快照</span>
            </button>
          ))}
        </>
      )}

      <div className="aside-bottom">
        <div className="mini-card">
          {state.meeting.stage === 'frozen' ? <Snowflake size={16} /> : <Sparkles size={16} />}
          <div>
            <b>{state.meeting.stage === 'frozen' ? '会议已冻结' : '会议进行中'}</b>
            <small>
              {state.meeting.stage === 'frozen'
                ? `快照于 ${new Date(state.meeting.frozenAt!).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : '重新扫描后旧意见自动转待重审'}
            </small>
          </div>
        </div>
        <div className="user">
          <div className="avatar">ZL</div>
          <span>Zen Li<i className="role">主持人</i></span>
          <ChevronDown size={14} />
        </div>
        <button className="reset-demo" onClick={onReset}>重置演示数据</button>
      </div>
    </aside>
  );
}
