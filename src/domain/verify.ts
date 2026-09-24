// 领域逻辑验证脚本：node --experimental-strip-types src/domain/verify.ts
import { INITIAL_SCAN, NEXT_SCANS, REVIEWERS } from '../data/scanData';
import { createFirstMeeting } from '../storage/meetingStore';
import {
  applyScan,
  bindingDiff,
  canFreeze,
  freezeMeeting,
  frozenBlockers,
  getReview,
  meetingCounts,
  needsReview,
  reviewState,
  startNextMeeting,
  submitOpinion,
} from './meeting';
import { buildReport } from './report';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

const T0 = '2026-09-24T01:00:00.000Z';
const T1 = '2026-09-24T03:00:00.000Z';
const T2 = '2026-09-24T05:00:00.000Z';
const T3 = '2026-09-24T07:00:00.000Z';

// ① 初始扫描：warn/risk 为待复核项，需要指派 + 意见
let m = createFirstMeeting(T0);
const c0 = meetingCounts(m);
check('初始有 2 项待复核（highlight.js / legacy-parser）', c0.target === 2 && c0.pending === 2, JSON.stringify(c0));
check('安全包无需复核', reviewState(m, INITIAL_SCAN[0]) === 'not-needed');

// ② 逐项指派复核人 + 完成时间，并提交意见（绑定版本/许可证/风险状态）
m = submitOpinion(m, 4, { reviewerId: REVIEWERS[0].id, decision: 'mitigate', comment: '保留 BSD 版权声明即可', dueAt: T1, now: T1 });
m = submitOpinion(m, 5, { reviewerId: REVIEWERS[1].id, decision: 'replace', comment: 'GPL 与闭源冲突，计划替换', dueAt: T1, now: T1 });
const o4 = getReview(m, 4).opinion!;
check('意见绑定当时的版本/许可证/风险状态', o4.version === '11.10.0' && o4.license === 'BSD-3-Clause' && o4.status === 'warn');
check('两项均已确认', meetingCounts(m).confirmed === 2 && canFreeze(m));

// ③ 重新扫描：包信息变化 → 旧意见自动转待重审，批注保留
m = applyScan(m, NEXT_SCANS[0], T2);
check('扫描批次递增', m.scanNo === 1);
check('highlight.js 版本变化 → 待重审', reviewState(m, m.packages.find((p) => p.id === 4)!) === 'stale');
check('legacy-parser 风险 risk→warn → 待重审', reviewState(m, m.packages.find((p) => p.id === 5)!) === 'stale');
const diff5 = bindingDiff(getReview(m, 5).opinion!, m.packages.find((p) => p.id === 5)!);
check('差异定位到风险状态', diff5.some((d) => d.field === 'status' && d.from === 'risk' && d.to === 'warn'));
check('旧批注仍保留在 opinion 中', getReview(m, 5).opinion!.comment.includes('计划替换'));
check('存在待重审时禁止冻结', !canFreeze(m) && frozenBlockers(m).length === 1);

// ④ 待重审项确认完 → 旧意见归档保留批注
m = submitOpinion(m, 4, { reviewerId: REVIEWERS[0].id, decision: 'approve', comment: 'NOTICE 已补充，通过', dueAt: T3, now: T3 });
m = submitOpinion(m, 5, { reviewerId: REVIEWERS[1].id, decision: 'mitigate', comment: '隔离方案已确认，接受降级', dueAt: T3, now: T3 });
const r4 = getReview(m, 4);
check('重审后为已确认', reviewState(m, m.packages.find((p) => p.id === 4)!) === 'confirmed');
check('旧意见归档到 history 且批注保留', r4.history.length === 1 && r4.history[0].comment.includes('BSD 版权声明'));
check('全部确认后可冻结', canFreeze(m));

// ⑤ 主持人冻结快照并导出；冻结后只读
const frozen = freezeMeeting(m, T3);
check('快照冻结时间写入', frozen.frozenAt === T3);
let blocked = false;
try { applyScan(frozen, NEXT_SCANS[1], T3); } catch { blocked = true; }
check('冻结后不能重新扫描', blocked);
let blocked2 = false;
try { submitOpinion(frozen, 4, { reviewerId: REVIEWERS[0].id, decision: 'approve', comment: 'x', dueAt: T3, now: T3 }); } catch { blocked2 = true; }
check('冻结后不能提交意见', blocked2);

const report = buildReport(frozen, REVIEWERS);
check('报告含会议与冻结时间', report.includes('快照冻结') && report.includes('2026'));
check('报告含当前意见与历史批注', report.includes('NOTICE 已补充') && report.includes('保留 BSD 版权声明'));

// ⑥ 第二次扫描（场景2）在新会议中进行
const next = startNextMeeting(frozen, [], T3);
const m2 = next.current;
check('另开新会议编号递增', m2.meetingNo === 2);
check('当前会议不冻结', m2.frozenAt === null);
check('新会议意见全部重置（无当前意见）', m2.packages.every((p) => getReview(m2, p.id).opinion === null));
check('保留上一任复核人指派', getReview(m2, 4).reviewerId === REVIEWERS[0].id);
check('旧会议进入归档', next.archive.length === 1 && next.archive[0].frozenAt === T3);
const rescanned = applyScan(m2, NEXT_SCANS[1], T3);
check('新会议可继续扫描到第 2 批', rescanned.scanNo === 2);
const pdf = rescanned.packages.find((p) => p.id === 6)!;
check('新引入 warn 依赖进入待复核', needsReview(pdf) && reviewState(rescanned, pdf) === 'pending');
const hl2 = rescanned.packages.find((p) => p.id === 4)!;
check('highlight.js 转为 MIT 安全包，无需复核', hl2.license === 'MIT' && reviewState(rescanned, hl2) === 'not-needed');

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
