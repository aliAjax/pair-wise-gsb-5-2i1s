import { useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FilePlus2,
  Lock,
  Plus,
  RefreshCw,
  ScanLine,
  Snowflake,
  X,
} from 'lucide-react';
import type { Decision, Meeting } from '../types';
import { canFreeze, frozenBlockers, isFrozen, meetingCounts } from '../domain/meeting';
import { formatFull } from '../utils/time';
import { ReviewList } from './ReviewList';
import { ReviewPanel } from './ReviewPanel';

interface Props {
  meeting: Meeting;
  selectedId: number;
  nextScanAvailable: boolean;
  onSelect: (id: number) => void;
  onRescan: () => void;
  onAdd: (name: string, license: string) => void;
  onAssign: (pkgId: number, reviewerId: string, dueAt: string) => void;
  onSubmit: (pkgId: number, reviewerId: string, decision: Decision, comment: string, dueAt: string) => void;
  onFreezeExport: () => void;
  onNewMeeting: () => void;
}

export function MeetingView(props: Props) {
  const { meeting, selectedId } = props;
  const [showAdd, setShowAdd] = useState(false);
  const frozen = isFrozen(meeting);
  const c = meetingCounts(meeting);
  const pkg = meeting.packages.find((p) => p.id === selectedId);
  const progress = c.target === 0 ? 0 : Math.round((c.confirmed / c.target) * 100);

  return (
    <>
      <header>
        <div>
          <div className="crumb">
            REVIEW CONSOLE / <b>MEETING #{meeting.meetingNo}</b>
          </div>
          <h1>
            {meeting.title}
            {frozen && <span className="frozen-title"><Snowflake size={15} />已冻结</span>}
          </h1>
          <p>
            {frozen
              ? `快照冻结于 ${formatFull(meeting.frozenAt)}，报告已导出；改动请另开新会议。`
              : `创建于 ${formatFull(meeting.createdAt)} · 当前为第 ${meeting.scanNo} 次扫描结果（${formatFull(meeting.lastScanAt)}）`}
          </p>
        </div>
        <div className="head-actions">
          {!frozen ? (
            <>
              <button className="outline" onClick={() => setShowAdd(true)}>
                <Plus size={15} />添加依赖
              </button>
              <button className="outline" onClick={props.onRescan} disabled={!props.nextScanAvailable}
                title={props.nextScanAvailable ? '模拟扫描器重新扫描' : '演示场景已到最新扫描'}>
                <ScanLine size={15} />重新扫描
                {props.nextScanAvailable && <span className="scan-dot" />}
              </button>
              <button
                className="primary"
                onClick={props.onFreezeExport}
                disabled={!canFreeze(meeting)}
                title={canFreeze(meeting) ? '冻结会议快照并导出 Markdown 报告' : frozenBlockers(meeting).join('、')}
              >
                <Lock size={15} />冻结并导出
              </button>
            </>
          ) : (
            <button className="primary" onClick={props.onNewMeeting}>
              <FilePlus2 size={15} />另开新会议
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="tag">PROJECT · AURORA-WEB</span>
          <h2>{frozen ? '快照已冻结，结论留档。' : '法务和开发，逐项确认到位。'}</h2>
          <p>
            {frozen ? (
              <>本会议在第 {meeting.scanNo} 次扫描结果上冻结，共 <b>{c.target} 项</b>复核意见随快照导出。</>
            ) : (
              <>
                扫描到 <b>{c.total} 个依赖</b>，其中 <b className="warning">{c.target} 项</b>需要复核；
                已确认 <b>{c.confirmed}</b>，
                {c.stale > 0 ? <b className="warning"> {c.stale} 项待重审</b> : null}。
              </>
            )}
          </p>
        </div>
        <div className="scan-score">
          <div className={`score-ring ${progress === 100 ? 'done' : ''}`}>
            <strong>{progress}<small>%</small></strong>
          </div>
          <div>
            <span>复核进度</span>
            <b>{progress === 100 ? '全部确认' : '进行中'}</b>
            <small>{c.confirmed}/{c.target} 项</small>
          </div>
        </div>
      </section>

      <section className="summary">
        <div><span>待复核依赖</span><b>{c.target}</b><small>warn / risk 进入会议</small></div>
        <div><span>已确认</span><b className="teal">{c.confirmed}</b><small>意见与当前扫描一致</small></div>
        <div>
          <span>待复核 / 待重审</span>
          <b className="orange">{c.pending + c.stale}</b>
          <small>{c.pending} 未复核 · {c.stale} 信息已变</small>
        </div>
        <div>
          <span>无需复核</span>
          <b className="muted-num">{c.total - c.target}</b>
          <small>扫描判定安全</small>
        </div>
      </section>

      {!frozen && c.stale > 0 && (
        <div className="stale-banner">
          <RefreshCw size={15} />
          <div>
            <b>重新扫描后 {c.stale} 项包信息已变化</b>
            <span>旧意见已自动转为「待重审」，批注保留；请重新确认后才能冻结会议。</span>
          </div>
        </div>
      )}

      {!frozen && !canFreeze(meeting) && (
        <div className="freeze-bar">
          <ClipboardList size={15} />
          <span>{frozenBlockers(meeting).join('；')}，全部确认后主持人才能冻结快照。</span>
        </div>
      )}
      {!frozen && canFreeze(meeting) && (
        <div className="freeze-bar ready">
          <CheckCircle2 size={15} />
          <span>全部待复核项已确认，可以冻结会议快照并导出报告。</span>
        </div>
      )}

      <section className="workspace">
        <ReviewList meeting={meeting} selectedId={selectedId} onSelect={props.onSelect} />
        {pkg ? (
          <ReviewPanel
            meeting={meeting}
            pkg={pkg}
            onClose={() => props.onSelect(0)}
            onAssign={props.onAssign}
            onSubmit={props.onSubmit}
          />
        ) : (
          <div className="detail placeholder">
            <Download size={22} />
            <b>选择左侧依赖查看复核</b>
            <p>可指派复核人和完成时间，提交绑定当前版本、许可证与风险状态的意见。</p>
          </div>
        )}
      </section>

      {showAdd && (
        <AddModal onClose={() => setShowAdd(false)} onAdd={(n, l) => { props.onAdd(n, l); setShowAdd(false); }} />
      )}
    </>
  );
}

function AddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (n: string, l: string) => void }) {
  const [name, setName] = useState('');
  const [license, setLicense] = useState('MIT');
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>添加依赖</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <label>依赖名称
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 date-fns" />
        </label>
        <label>许可证
          <select value={license} onChange={(e) => setLicense(e.target.value)}>
            <option>MIT</option>
            <option>ISC</option>
            <option>BSD-3-Clause</option>
            <option>Apache-2.0</option>
            <option>GPL-3.0</option>
          </select>
        </label>
        <button
          className="primary full"
          disabled={!name.trim()}
          onClick={() => name.trim() && onAdd(name, license)}
        >
          加入扫描
        </button>
      </div>
    </div>
  );
}
