import { Bot, ChevronRight, Layers3, Plus, Building2, UsersRound } from 'lucide-react';
import type { WorkspaceState } from '../domain/contracts';
import type { Selection } from './model';
import { companyAgents } from './model';
import { textExcerpt } from './TextDisclosure';
import { BrandMark } from './BrandMark';

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
      <div className="map-context">
        <h2>
          <BrandMark size={16} decorative /> Departments & responsibilities
        </h2>
        <button
          className="text-button"
          onClick={() => onSelect({ kind: 'company', id: company.id })}
        >
          Company details <ChevronRight size={14} />
        </button>
      </div>
      {state.relationships.some(
        (row) => !row.endedAt && (row.fromCompanyId === companyId || row.toCompanyId === companyId),
      ) && (
        <div className="map-relationships" aria-label="Company relationships">
          {state.relationships
            .filter(
              (row) =>
                !row.endedAt && (row.fromCompanyId === companyId || row.toCompanyId === companyId),
            )
            .map((row) => {
              const otherId = row.fromCompanyId === companyId ? row.toCompanyId : row.fromCompanyId;
              return (
                <span key={row.id}>
                  {row.kind === 'ownership'
                    ? row.fromCompanyId === companyId
                      ? 'Owns'
                      : 'Owned by'
                    : 'Collaborates with'}{' '}
                  {state.companies.find((company) => company.id === otherId)?.name ?? otherId}
                  {row.percentage !== null ? ` · ${row.percentage}%` : ''}
                </span>
              );
            })}
        </div>
      )}
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
              {textExcerpt(group.description, 180) || 'Define this department’s responsibilities.'}
            </p>
            {group.managerId && (
              <div className="department-lead">
                <UsersRound size={12} />
                Lead:{' '}
                <button
                  className="text-button"
                  onClick={() => onSelect({ kind: 'agent', id: group.managerId!, companyId })}
                >
                  {state.agents.find((agent) => agent.id === group.managerId)?.name ??
                    'Assigned agent'}
                </button>
              </div>
            )}
            <div className="agent-cluster">
              {group.agents.slice(0, 8).map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => onSelect({ kind: 'agent', id: agent.id })}
                  aria-label={`${agent.name} — ${agent.role}`}
                  title={`${agent.name} · ${agent.role}`}
                  className={`agent-avatar ${selection?.kind === 'agent' && selection.id === agent.id ? 'is-selected' : ''}`}
                >
                  <span
                    className="agent-monogram"
                    data-tone={
                      [...agent.id].reduce((total, letter) => total + letter.charCodeAt(0), 0) % 4
                    }
                    aria-hidden="true"
                  >
                    {agent.name
                      .split(/\s+/)
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span className="agent-avatar-caption">
                    <strong>{agent.name}</strong>
                    <small>{agent.role}</small>
                  </span>
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
