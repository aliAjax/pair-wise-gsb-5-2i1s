// ─────────────────────────────────────────────────────────────
// 数据层：扫描器产出的包信息
// 真实环境里这些来自扫描服务；演示环境用两批固定数据模拟
// 「首次扫描」与「重新扫描后包信息发生变化」。
// ─────────────────────────────────────────────────────────────

import type { PackageDep } from './types';

/** 首次扫描结果（进入复核会时看到的清单） */
export const firstScan: PackageDep[] = [
  { id: 1, name: 'react',        version: '18.3.1',  license: 'MIT',           source: 'npm', status: 'ok',   note: '宽松许可，可商用' },
  { id: 2, name: 'lodash',       version: '4.17.21', license: 'MIT',           source: 'npm', status: 'ok',   note: '宽松许可，可商用' },
  { id: 3, name: 'chart.js',     version: '4.4.4',   license: 'MIT',           source: 'npm', status: 'ok',   note: '宽松许可，可商用' },
  { id: 4, name: 'highlight.js', version: '11.10.0', license: 'BSD-3-Clause',  source: 'npm', status: 'warn', note: '再发布需保留版权声明' },
  { id: 5, name: 'legacy-parser',version: '2.1.0',   license: 'GPL-3.0',       source: '手动', status: 'risk', note: '可能与闭源分发冲突' },
];

/**
 * 重新扫描结果：
 *  - highlight.js 版本升级（快照失效 → 待重审）
 *  - legacy-parser 许可证从 GPL-3.0 变为 LGPL-2.1，风险从 risk 降到 warn
 *  - 新出现 date-fns（Apache-2.0，warn）
 *  - react / lodash / chart.js 不变
 */
export const rescan: PackageDep[] = [
  { id: 0, name: 'react',        version: '18.3.1',  license: 'MIT',           source: 'npm', status: 'ok',   note: '宽松许可，可商用' },
  { id: 0, name: 'lodash',       version: '4.17.21', license: 'MIT',           source: 'npm', status: 'ok',   note: '宽松许可，可商用' },
  { id: 0, name: 'chart.js',     version: '4.4.4',   license: 'MIT',           source: 'npm', status: 'ok',   note: '宽松许可，可商用' },
  { id: 0, name: 'highlight.js', version: '11.11.1', license: 'BSD-3-Clause',  source: 'npm', status: 'warn', note: '再发布需保留版权声明；新版本更新了声明模板' },
  { id: 0, name: 'legacy-parser',version: '2.1.0',   license: 'LGPL-2.1',      source: '手动', status: 'warn', note: '动态链接并允许用户替换库即可，义务较 GPL 宽松' },
  { id: 0, name: 'date-fns',     version: '3.6.0',   license: 'Apache-2.0',    source: 'npm', status: 'warn', note: '需保留 NOTICE 文件与修改声明' },
];

/** 可被指派为复核人的成员 */
export const reviewers = ['Zen Li', 'Maya Chen', 'Omar Faruk', '法律 · 周岚', '安全 · 韩松'];
