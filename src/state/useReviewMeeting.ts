// ─────────────────────────────────────────────────────────────
// 状态桥接层：把领域纯函数接到 React 状态与保存层
// 不出现任何 JSX
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Decision, PackageInfo, PersistedState } from '../types';
import { NEXT_SCANS, riskForLicense } from '../data/scanData';
import {
  addPackage,
  applyScan,
  assignReviewer,
  freezeMeeting,
  startNextMeeting,
  submitOpinion,
} from '../domain/meeting';
import { buildReport } from '../domain/report';
import { REVIEWERS } from '../data/scanData';
import { exportToFile, loadState, saveState } from '../storage/meetingStore';

export function useReviewMeeting() {
  const [state, setState] = useState<PersistedState>(() => loadState());

  useEffect(() => saveState(state), [state]);

  /** 是否还有可演示的下一次扫描场景 */
  const nextScanAvailable = state.current.scanNo < NEXT_SCANS.length;

  const assign = useCallback((pkgId: number, reviewerId: string, dueAt: string) => {
    setState((s) => ({ ...s, current: assignReviewer(s.current, pkgId, reviewerId, dueAt) }));
  }, []);

  const submit = useCallback(
    (pkgId: number, reviewerId: string, decision: Decision, comment: string, dueAt: string) => {
      setState((s) => ({
        ...s,
        current: submitOpinion(s.current, pkgId, {
          reviewerId,
          decision,
          comment,
          dueAt,
          now: new Date().toISOString(),
        }),
      }));
    },
    [],
  );

  /** 重新扫描：新包信息进入当前会议，旧意见由领域层自动判定为待重审 */
  const rescan = useCallback(() => {
    setState((s) => {
      const scenario = NEXT_SCANS[s.current.scanNo];
      if (!scenario) return s;
      // 手动添加的包不在扫描结果中，按重新接入扫描处理会被移除，
      // 这里合并保留它们（模拟扫描器同样识别手动包）。
      const scannedIds = new Set(scenario.map((p) => p.id));
      const keptManual = s.current.packages.filter(
        (p) => p.source === '手动' && !scannedIds.has(p.id),
      );
      const merged: PackageInfo[] = [...scenario, ...keptManual];
      return { ...s, current: applyScan(s.current, merged, new Date().toISOString()) };
    });
  }, []);

  const addManual = useCallback((name: string, license: string) => {
    setState((s) => {
      const id = Date.now();
      const pkg: PackageInfo = {
        id,
        name: name.trim(),
        version: '1.0.0',
        license,
        source: '手动',
        status: riskForLicense(license),
        note: license === 'MIT' ? '宽松许可，可商用' : '请核对分发义务',
      };
      return { ...s, current: addPackage(s.current, pkg) };
    });
  }, []);

  /** 主持人冻结快照并导出 Markdown（冻结后当前会议只读） */
  const freezeAndExport = useCallback(() => {
    const current = state.current;
    if (current.frozenAt) return;
    const frozen = freezeMeeting(current, new Date().toISOString());
    const markdown = buildReport(frozen, REVIEWERS);
    exportToFile(`license-review-meeting-${frozen.meetingNo}.md`, markdown);
    setState((s) => (s.current.frozenAt ? s : { ...s, current: { ...frozen } }));
  }, [state.current]);

  const newMeeting = useCallback(() => {
    setState((s) => {
      if (!s.current.frozenAt) return s;
      const moved = startNextMeeting(s.current, s.archive, new Date().toISOString());
      return { ...s, current: moved.current, archive: moved.archive };
    });
  }, []);

  return useMemo(
    () => ({
      state,
      nextScanAvailable,
      assign,
      submit,
      rescan,
      addManual,
      freezeAndExport,
      newMeeting,
    }),
    [state, nextScanAvailable, assign, submit, rescan, addManual, freezeAndExport, newMeeting],
  );
}
