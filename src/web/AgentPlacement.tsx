import type { Agent, WorkspaceState } from '../domain/contracts';
import {
  agentCompanyIds,
  agentContextOptions,
  agentDepartmentLabel,
  companyContextLabel,
} from './agent-context';

export function AgentPlacement({
  state,
  agent,
  companyId,
  onAssignments,
}: {
  state: WorkspaceState;
  agent: Agent;
  companyId: string | null;
  onAssignments: () => void;
}) {
  const assignments = agentCompanyIds(state, agent.id);
  const selectedCompanyId = companyId ?? assignments[0] ?? null;
  const manager = state.agents.find((row) => row.id === agent.managerId);
  const managerOption = manager
    ? agentContextOptions(state, state.agents).find((row) => row.id === manager.id)
    : null;
  const externalManager =
    manager && selectedCompanyId && !agentCompanyIds(state, manager.id).includes(selectedCompanyId);
  return (
    <section className="inspector-section agent-placement" aria-label="Agent placement">
      <div className="section-title">
        <h3>Organization</h3>
        <button className="text-button" onClick={onAssignments}>
          Assignments
        </button>
      </div>
      <dl className="details-list">
        <dt>Company</dt>
        <dd>
          {selectedCompanyId
            ? companyContextLabel(state, selectedCompanyId)
            : 'No current assignment'}
        </dd>
        <dt>Department</dt>
        <dd>{agentDepartmentLabel(state, agent)}</dd>
        <dt>Reports to</dt>
        <dd>
          {managerOption?.label ?? 'No manager'}
          {externalManager && <p className="small muted">Reports outside this corporation.</p>}
        </dd>
        {assignments.length > 1 && (
          <>
            <dt>Also assigned to</dt>
            <dd>
              {assignments
                .filter((id) => id !== selectedCompanyId)
                .map((id) => companyContextLabel(state, id))
                .join(' / ')}
            </dd>
          </>
        )}
        <dt>Type</dt>
        <dd>{agent.kind === 'agent' ? 'AI agent' : 'Human'}</dd>
      </dl>
    </section>
  );
}
