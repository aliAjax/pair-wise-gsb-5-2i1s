import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileCode2,
  History,
  Info,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { Decision, Meeting, Opinion, PackageInfo } from '../types';
import {
  bindingDiff,
  DECISION_LABEL,
  getReview,
  reviewState,
  STATUS_LABEL,
} from '../domain/meeting';
import { LICENSE_COLORS, REVIEWERS } from '../data/scanData';
import { defaultDueInput, formatDateTime, formatFull, fromLocalInput, isOverdue, toLocalInput } from '../utils/time';

interface Props {
  meeting: Meeting;
  pkg: PackageInfo | undefined;
  onClose: () => void;
  onAssign: (pkgId: number, reviewerId: string, dueAt: string) => void;
  onSubmit: (pkgId: number, reviewerId: string, decision: Decision, comment: string, dueAt: string) => void;
}

const DECISIONS: Decision[] = ['approve', 'mitigate', 'replace'];

const DIFF_FIELD: Record<string, string> = {
  version: '版本',
  license: '许可证',
  status: '风险状态',
};

function OpinionCard({ o, archived }: { o: Opinion; archived?: boolean }) {
  const reviewer = REVIEWERS.find((r) => r.id === o.reviewerId);
  return (
    <div className={`opinion ${archived ? 'archived' : ''}`}>
      <div className="opinion-top">
        <span className={`decision-tag d-${o.decision}`}>{DECISION_LABEL[o.decision]}</span>
        {archived && <span className="archived-flag">旧批注 · 已归档</span>}
        <small>绑定 {o.version} · {o.license} · {STATUS_LABEL[o.status]}</small>
      </div>
      <p>{o.comment || '（无批注）'}</p>
      <div className="opinion-meta">
        <span>{reviewer?.name ?? '未知'} · {reviewer?.role}</span>
        <span>完成于 {formatFull(o.submittedAt)} · 第 {o.scanNo} 次扫描</span>
      </div>
    </div>
  );
}

export function ReviewPanel({ meeting, pkg, onClose, onAssign, onSubmit }: Props) {
  if (!pkg) return null;
  const frozen = meeting.frozenAt !== null;
  const review = getReview(meeting, pkg.id);
  const state = reviewState(meeting, pkg);
  const color = LICENSE_COLORS[pkg.license] ?? '#888';

  const [reviewerId, setReviewerId] = useState(review.reviewerId ?? REVIEWERS[0].id);
  const [due, setDue] = useState(review.dueAt ? toLocalInput(review.dueAt) : defaultDueInput());
  const [decision, setDecision] = useState<Decision>('approve');
  const [comment, setComment] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  // 切换依赖时重置表单
  useEffect(() => {
    setReviewerId(review.reviewerId ?? REVIEWERS[0].id);
    setDue(review.dueAt ? toLocalInput(review.dueAt) : defaultDueInput());
    setDecision('approve');
    setComment('');
    setFormOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg.id]);

  const diffs = useMemo(
    () => (review.opinion && state === 'stale' ? bindingDiff(review.opinion, pkg) : []),
    [review.opinion, state, pkg],
  );

  const submit = () => {
    if (!due) return;
    onSubmit(pkg.id, reviewerId, decision, comment.trim(), fromLocalInput(due));
    setComment('');
    setFormOpen(false);
  };

  const overdue = isOverdue(review.dueAt) && state !== 'confirmed';

  return (
    <div className="detail">
      <div className="detail-head">
        <div className="detail-icon" style={{ background: `${color}1c`, color }}>
          <FileCode2 size={20} />
        </div>
        <div>
          <span>{frozen ? 'FROZEN SNAPSHOT' : 'REVIEW ITEM'}</span>
          <h2>{pkg.name}</h2>
        </div>
        <button className="close" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="detail-grid">
        <div><label>版本</label><b>{pkg.version}</b></div>
        <div><label>来源</label><b>{pkg.source}</b></div>
        <div><label>许可证</label><b style={{ color }}>{pkg.license}</b></div>
      </div>

      <div className={`finding ${pkg.status}`}>
        <div className="finding-icon">
          {pkg.status === 'ok' ? <Check size={16} /> : <AlertTriangle size={16} />}
        </div>
        <div>
          <b>{STATUS_LABEL[pkg.status]} · {pkg.note}</b>
          <p>扫描结果基于 package 元数据，发布前请查看完整许可证文本。</p>
        </div>
      </div>

      {state === 'not-needed' && (
        <div className="review-block safe-only">
          <CheckCircle2 size={16} />
          <div>
            <b>安全许可，无需进入复核会台</b>
            <p>当前扫描判定为「安全」；若重新扫描后风险升级，会自动转为待复核。</p>
          </div>
        </div>
      )}

      {state !== 'not-needed' && (
        <div className="review-block">
          <div className="review-block-head">
            <span className={`state-badge s-${state}`}>
              {state === 'pending' && <ShieldAlert size={13} />}
              {state === 'stale' && <RefreshCw size={13} />}
              {state === 'confirmed' && <CheckCircle2 size={13} />}
              {state === 'pending' ? '待复核' : state === 'stale' ? '待重审' : '已确认'}
            </span>
            {review.dueAt && (
              <small className={overdue ? 'overdue' : ''}>
                计划完成 {formatDateTime(review.dueAt)}
                {overdue && ' · 已逾期'}
              </small>
            )}
          </div>

          {/* 指派复核人 + 完成时间 */}
          {!review.reviewerId && !frozen && (
            <div className="assign-form">
              <label>
                复核人
                <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
                  {REVIEWERS.filter((r) => r.role !== '主持人').map((r) => (
                    <option key={r.id} value={r.id}>{r.name} · {r.role}</option>
                  ))}
                </select>
              </label>
              <label>
                完成时间
                <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
              </label>
              <button
                className="primary"
                disabled={!due}
                onClick={() => due && onAssign(pkg.id, reviewerId, fromLocalInput(due))}
              >
                指派
              </button>
            </div>
          )}

          {review.reviewerId && (
            <div className="assignee">
              <div className={`avatar role-${REVIEWERS.find((r) => r.id === review.reviewerId)?.role ?? '主持人'}`}>
                {REVIEWERS.find((r) => r.id === review.reviewerId)?.name[0] ?? '?'}
              </div>
              <div>
                <b>{REVIEWERS.find((r) => r.id === review.reviewerId)?.name}</b>
                <small>
                  {REVIEWERS.find((r) => r.id === review.reviewerId)?.role} ·
                  截止 {formatDateTime(review.dueAt)}
                </small>
              </div>
              {!frozen && state !== 'confirmed' && (
                <button className="link-btn" onClick={() => setFormOpen((v) => !v)}>
                  {formOpen ? '收起' : state === 'stale' ? '填写重审意见' : '改派 / 调整时间'}
                </button>
              )}
            </div>
          )}

          {/* 重新扫描后的差异提示：旧意见自动转待重审 */}
          {state === 'stale' && review.opinion && (
            <div className="stale-note">
              <div className="stale-head"><RefreshCw size={14} /><b>重新扫描后信息已变化，旧意见转为待重审</b></div>
              <div className="diff-list">
                {diffs.map((d) => (
                  <div className="diff-row" key={d.field}>
                    <span>{DIFF_FIELD[d.field]}</span>
                    <s>{d.field === 'status' ? STATUS_LABEL[d.from as keyof typeof STATUS_LABEL] : d.from}</s>
                    <i>→</i>
                    <b>{d.field === 'status' ? STATUS_LABEL[d.to as keyof typeof STATUS_LABEL] : d.to}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 改派 */}
          {formOpen && review.reviewerId && (
            <div className="assign-form inset">
              <label>
                复核人
                <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
                  {REVIEWERS.filter((r) => r.role !== '主持人').map((r) => (
                    <option key={r.id} value={r.id}>{r.name} · {r.role}</option>
                  ))}
                </select>
              </label>
              <label>
                完成时间
                <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
              </label>
              <button className="outline" disabled={!due} onClick={() => {
                if (due) onAssign(pkg.id, reviewerId, fromLocalInput(due));
                setFormOpen(false);
              }}>保存指派</button>
            </div>
          )}

          {/* 当前意见 / 填写表单 */}
          {review.opinion && state === 'confirmed' && !frozen && (
            <div className="confirmed-bar">
              <CheckCircle2 size={15} />
              <span>意见与当前扫描一致，已确认</span>
            </div>
          )}

          {review.opinion && <OpinionCard o={review.opinion} />}

          {/* 待复核 / 待重审填写区 */}
          {!frozen && review.reviewerId && (state === 'pending' || state === 'stale') && (
            <div className="opinion-form">
              <div className="decision-row">
                {DECISIONS.map((d) => (
                  <button
                    key={d}
                    className={`decision-opt ${decision === d ? 'sel d-' + d : ''}`}
                    onClick={() => setDecision(d)}
                  >
                    {DECISION_LABEL[d]}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                placeholder={state === 'stale' ? '重审批注（旧批注保留在下方历史中）' : '填写法务 / 开发复核批注，例如分发义务、替换计划…'}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="form-foot">
                <small>提交即绑定当前 {pkg.version} · {pkg.license} · {STATUS_LABEL[pkg.status]}</small>
                <button className="primary" onClick={submit}>
                  {state === 'stale' ? '确认重审' : '提交复核意见'}
                </button>
              </div>
            </div>
          )}

          {/* 历史批注（重审后保留） */}
          {review.history.length > 0 && (
            <div className="history">
              <div className="history-head"><History size={13} /><span>历史批注（{review.history.length}）</span></div>
              {review.history.map((h, i) => (
                <OpinionCard key={i} o={h} archived />
              ))}
            </div>
          )}

          {frozen && (
            <div className="frozen-note">
              <Info size={14} />
              <span>快照已冻结，本页为冻结时内容；任何新扫描或新意见请在新会议中进行。</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
