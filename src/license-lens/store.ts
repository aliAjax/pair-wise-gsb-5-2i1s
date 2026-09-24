// ─────────────────────────────────────────────────────────────
// 编排层：React hook，串联数据 / 判断 / 保存
// 页面只调用这里暴露的动作，不直接改状态、不直接写存储。
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AppState, Decision, MeetingSnapshot, PackageDep,
} from './types';
import { firstScan, rescan } from './data';
import { loadState, saveState } from './storage';
import {
  assignReviewer, fingerprint, mergeScan, progressOf,
  reviewState, submitReview,
} from './judgments';

const now = () => new Date().toISOString();

function createInitialState(): AppState {
  const startedAt = now();
  return {
    meeting: {
      id: crypto.randomUUID(),
      number: 1,
      project: 'AURORA-WEB',
      host: 'Zen Li',
      stage: 'active',
      startedAt,
      changelog: [{ at: startedAt, kind: 'start', text: '第 1 次复核会议开始，扫描清单已载入' }],
    },
    deps: firstScan,
    reviews: {},
    past: [],
  };
}

export function useMeetingStore() {
  const [state, setState] = useState<AppState>(() => loadState() ?? createInitialState());

  // 保存层副作用：每次状态变化自动持久化
  useEffect(() => { saveState(state); }, [state]);

  const frozen = state.meeting.stage === 'frozen';

  const progress = useMemo(() => progressOf(state), [state]);

  const stateOf = useCallback(
    (dep: PackageDep) => reviewState(dep, state.reviews[dep.id]),
    [state.reviews],
  );

  /** 指派复核人 */
  const assign = useCallback((depId: number, reviewer: string) => {
    setState(s => {
      if (s.meeting.stage !== 'active') return s;
      const dep = s.deps.find(d => d.id === depId);
      if (!dep || !reviewer.trim()) return s;
      return { ...s, reviews: assignReviewer(s.reviews, dep, reviewer.trim()) };
    });
  }, []);

  /** 提交复核意见（绑定当前版本 / 许可证 / 风险快照） */
  const submit = useCallback(
    (depId: number, decision: Decision, comment: string) => {
      setState(s => {
        if (s.meeting.stage !== 'active') return s;
        const dep = s.deps.find(d => d.id === depId);
        const existing = s.reviews[depId];
        if (!dep || !existing?.reviewer) return s; // 必须先有复核人
        return {
          ...s,
          reviews: submitReview(s.reviews, dep, existing.reviewer, decision, comment, now()),
        };
      });
    },
    [],
  );

  /**
   * 重新扫描：包信息变化后，旧意见因为快照对不上而自动转「待重审」
   * （状态现算，批注一行不动）。冻结会议不允许再扫描。
   */
  const rescanDeps = useCallback(() => {
    setState(s => {
      if (s.meeting.stage !== 'active') return s;
      const { deps, changed, added } = mergeScan(s.deps, rescan);
      // 扫描结果与当前清单完全一致 → 幂等，不产生新记录
      if (changed.length === 0 && added.length === 0) return s;
      const text = [
        changed.length ? `${changed.map(d => d.name).join('、')} 的版本/许可证/风险发生变化，原意见转为待重审` : '',
        added.length ? `新增依赖 ${added.map(d => d.name).join('、')}` : '',
      ].filter(Boolean).join('；') || '重新扫描完成，包信息无变化';
      return {
        ...s,
        deps,
        meeting: {
          ...s.meeting,
          changelog: [{ at: now(), kind: 'rescan', text }, ...s.meeting.changelog],
        },
      };
    });
  }, []);

  /** 主持人冻结会议快照；待重审 / 待复核未清完时拒绝 */
  const freeze = useCallback((): { ok: boolean; reason?: string } => {
    const p = progressOf(state);
    if (state.meeting.stage !== 'active') return { ok: false, reason: '会议已冻结' };
    if (!p.canFreeze) {
      return {
        ok: false,
        reason: p.stale > 0
          ? `还有 ${p.stale} 项待重审未确认`
          : `还有 ${p.attentionOpen} 项需要关注的依赖未完成复核`,
      };
    }
    const frozenAt = now();
    const snapshot: MeetingSnapshot = {
      takenAt: frozenAt,
      meeting: {
        ...state.meeting,
        stage: 'frozen',
        frozenAt,
        changelog: [
          { at: frozenAt, kind: 'freeze', text: '主持人冻结会议快照，可导出归档' },
          ...state.meeting.changelog,
        ],
      },
      packages: state.deps.map(d => ({ ...d })),
      reviews: Object.fromEntries(
        Object.values(state.reviews).map(r => [r.depId, structuredClone(r)]),
      ),
    };
    setState({
      ...state,
      meeting: snapshot.meeting,
      deps: snapshot.packages,
      reviews: snapshot.reviews,
      past: [snapshot, ...state.past],
    });
    return { ok: true };
  }, [state]);

  /**
   * 冻结之后的任何改动都必须另开新会议：
   * 以最新扫描清单（重新扫描合并后的结果）为起点，意见清空，
   * 历史会议快照留在 past 中可回溯。
   */
  const startNextMeeting = useCallback(() => {
    setState(s => {
      if (s.meeting.stage !== 'frozen') return s;
      const startedAt = now();
      const number = s.meeting.number + 1;
      return {
        ...s,
        meeting: {
          id: crypto.randomUUID(),
          number,
          project: s.meeting.project,
          host: s.meeting.host,
          stage: 'active',
          startedAt,
          changelog: [{ at: startedAt, kind: 'start', text: `第 ${number} 次复核会议开始（承接冻结快照 #${s.meeting.number}）` }],
        },
        reviews: {},
      };
    });
  }, []);

  /** 演示用：回到全新状态 */
  const resetDemo = useCallback(() => setState(createInitialState()), []);

  return {
    state, frozen, progress, stateOf, fingerprint,
    assign, submit, rescanDeps, freeze, startNextMeeting, resetDemo,
  };
}
