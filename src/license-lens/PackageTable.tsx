import { useMemo, useState } from 'react';
import {
  AlertTriangle, Check, History, RefreshCw, Search, Snowflake,
} from 'lucide-react';
import type { AppState, PackageDep, Review } from './types';
import type { MeetingProgress } from './judgments';
import type { ReviewState } from './types';
import { RISK_TEXT, STATE_TEXT, diffPackage } from './judgments';

export const licenseColors: Record<string, string> = {
  MIT: '#35b995',
  'BSD-3-Clause': '#6d9ee8',
  'GPL-3.0': '#ec8c75',
  'LGPL-2.1': '#e0a85c',
  'Apache-2.0': '#b18ee4',
};

interface Props {
  state: AppState;
  progress: MeetingProgress;
  stateOf: (dep: PackageDep) => ReviewState;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

type FilterKey = 'all' | ReviewState | 'attention';

export default function PackageTable({ state, progress, stateOf, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const rows = useMemo(() => state.deps.map(dep => ({
    dep,
    st: stateOf(dep),
    review: state.reviews[dep.id],
  })), [state.deps, state.reviews, stateOf]);

  const filtered = rows.filter(({ dep, st }) => {
    if (filter === 'attention' && (st === 'confirmed' || dep.status === 'ok')) return false;
    if (filter !== 'all' && filter !== 'attention' && st !== filter) return false;
    return `${dep.name}${dep.license}${(state.reviews[dep.id]?.reviewer) ?? ''}`
      .toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="table-pane">
      <div className="pane-head">
        <div>
          <h2>依赖复核清单</h2>
          <p>逐项指派复核人；意见绑定提交时的版本 / 许可证 / 风险</p>
        </div>
        <div className="tools">
          <div className="search">
            <Search size={15} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索依赖 / 复核人"
            />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value as FilterKey)}>
            <option value="all">全部 ({progress.total})</option>
            <option value="stale">待重审 ({progress.stale})</option>
            <option value="assigned">待复核 ({progress.assigned})</option>
            <option value="pending">待分派 ({progress.pending})</option>
            <option value="confirmed">已确认 ({progress.confirmed})</option>
          </select>
        </div>
      </div>

      <div className="table">
        <div className="tr th">
          <span>依赖名称</span><span>版本 / 许可证</span><span>复核人</span><span>状态</span>
        </div>
        {filtered.map(({ dep, st, review }) => (
          <button
            key={dep.id}
            className={`tr ${dep.id === selectedId ? 'selected' : ''} ${st === 'stale' ? 'row-stale' : ''}`}
            onClick={() => onSelect(dep.id)}
          >
            <span className="dep-name">
              <span className={`pkg-dot dot-${dep.status}`} />
              {dep.name}
              {st === 'stale' && <History size={12} className="stale-ico" />}
            </span>
            <span className="version-cell">
              <b>{dep.version}</b>
              <i
                className="license"
                style={{ color: licenseColors[dep.license] || '#888', background: `${licenseColors[dep.license] || '#888'}18` }}
              >
                {dep.license}
              </i>
            </span>
            <span className={review?.reviewer ? 'reviewer-name' : 'muted'}>
              {review?.reviewer ?? '未指派'}
            </span>
            <span>
              <StateBadge state={st} risk={dep.status} />
              {st === 'stale' && review && (
                <small className="stale-diff">
                  {formatDiff(review, dep)}
                </small>
              )}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty-row">
            <Check size={15} /> 没有匹配的依赖
          </div>
        )}
      </div>
    </div>
  );
}

function formatDiff(review: Review, dep: PackageDep): string {
  const d = diffPackage(review, dep);
  const parts: string[] = [];
  if (d.version) parts.push(`${review.snapshotVersion}→${dep.version}`);
  if (d.license) parts.push(`${review.snapshotLicense}→${dep.license}`);
  if (d.risk) parts.push(`${RISK_TEXT[review.snapshotRisk]}→${RISK_TEXT[dep.status]}`);
  return parts.join(' · ');
}

export function StateBadge({ state, risk }: { state: ReviewState; risk?: PackageDep['status'] }) {
  if (state === 'confirmed')
    return <span className="status ok"><Check size={13} /> {STATE_TEXT.confirmed}</span>;
  if (state === 'stale')
    return <span className="status stale"><RefreshCw size={13} /> {STATE_TEXT.stale}</span>;
  if (state === 'assigned')
    return <span className={`status ${risk === 'risk' ? 'risk' : 'warn'}`}><AlertTriangle size={13} /> {STATE_TEXT.assigned}</span>;
  return <span className="status pending"><Snowflake size={12} /> {STATE_TEXT.pending}</span>;
}
