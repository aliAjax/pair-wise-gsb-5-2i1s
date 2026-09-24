import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, FileCode2, History, Info,
  Lock, MessageSquareText, RefreshCw, UserPlus, X,
} from 'lucide-react';
import type { Decision, PackageDep, Review } from './types';
import { reviewers } from './data';
import {
  DECISION_TEXT, RISK_TEXT, diffPackage, fingerprint, reviewFingerprint, reviewState,
} from './judgments';
import { licenseColors } from './PackageTable';

interface Props {
  dep: PackageDep;
  review?: Review;
  frozen: boolean;
  onClose: () => void;
  onAssign: (depId: number, reviewer: string) => void;
  onSubmit: (depId: number, decision: Decision, comment: string) => void;
}

const fmt = (iso?: string) => iso
  ? new Date(iso).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

export default function DetailPanel({ dep, review, frozen, onClose, onAssign, onSubmit }: Props) {
  const st = reviewState(dep, review);
  const [reviewer, setReviewer] = useState(review?.reviewer ?? '');
  const [decision, setDecision] = useState<Decision>(review?.decision ?? 'retain');
  const [comment, setComment] = useState(review?.comment ?? '');

  // 切换依赖时，表单回填当前意见内容
  useEffect(() => {
    setReviewer(review?.reviewer ?? '');
    setDecision(review?.decision ?? (dep.status === 'risk' ? 'escalate' : dep.status === 'ok' ? 'approve' : 'retain'));
    setComment(review?.comment ?? '');
  }, [dep.id, dep.version, dep.license, dep.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = review ? diffPackage(review, dep) : null;
  const changed = st === 'stale' && d && (d.version || d.license || d.risk);
  const color = licenseColors[dep.license] || '#888';

  return (
    <div className="detail">
      <div className="detail-head">
        <div className="detail-icon" style={{ background: `${color}1c`, color }}>
          <FileCode2 size={20} />
        </div>
        <div>
          <span>SELECTED DEPENDENCY · {dep.source.toUpperCase()}</span>
          <h2>{dep.name}</h2>
        </div>
        <button className="close" onClick={onClose}><X size={16} /></button>
      </div>

      {/* 待重审横幅：重新扫描后包信息变化，旧意见绑定的快照已过期 */}
      {changed && (
        <div className="stale-banner">
          <div className="banner-icon"><RefreshCw size={16} /></div>
          <div>
            <b>重新扫描后包信息已变化，旧意见自动转为待重审</b>
            <p>
              {d.version && <span>版本 <s>{review!.snapshotVersion}</s> <ArrowRight size={10} /> <b>{dep.version}</b>；</span>}
              {d.license && <span>许可证 <s>{review!.snapshotLicense}</s> <ArrowRight size={10} /> <b>{dep.license}</b>；</span>}
              {d.risk && <span>风险 <s>{RISK_TEXT[review!.snapshotRisk]}</s> <ArrowRight size={10} /> <b>{RISK_TEXT[dep.status]}</b>；</span>}
              原批注与结论已原样保留在下方，请复核人按新信息重新确认。
            </p>
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div>
          <label>当前版本</label>
          <b className={d?.version ? 'cell-changed' : ''}>{dep.version}</b>
          {d?.version && <small>意见绑定：{review!.snapshotVersion}</small>}
        </div>
        <div>
          <label>当前许可证</label>
          <b className={d?.license ? 'cell-changed' : ''}>{dep.license}</b>
          {d?.license && <small>意见绑定：{review!.snapshotLicense}</small>}
        </div>
        <div>
          <label>当前风险</label>
          <b className={`risk-${dep.status} ${d?.risk ? 'cell-changed' : ''}`}>{RISK_TEXT[dep.status]}</b>
          {d?.risk && <small>意见绑定：{RISK_TEXT[review!.snapshotRisk]}</small>}
        </div>
      </div>

      <div className={`finding ${dep.status}`}>
        <div className="finding-icon">
          {dep.status === 'ok' ? <Check size={16} /> : <AlertTriangle size={16} />}
        </div>
        <div>
          <b>{dep.status === 'ok' ? '可以放心使用' : dep.status === 'warn' ? '需要保留声明' : '存在分发限制'}</b>
          <p>{dep.note}。扫描结果基于包元数据，最终结论以复核人意见为准。</p>
        </div>
      </div>

      {/* 扫描指纹 + 复核人 */}
      <div className="review-block">
        <div className="block-title"><UserPlus size={14} /> 复核人与完成时间</div>
        <div className="assign-row">
          <select
            value={reviewer}
            disabled={frozen || Boolean(review?.completedAt)}
            title={review?.completedAt ? '复核人随已提交意见绑定，如需改派请在新会议中处理' : undefined}
            onChange={e => { setReviewer(e.target.value); onAssign(dep.id, e.target.value); }}
          >
            <option value="">指派复核人…</option>
            {reviewers.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="completed-time">
            <label>完成时间</label>
            <b>{review?.completedAt ? fmt(review.completedAt) : '尚未完成'}</b>
          </div>
        </div>
        {review?.completedAt && !frozen && (
          <p className="bind-note">
            <Lock size={11} /> 复核人「{review.reviewer}」与完成时间已随意见快照锁定；
            {st === 'stale' ? '重新扫描后请由该复核人在下方重新确认。' : '改派需另开新会议。'}
          </p>
        )}
      </div>

      {/* 意见表单：提交后绑定当前指纹 */}
      <div className="review-block">
        <div className="block-title">
          <MessageSquareText size={14} /> 复核意见
          <span className="fp">
            绑定快照 <code>{review ? reviewFingerprint(review) : fingerprint(dep)}</code>
          </span>
        </div>

        {frozen ? (
          <div className="locked-note"><Lock size={13} /> 会议已冻结，意见不可修改；如需调整请另开新会议。</div>
        ) : !reviewer ? (
          <div className="locked-note muted-lock">请先在上方指派复核人，再提交意见。</div>
        ) : null}

        <div className="decision-grid">
          {(Object.keys(DECISION_TEXT) as Decision[]).map(key => (
            <label key={key} className={`decision opt-${key} ${decision === key ? 'picked' : ''} ${(!reviewer || frozen) ? 'disabled' : ''}`}>
              <input
                type="radio"
                name={`decision-${dep.id}`}
                checked={decision === key}
                disabled={!reviewer || frozen}
                onChange={() => setDecision(key)}
              />
              {DECISION_TEXT[key]}
            </label>
          ))}
        </div>

        <textarea
          value={comment}
          disabled={!reviewer || frozen}
          onChange={e => setComment(e.target.value)}
          placeholder="写下批注：分发义务、替换建议、需要法务确认的点…"
          rows={3}
        />

        <button
          className="primary full"
          disabled={!reviewer || frozen}
          onClick={() => onSubmit(dep.id, decision, comment)}
        >
          {st === 'stale' ? <RefreshCw size={14} /> : <Check size={14} />}
          {st === 'stale' ? '按新扫描结果重新确认' : (review?.completedAt ? '更新意见（刷新绑定快照）' : '提交意见并完成复核')}
        </button>
      </div>

      {/* 重审留痕：旧批注完整保留 */}
      {review && review.reconfirmations.length > 0 && (
        <div className="history-block">
          <div className="block-title"><History size={14} /> 重审批注留痕（{review.reconfirmations.length}）</div>
          {[...review.reconfirmations].reverse().map((h, i) => (
            <div key={i} className="history-item">
              <div className="history-head">
                <b>{fmt(h.at)}</b>
                <span>{h.fromVersion}·{h.fromLicense}·{RISK_TEXT[h.fromRisk]}</span>
                <ArrowRight size={11} />
                <span className="to">{h.toVersion}·{h.toLicense}·{RISK_TEXT[h.toRisk]}</span>
              </div>
              <p className="old-comment">
                旧批注（{DECISION_TEXT[h.previousDecision]}）：{h.previousComment || '（无批注）'}
              </p>
              <p className="new-comment">
                重审意见（{DECISION_TEXT[h.decision]}）：{h.comment || '（无批注）'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="full-license">
        <div><Info size={15} /><span>许可证摘要</span></div>
        <p>{dep.license} 允许在满足其条款的前提下使用和分发代码。详细义务请参考项目仓库中的 LICENSE 文件。</p>
      </div>
    </div>
  );
}
