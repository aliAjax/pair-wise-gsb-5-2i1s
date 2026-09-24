import { AlertTriangle, Check, CheckCircle2, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Meeting, PackageInfo, ReviewState } from '../types';
import { getReview, reviewState } from '../domain/meeting';
import { LICENSE_COLORS, REVIEWERS } from '../data/scanData';
import { formatDateTime, isOverdue } from '../utils/time';

type Filter = 'all' | ReviewState;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待复核' },
  { key: 'stale', label: '待重审' },
  { key: 'confirmed', label: '已确认' },
  { key: 'not-needed', label: '无需复核' },
];

function StateCell({ state }: { state: ReviewState }) {
  if (state === 'confirmed')
    return <span className="cell-state confirmed"><CheckCircle2 size={13} />已确认</span>;
  if (state === 'stale')
    return <span className="cell-state stale"><RefreshCw size={13} />待重审</span>;
  if (state === 'pending')
    return <span className="cell-state pending"><ShieldAlert size={13} />待复核</span>;
  return <span className="cell-state safe"><Check size={13} />无需</span>;
}

interface Props {
  meeting: Meeting;
  selectedId: number;
  onSelect: (id: number) => void;
}

export function ReviewList({ meeting, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(
    () =>
      meeting.packages
        .map((p) => ({ pkg: p, state: reviewState(meeting, p) }))
        .filter(({ pkg, state }) => {
          if (filter !== 'all' && state !== filter) return false;
          return `${pkg.name}${pkg.license}`.toLowerCase().includes(query.toLowerCase());
        }),
    [meeting, query, filter],
  );

  return (
    <div className="table-pane">
      <div className="pane-head">
        <div>
          <h2>复核清单</h2>
          <p>逐项指派复核人，意见绑定当时的版本 / 许可证 / 风险状态</p>
        </div>
        <div className="tools">
          <div className="search">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索依赖" />
          </div>
        </div>
      </div>

      <div className="filter-chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'on' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="table">
        <div className="tr th review-tr">
          <span>依赖名称</span><span>版本 / 许可证</span><span>复核人</span><span>复核状态</span>
        </div>
        {rows.map(({ pkg, state }) => (
          <Row key={pkg.id} meeting={meeting} pkg={pkg} state={state} selected={pkg.id === selectedId} onSelect={onSelect} />
        ))}
        {rows.length === 0 && <div className="empty-row">没有符合条件的依赖</div>}
      </div>
    </div>
  );
}

function Row({
  meeting,
  pkg,
  state,
  selected,
  onSelect,
}: {
  meeting: Meeting;
  pkg: PackageInfo;
  state: ReviewState;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const review = getReview(meeting, pkg.id);
  const reviewer = REVIEWERS.find((r) => r.id === review.reviewerId);
  const color = LICENSE_COLORS[pkg.license] ?? '#888';
  const overdue = isOverdue(review.dueAt) && state !== 'confirmed';

  return (
    <button className={`tr review-tr ${selected ? 'selected' : ''} ${state}`} onClick={() => onSelect(pkg.id)}>
      <span className="dep-name">
        <span className={`pkg-dot dot-${pkg.status}`} />
        {pkg.name}
        {pkg.status === 'risk' && <AlertTriangle size={12} className="risk-ico" />}
      </span>
      <span className="ver-cell">
        <b className="muted">{pkg.version}</b>
        <i className="license" style={{ color, background: `${color}18` }}>{pkg.license}</i>
      </span>
      <span className="assign-cell">
        {reviewer ? (
          <>
            <span className={`mini-avatar role-${reviewer.role}`}>{reviewer.name[0]}</span>
            <span className="assign-text">
              <b>{reviewer.name}</b>
              <small className={overdue ? 'overdue' : ''}>
                {review.dueAt ? `截止 ${formatDateTime(review.dueAt)}` : '未设完成时间'}
              </small>
            </span>
          </>
        ) : (
          <span className="unassigned">{state === 'not-needed' ? '—' : '未指派'}</span>
        )}
      </span>
      <span><StateCell state={state} /></span>
    </button>
  );
}
