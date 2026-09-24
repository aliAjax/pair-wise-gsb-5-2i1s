import { Archive, ChevronDown, Layers3, ShieldCheck, Snowflake, Sparkles, Users } from 'lucide-react';
import type { Meeting } from '../types';
import { meetingCounts } from '../domain/meeting';
import { REVIEWERS } from '../data/scanData';

interface Props {
  meeting: Meeting;
  archiveCount: number;
  view: 'meeting' | 'archive';
  onView: (v: 'meeting' | 'archive') => void;
}

export function Sidebar({ meeting, archiveCount, view, onView }: Props) {
  const c = meetingCounts(meeting);
  const frozen = meeting.frozenAt !== null;
  return (
    <aside>
      <div className="brand">
        <div className="brand-icon"><ShieldCheck size={18} /></div>
        <div>
          <b>License Lens</b>
          <small>REVIEW CONSOLE</small>
        </div>
      </div>

      <div className="nav-title">复核会台</div>
      <button className={`nav ${view === 'meeting' ? 'active' : ''}`} onClick={() => onView('meeting')}>
        {frozen ? <Snowflake size={16} /> : <Users size={16} />}
        当前会议 <span>#{meeting.meetingNo}</span>
      </button>
      <button className={`nav ${view === 'archive' ? 'active' : ''}`} onClick={() => onView('archive')}>
        <Archive size={16} />历史会议
        <span>{archiveCount}</span>
      </button>

      <div className="nav-title" style={{ marginTop: 22 }}>扫描</div>
      <button className="nav">
        <Layers3 size={16} />依赖总览
        <span>{meeting.packages.length}</span>
      </button>

      <div className="aside-bottom">
        <div className="mini-card">
          <Sparkles size={16} />
          <div>
            <b>{frozen ? '会议快照已冻结' : '复核进行中'}</b>
            <small>
              {frozen
                ? `第 ${meeting.scanNo} 次扫描时冻结`
                : `第 ${meeting.scanNo} 次扫描 · ${c.confirmed}/${c.target} 项已确认`}
            </small>
          </div>
        </div>
        <div className="reviewer-list">
          {REVIEWERS.map((r) => (
            <div className="reviewer-chip" key={r.id}>
              <div className={`avatar role-${r.role}`}>{r.name[0]}</div>
              <span>{r.name}</span>
              <small>{r.role}</small>
            </div>
          ))}
        </div>
        <div className="user" style={{ marginTop: 16 }}>
          <div className="avatar host">赵</div>
          <span>赵晗 · 主持人</span>
          <ChevronDown size={14} />
        </div>
      </div>
    </aside>
  );
}
