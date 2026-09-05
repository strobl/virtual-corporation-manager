/** A bounded local workflow. Agent output never grants owner acceptance. */
export type JobStatus =
  | 'queued'
  | 'running'
  | 'waiting_owner'
  | 'accepted'
  | 'rejected'
  | 'blocked'
  | 'failed'
  | 'cancelled';
export type StageId = 'intake' | 'requirements' | 'build' | 'qa' | 'handoff';
export const JOB_STAGE_ORDER: StageId[] = ['intake', 'requirements', 'build', 'qa', 'handoff'];
export const JOB_REQUIRED_OUTPUTS: Record<StageId, string[]> = {
  intake: ['INTAKE.md'],
  requirements: ['SCOPE.md'],
  build: ['stock_alert.py', 'test_stock_alert.py', 'expected.json', 'USAGE.md'],
  qa: ['QA.json', 'QA.md'],
  handoff: ['HANDOFF.md'],
};
export function safeArtifactPath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 240 &&
    path.split('/').every((p) => /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(p)) &&
    /\.(py|json|md|txt|csv)$/.test(path)
  );
}
export interface JobArtifact {
  id: string;
  stageId: string;
  path: string;
  sha256: string;
  bytes: number;
  source: 'runtime' | 'input' | 'verifier';
}
export interface JobCommand {
  id: string;
  command: string;
  status: string;
  exitCode: number | null;
  output: string;
  observedAt: string;
}
export interface JobStage {
  id: string;
  kind: StageId;
  attempt: number;
  agentId: string;
  agentName: string;
  role: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt: string | null;
  sessionId: string | null;
  runtimeVersion: string | null;
  promptSha256: string;
  inputHashes: Record<string, string>;
  output: string;
  error: string | null;
  commands: JobCommand[];
  artifacts: JobArtifact[];
}
export interface JobInfo {
  id: string;
  requestId: string;
  workflowId: 'PS-001';
  title: string;
  companyId: string;
  companyName: string;
  /** Explicit human name or responsible role; absent only on older local candidates. */
  acceptanceOwner?: string;
  contentVersion: string;
  contentSha256: string;
  contextSha256: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  candidate: number;
  maxRepairCandidates: number;
  retryable: boolean;
  retryReason: string | null;
  retryCount: number;
  stages: JobStage[];
  error: string | null;
  /** Absent on historical jobs; never backfill a historical owner's decision. */
  bundle?: { version: 1; provenance: string; sha256: string; bytes: number };
  ownerReview: {
    decision: 'accepted' | 'rejected';
    note: string;
    reviewedAt: string;
    bundleSha256?: string;
  } | null;
  events: { at: string; message: string }[];
}
export const completedJobStage = (job: JobInfo, kind: StageId) =>
  job.stages.findLast(
    (s) =>
      s.kind === kind &&
      s.status === 'completed' &&
      (kind === 'intake' || kind === 'requirements' || s.attempt === job.candidate),
  );
export interface WorkflowInfo {
  id: 'PS-001';
  title: string;
  description: string;
  templateId: string;
  contentVersion: string;
  prerequisites: string[];
  deliverables: string[];
  stages: { id: StageId; title: string; role: string }[];
  maxRepairCandidates: number;
  permissionNotice: string;
  help: string;
  brief: string;
  criteria: string;
  inputPreview: string;
  expectedPreview: string;
}
