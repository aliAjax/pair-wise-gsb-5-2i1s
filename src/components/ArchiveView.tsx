import { Archive, ArrowLeft, FileCode2, Snowflake } from 'lucide-react';
import type { Meeting } from '../types';
import { getReview, meetingCounts, needsReview, DECISION_LABEL } from '../domain/meeting';
import { REVIEWERS } from '../data/scanData';
import { formatFull } from '../utils/time';

interface Props {
  archive: Meeting[];
  onBack: () => void;
}

export function ArchiveView({ archive, onBack }: Props) {
  return (
    <>
      <header>
        <div>
          <div className="crumb">REVIEW CONSOLE / <b>ARCHIVE</b></div>
          <h1>历史会议快照</h1>
          <p>冻结后的会议永久留档只读；后续重新扫描与意见改动属于新会议。</p>
        </div>
        <div className="head-actions">
          <button className="outline" onClick={onBack}><ArrowLeft size={15} />回到当前会议</button>
        </div>
      </header>

      {archive.length === 0 ? (
        <div className="archive-empty">
          <Archive size={26} />
          <b>还没有冻结过的会议</b>
          <p>主持人冻结会议快照并导出后，该会议会归档到这里。</p>
        </div>
      ) : (
        <div className="archive-list">
          {archive
            .slice()
            .sort((a, b) => (a.frozenAt! < b.frozenAt! ? 1 : -1))
            .map((m) => {
              const c = meetingCounts(m);
              return (
                <div className="archive-card" key={m.id}>
                  <div className="archive-card-head">
                    <div className="archive-icon"><Snowflake size={18} /></div>
                    <div>
                      <h2>{m.title}</h2>
                      <small>
                        创建 {formatFull(m.createdAt)} · 冻结 {formatFull(m.frozenAt)} ·
                        主持人 {REVIEWERS.find((r) => r.id === m.hostId)?.name}
                      </small>
                    </div>
                    <span className="frozen-pill">第 {m.scanNo} 次扫描时冻结</span>
                  </div>
                  <div className="archive-targets">
                    {m.packages.filter(needsReview).map((p) => {
                      const r = getReview(m, p.id);
                      const reviewer = REVIEWERS.find((x) => x.id === r.reviewerId);
                      return (
                        <div className="archive-target" key={p.id}>
                          <FileCode2 size={14} />
                          <b>{p.name}@{p.version}</b>
                          <i>{p.license}</i>
                          {r.opinion && (
                            <>
                              <span className={`decision-tag d-${r.opinion.decision}`}>
                                {DECISION_LABEL[r.opinion.decision]}
                              </span>
                              <small>{reviewer?.name} · {formatFull(r.opinion.submittedAt)}</small>
                            </>
                          )}
                          {r.history.length > 0 && <small className="hist-count">含 {r.history.length} 条旧批注</small>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="archive-foot">{c.confirmed} 项复核意见已随快照导出</div>
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}
