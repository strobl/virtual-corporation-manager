/** Shared local contracts. Configuration never implies runtime activation. */
export type EntityStatus = 'active' | 'archived';
export interface Company { id: string; name: string; shortCode: string; description: string; color: string; status: EntityStatus; version: number; createdAt: string; updatedAt: string }
export interface Department { id: string; companyId: string; name: string; description: string; managerId: string | null }
export interface Agent { id: string; name: string; role: string; kind: 'agent' | 'human'; instructions: string; responsibilities: string[]; departmentId: string | null; managerId: string | null; status: EntityStatus; version: number; createdAt: string; updatedAt: string }
export interface Assignment { id: string; agentId: string; companyId: string; isPrimary: boolean; startedAt: string; endedAt: string | null }
export interface Relationship { id: string; fromCompanyId: string; toCompanyId: string; kind: 'ownership' | 'collaboration'; percentage: number | null; description: string; startedAt: string; endedAt: string | null }
export interface WorkRecord { id: string; companyId: string; agentId: string; title: string; output: string; provenance: 'manual' | 'codex' | 'buzz' | 'slack'; status: 'submitted' | 'accepted' | 'failed'; createdAt: string; durationMs: number | null; runId: string | null }
export interface AuditEntry { id: string; action: string; summary: string; revision: number; createdAt: string; undoable: boolean }
export interface WorkspaceState { schemaVersion: number; revision: number; companies: Company[]; departments: Department[]; agents: Agent[]; assignments: Assignment[]; relationships: Relationship[]; work: WorkRecord[]; history: AuditEntry[] }
export type CompanyDefinition = { schemaVersion: 1; name: string; description: string; companies: Company[]; departments: Department[]; agents: Agent[]; assignments: Assignment[]; relationships: Relationship[] };
export type DomainCommand =
 | { type: 'company.create'; input: Pick<Company,'name'|'shortCode'|'description'|'color'> }
 | { type: 'company.update'; id: string; input: Partial<Pick<Company,'name'|'shortCode'|'description'|'color'>> }
 | { type: 'company.archive' | 'company.restore'; id: string }
 | { type: 'department.create'; input: Omit<Department,'id'> }
 | { type: 'department.update'; id: string; input: Partial<Omit<Department,'id'|'companyId'>> }
 | { type: 'agent.create'; companyId: string; input: Pick<Agent,'name'|'role'|'kind'|'instructions'|'responsibilities'|'departmentId'|'managerId'> }
 | { type: 'agent.update'; id: string; input: Partial<Pick<Agent,'name'|'role'|'instructions'|'responsibilities'|'departmentId'|'managerId'>> }
 | { type: 'agent.archive'; id: string }
 | { type: 'agent.restore'; id: string; companyId: string }
 | { type: 'assignment.add' | 'assignment.primary'; agentId: string; companyId: string }
 | { type: 'assignment.end'; id: string }
 | { type: 'relationship.create'; input: Pick<Relationship,'fromCompanyId'|'toCompanyId'|'kind'|'percentage'|'description'> }
 | { type: 'relationship.end'; id: string }
 | { type: 'definition.import'; definition: CompanyDefinition }
 | { type: 'work.record'; input: Omit<WorkRecord,'id'|'createdAt'> }
 | { type: 'work.accept'; id: string };
export interface ChangePreview { id: string; baseRevision: number; summary: string; changes: string[]; createdAt: string }
export interface UndoPreview { changeId: string; baseRevision: number; summary: string; changes: string[] }
export interface DomainErrorShape { code: string; message: string; details?: unknown }
export interface ApplyResult { state: WorkspaceState; changeId: string; replayed: boolean }
export interface TemplateSummary { id: string; name: string; description: string; agentCount: number; departmentCount: number }
export interface WorkspaceStore {
 snapshot(): WorkspaceState;
 preview(commands: DomainCommand[], baseRevision: number, summary?: string): ChangePreview;
 apply(previewId: string): ApplyResult;
 previewUndo(changeId: string, baseRevision: number): UndoPreview;
 undo(changeId: string, baseRevision: number): WorkspaceState;
 exportDefinition(): CompanyDefinition;
 backup(destination: string): Promise<void>;
 close(): void;
}
