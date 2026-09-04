import { Bot, ChevronRight, Layers3, Plus, Building2, UsersRound } from 'lucide-react';
import type { WorkspaceState } from '../domain/contracts';
import type { Selection } from './model';
import { companyAgents } from './model';

/** Department composition builds on the original company's progressive disclosure. */
export function CompanyMap({
  state,
  companyId,
  selection,
  onSelect,
  onCreateDepartment,
}: {
  state: WorkspaceState;
  companyId: string;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  onCreateDepartment: () => void;
}) {
  const company = state.companies.find((row) => row.id === companyId);
  if (!company) return null;
  const agents = companyAgents(state, companyId);
  const departments = state.departments.filter((row) => row.companyId === companyId);
  const localDepartments = new Set(departments.map((row) => row.id));
  const companyLevelAgents = agents.filter(
    (agent) => !agent.departmentId || !localDepartments.has(agent.departmentId),
  );
  const groups = [
    ...departments.map((department) => ({
      id: department.id,
      name: department.name,
      description: department.description,
      managerId: department.managerId,
      agents: agents.filter((agent) => agent.departmentId === department.id),
    })),
    ...(companyLevelAgents.length > 0
      ? [
          {
            id: '',
            name: 'Company leadership',
            description: 'Working across the whole company.',
            managerId: null,
            agents: companyLevelAgents,
          },
        ]
      : []),
  ];
  return (
    <div className="company-map" data-testid="company-map">
      <div className="map-label">
        <span className="live-dot" /> Organization · Saved configuration
      </div>
      <button
        className={`company-root ${selection?.kind === 'company' && selection.id === company.id ? 'is-selected' : ''}`}
        onClick={() => onSelect({ kind: 'company', id: company.id })}
      >
        <span className="company-symbol" style={{ backgroundColor: company.color || '#f4dc42' }}>
          <Building2 size={20} />
        </span>
        <span>
          <span className="eyebrow">{company.shortCode}</span>
          <strong>{company.name}</strong>
        </span>
        <ChevronRight size={17} className="muted" />
        <span className="root-purpose">
          {company.description || 'Select to define your company’s purpose.'}
        </span>
        <span className="root-counts">
          <span>
            <Layers3 size={13} />
            {departments.length} departments
          </span>
          <span>
            <Bot size={13} />
            {agents.filter((agent) => agent.kind === 'agent').length} agents
          </span>
        </span>
      </button>
      <div className="map-trunk" aria-hidden="true" />
      <div className="department-grid">
        {groups.map((group) => (
          <section
            className={`department-card ${selection?.kind === 'department' && selection.id === group.id ? 'is-selected' : ''}`}
            key={group.id || 'company-level'}
          >
            <button
              className="department-heading"
              onClick={() =>
                onSelect(
                  group.id
                    ? { kind: 'department', id: group.id }
                    : { kind: 'company', id: companyId },
                )
              }
            >
              <span className="department-icon">
                <Layers3 size={16} />
              </span>
              <span>
                <strong>{group.name}</strong>
                <small>
                  {group.agents.length} {group.agents.length === 1 ? 'member' : 'members'}
                </small>
              </span>
              <ChevronRight size={14} />
            </button>
            <p className="department-purpose">
              {group.description || 'Define this department’s responsibilities.'}
            </p>
            <div className="agent-cluster">
              {group.agents.slice(0, 8).map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => onSelect({ kind: 'agent', id: agent.id })}
                  aria-label={`${agent.name} — ${agent.role}`}
                  title={`${agent.name} · ${agent.role}`}
                  className={`agent-avatar ${selection?.kind === 'agent' && selection.id === agent.id ? 'is-selected' : ''}`}
                >
                  {agent.name
                    .split(/\s+/)
                    .map((word) => word[0])
                    .slice(0, 2)
                    .join('')}
                </button>
              ))}
              {group.agents.length > 8 && (
                <button
                  className="agent-avatar more"
                  onClick={() =>
                    onSelect(
                      group.id
                        ? { kind: 'department', id: group.id }
                        : { kind: 'company', id: companyId },
                    )
                  }
                  aria-label={`View all ${group.agents.length} members`}
                >
                  +{group.agents.length - 8}
                </button>
              )}
              {group.agents.length === 0 && <span className="muted small">No agents yet</span>}
            </div>
            {group.managerId && (
              <div className="department-lead">
                <UsersRound size={12} />
                Led by{' '}
                {state.agents.find((agent) => agent.id === group.managerId)?.name ??
                  'an assigned agent'}
              </div>
            )}
          </section>
        ))}
        <button className="add-department-card" onClick={onCreateDepartment}>
          <Plus size={20} />
          <strong>Add department</strong>
          <span>Give a team a clear purpose</span>
        </button>
      </div>
      <p className="map-footnote">
        Select any team or agent to see its responsibilities. Configured agents start working only
        when you run a task.
      </p>
    </div>
  );
}
