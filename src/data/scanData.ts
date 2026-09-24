// ─────────────────────────────────────────────────────────────
// 数据层：初始数据、人员、模拟重新扫描场景
// 重新扫描的场景按顺序推进（演示扫描后包信息变化）
// ─────────────────────────────────────────────────────────────

import type { PackageInfo, Reviewer } from '../types';

export const REVIEWERS: Reviewer[] = [
  { id: 'u-zhang', name: '张敏', role: '法务' },
  { id: 'u-li', name: '李涛', role: '开发' },
  { id: 'u-zhao', name: '赵晗', role: '主持人' },
];

export const HOST_ID = 'u-zhao';

/** 许可证配色（展示用，保留原 License Lens 视觉） */
export const LICENSE_COLORS: Record<string, string> = {
  MIT: '#35b995',
  'BSD-3-Clause': '#6d9ee8',
  'GPL-3.0': '#ec8c75',
  'Apache-2.0': '#b18ee4',
  'ISC': '#6d9ee8',
};

const SCAN_0: PackageInfo[] = [
  { id: 1, name: 'react', version: '18.3.1', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  { id: 2, name: 'lodash', version: '4.17.21', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  { id: 3, name: 'chart.js', version: '4.4.4', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  { id: 4, name: 'highlight.js', version: '11.10.0', license: 'BSD-3-Clause', source: 'npm', status: 'warn', note: '再发布需保留版权声明' },
  { id: 5, name: 'legacy-parser', version: '2.1.0', license: 'GPL-3.0', source: '手动', status: 'risk', note: '可能与闭源分发冲突' },
];

/** 第二次扫描：两个待复核包的信息发生变化 → 旧意见自动转待重审 */
const SCAN_1: PackageInfo[] = [
  SCAN_0[0],
  SCAN_0[1],
  SCAN_0[2],
  { id: 4, name: 'highlight.js', version: '11.10.1', license: 'BSD-3-Clause', source: 'npm', status: 'warn', note: '补丁版本更新；再发布需保留版权声明，新增 NOTICE 文件要求' },
  { id: 5, name: 'legacy-parser', version: '2.1.0', license: 'GPL-3.0', source: '手动', status: 'warn', note: '隔离方案已落地，风险降级，需重新确认' },
];

/** 第三次扫描：版本与许可证变化 + 新引入待复核依赖 */
const SCAN_2: PackageInfo[] = [
  SCAN_0[0],
  { id: 2, name: 'lodash', version: '4.18.0', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  SCAN_0[2],
  { id: 4, name: 'highlight.js', version: '11.11.1', license: 'MIT', source: 'npm', status: 'ok', note: '新版本切换到 MIT 许可，旧 BSD 义务不再适用' },
  { id: 5, name: 'legacy-parser', version: '2.2.0', license: 'LGPL-3.0', source: '手动', status: 'warn', note: '已替换为 LGPL 动态链接版本，需复核链接方式' },
  { id: 6, name: 'pdf-kit', version: '0.15.0', license: 'BSD-3-Clause', source: 'npm', status: 'warn', note: '新引入依赖，再发布需保留版权声明' },
];

/** 可演示的后续扫描场景（第 0 批为初始扫描） */
export const NEXT_SCANS: PackageInfo[][] = [SCAN_1, SCAN_2];

export const INITIAL_SCAN: PackageInfo[] = SCAN_0;

/** 新许可证的默认风险判定（手动添加依赖时使用） */
export function riskForLicense(license: string): PackageInfo['status'] {
  if (license.startsWith('GPL')) return 'risk';
  if (license === 'MIT' || license === 'ISC') return 'ok';
  return 'warn';
}
