import data from './content.generated.json';
import type { StageId, WorkflowInfo } from './contracts.js';
import type { Files } from './files.js';

export interface StudioContent {
  version: string;
  sha256: string;
  rolePrompts: Record<string, { name: string; instructions: string; responsibilities: string[] }>;
  stages: Record<StageId, { title: string; role: string; prompt: string }>;
  files: Files;
  managerFiles?: Files;
  oracle: string;
  operatingContract: string;
  help: string;
}
export const studioContent: StudioContent = data;
export function workflowInfo(content = studioContent): WorkflowInfo {
  return {
    id: 'PS-001',
    title: 'Build a stock alert utility',
    templateId: 'product-studio',
    contentVersion: content.version,
    description:
      'A synthetic Product Studio job: five roles turn an inventory brief into a tested Python utility you can download and review.',
    prerequisites: [
      'Optional Codex CLI, signed in with your own account and allowance',
      'Python 3.8 or newer (standard library only)',
      'Local Codex sandbox on macOS or Linux; native Windows workflow checks are not yet supported',
    ],
    deliverables: ['stock_alert.py', 'test_stock_alert.py', 'expected.json', 'USAGE.md'],
    stages: Object.entries(content.stages).map(([id, stage]) => ({
      id: id as StageId,
      title: stage.title,
      role: stage.role,
    })),
    maxRepairCandidates: 2,
    permissionNotice:
      'Start permits five separate Codex sessions to create files and run local commands in isolated job directories, plus at most two repair candidates. Your Codex account allowance applies. Shell network, web and connected apps are disabled. The workspace sandbox restricts writes; it is not full read isolation. Use a dedicated OS account for sensitive machines. No publishing, messaging or automatic owner acceptance.',
    help: content.help,
    brief: content.files['brief.md'],
    criteria: content.files['requirements.md'],
    inputPreview: content.files['input.json'],
    expectedPreview: content.files['expected.json'],
  };
}
