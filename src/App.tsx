import { useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MeetingView } from './components/MeetingView';
import { ArchiveView } from './components/ArchiveView';
import { useReviewMeeting } from './state/useReviewMeeting';
import { reviewState } from './domain/meeting';

export default function App() {
  const {
    state,
    nextScanAvailable,
    assign,
    submit,
    rescan,
    addManual,
    freezeAndExport,
    newMeeting,
  } = useReviewMeeting();

  const [view, setView] = useState<'meeting' | 'archive'>('meeting');
  const [selectedId, setSelectedId] = useState<number>(
    state.current.packages.find((p) => p.status !== 'ok')?.id ?? 0,
  );

  // 另开新会议后，自动选中第一项待复核依赖
  const meetingIdRef = useRef(state.current.id);
  useEffect(() => {
    if (meetingIdRef.current !== state.current.id) {
      meetingIdRef.current = state.current.id;
      const firstPending = state.current.packages.find(
        (p) => reviewState(state.current, p) === 'pending',
      );
      setSelectedId(firstPending?.id ?? 0);
    }
  }, [state.current]);

  // 当前选中项失效（删除 / 切换数据）时回退
  useEffect(() => {
    if (selectedId && !state.current.packages.some((p) => p.id === selectedId)) {
      setSelectedId(0);
    }
  }, [state.current.packages, selectedId]);

  return (
    <div className="shell">
      <Sidebar
        meeting={state.current}
        archiveCount={state.archive.length}
        view={view}
        onView={setView}
      />
      <main>
        {view === 'archive' ? (
          <ArchiveView archive={state.archive} onBack={() => setView('meeting')} />
        ) : (
          <MeetingView
            meeting={state.current}
            selectedId={selectedId}
            nextScanAvailable={nextScanAvailable}
            onSelect={setSelectedId}
            onRescan={rescan}
            onAdd={addManual}
            onAssign={assign}
            onSubmit={submit}
            onFreezeExport={freezeAndExport}
            onNewMeeting={() => {
              newMeeting();
              setView('meeting');
            }}
          />
        )}
      </main>
    </div>
  );
}
