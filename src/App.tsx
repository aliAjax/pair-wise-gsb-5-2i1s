import { useState } from 'react';
import { useMeetingStore } from './license-lens/store';
import Sidebar from './license-lens/Sidebar';
import MeetingBar from './license-lens/MeetingBar';
import PackageTable from './license-lens/PackageTable';
import DetailPanel from './license-lens/DetailPanel';
import PastSnapshotView from './license-lens/PastSnapshotView';

export default function App() {
  const {
    state, frozen, progress, stateOf,
    assign, submit, rescanDeps, freeze, startNextMeeting, resetDemo,
  } = useMeetingStore();

  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [selectedPastId, setSelectedPastId] = useState<string | null>(null);

  // 查看历史冻结快照：只读归档视图
  const pastSnapshot = selectedPastId
    ? state.past.find(s => s.meeting.id === selectedPastId) ?? null
    : null;
  if (pastSnapshot) {
    return (
      <div className="shell">
        <Sidebar
          state={state}
          progress={progress}
          selectedPastId={selectedPastId}
          onSelectPast={setSelectedPastId}
          onReset={resetDemo}
        />
        <PastSnapshotView snapshot={pastSnapshot} onBack={() => setSelectedPastId(null)} />
      </div>
    );
  }

  const current = selectedId != null ? state.deps.find(d => d.id === selectedId) : null;

  return (
    <div className="shell">
      <Sidebar
        state={state}
        progress={progress}
        selectedPastId={null}
        onSelectPast={id => { setSelectedPastId(id); if (id) setSelectedId(null); }}
        onReset={resetDemo}
      />

      <main>
        <header>
          <div>
            <div className="crumb">WORKSPACE / <b>PROJECT SCAN</b></div>
            <h1>许可证复核会台</h1>
            <p>逐项确认依赖许可，意见、复核人与完成时间随会议快照归档。</p>
          </div>
        </header>

        <MeetingBar
          state={state}
          progress={progress}
          onRescan={rescanDeps}
          onFreeze={freeze}
          onNextMeeting={startNextMeeting}
        />

        <section className="summary">
          <div><span>全部依赖</span><b>{progress.total}</b><small>扫描清单</small></div>
          <div><span>已确认</span><b className="teal">{progress.confirmed}</b><small>意见与当前快照一致</small></div>
          <div><span>待重审</span><b className={`${progress.stale > 0 ? 'red' : ''}`}>{progress.stale}</b><small>重新扫描后信息已变</small></div>
          <div><span>待复核 / 分派</span><b className="orange">{progress.assigned + progress.pending}</b><small>{progress.attentionOpen} 个风险项未关闭</small></div>
        </section>

        <section className="workspace">
          <PackageTable
            state={state}
            progress={progress}
            stateOf={stateOf}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {current && (
            <DetailPanel
              dep={current}
              review={state.reviews[current.id]}
              frozen={frozen}
              onClose={() => setSelectedId(null)}
              onAssign={assign}
              onSubmit={submit}
            />
          )}
        </section>

        <section className="changelog">
          <h2>会议记录</h2>
          {state.meeting.changelog.map((c, i) => (
            <div key={i} className={`change-item kind-${c.kind}`}>
              <span className="change-time">
                {new Date(c.at).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="change-dot" />
              <span className="change-text">{c.text}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
