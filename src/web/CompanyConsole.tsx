import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  GitBranch,
  List,
  Pencil,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import type { WorkspaceState } from '../domain/contracts';
import type { TimeSnapshot } from '../time/contracts';
import type { IntegrationStatus, RunInfo } from './Work';
import { agentInitials, roleLabel } from './model';
import { formatTenths } from './time-view-model';
import { textExcerpt } from './TextDisclosure';
import {
  consoleDepartmentLabel,
  consoleRuntime,
  createCompanyConsoleModel,
  filterConsoleMembers,
  type ConsoleRelationship,
} from './company-console-model';
import './company-console.css';

export interface CompanyConsoleProps {
  state: WorkspaceState;
  companyId: string;
  selectedMemberId: string | null;
  time: TimeSnapshot | null;
  timeError: string | null;
  runs: RunInfo[];
  status: IntegrationStatus | null;
  onSelectMember: (id: string | null) => void;
  onEditCompany: () => void;
  onAddMember: () => void;
  onEditMember: (id: string) => void;
  onManageAssignments: (id: string) => void;
  onAddDepartment: () => void;
  onEditDepartment: (id: string) => void;
  onRelationships: () => void;
  onOpenCompany: (id: string) => void;
  onRunAgent: (id: string) => void;
  onLogTime: (id?: string) => void;
  onViewTime: () => void;
  onRecordWork: (id: string) => void;
  onOpenWork: () => void;
  onIntegrations: () => void;
}

export function CompanyConsole({
  state,
  companyId,
  selectedMemberId,
  time,
  timeError,
  runs,
  status,
  ...actions
}: CompanyConsoleProps) {
  const view = createCompanyConsoleModel(state, companyId, selectedMemberId, time, timeError, runs);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'agent' | 'human'>('all');
  const [layout, setLayout] = useState<'members' | 'reporting'>('members');
  const inspector = useRef<HTMLElement>(null);
  const memberButtons = useRef(new Map<string, HTMLButtonElement>());
  const previousSelection = useRef<{ companyId: string; id: string | null }>({
    companyId,
    id: null,
  });
  useEffect(() => {
    setQuery('');
    setKind('all');
    setLayout('members');
  }, [companyId]);
  useEffect(() => {
    if (selectedMemberId && inspector.current) {
      inspector.current.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 960px)').matches)
        inspector.current.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
          block: 'start',
        });
    } else if (previousSelection.current.companyId === companyId && previousSelection.current.id) {
      memberButtons.current.get(previousSelection.current.id)?.focus({ preventScroll: true });
    }
    previousSelection.current = { companyId, id: selectedMemberId };
  }, [selectedMemberId, companyId]);
  if (!view.company)
    return (
      <section className="company-console">
        <p>This company is no longer active.</p>
      </section>
    );
  const company = view.company;
  const visible = filterConsoleMembers(view.members, query, kind);
  const visibleIds = new Set(visible.map((member) => member.id));
  const member = view.selected;
  const runtime = consoleRuntime(status);
  const managerLabel = (id: string | null) => {
    const manager = state.agents.find((row) => row.id === id);
    if (!manager) return id ? 'Former member' : 'Not assigned';
    return `${manager.name}${manager.status === 'archived' ? ' (archived)' : ''}`;
  };
  const relationshipSection = (
    title: string,
    relationships: ConsoleRelationship[],
    ownership: boolean,
  ) =>
    relationships.length > 0 && (
      <div className="console-relationship-group">
        <h3>{title}</h3>
        <ul>
          {relationships.map(({ relationship, company: related, percentage }) => (
            <li key={relationship.id}>
              <button
                className="console-related-company"
                onClick={() => actions.onOpenCompany(related.id)}
              >
                <span
                  className="console-company-dot"
                  style={{ backgroundColor: related.color }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{related.name}</strong>
                  {ownership && <small>{percentage}</small>}
                </span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
              {relationship.description && <p>{textExcerpt(relationship.description, 140)}</p>}
              {relationship.description !== textExcerpt(relationship.description, 140) && (
                <details className="console-relationship-note">
                  <summary>Read full note</summary>
                  <p className="console-full-text">{relationship.description}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  const relationshipCount = Object.values(view.relationships).reduce(
    (count, rows) => count + rows.length,
    0,
  );
  const ownedCompanyCount = new Set(view.relationships.owns.map((row) => row.company.id)).size;
  return (
    <section className="company-console" aria-labelledby="console-company-name">
      <header className="console-heading">
        <div className="console-company-identity">
          <span
            className="console-company-mark"
            style={{ borderColor: company.color }}
            aria-hidden="true"
          >
            {company.shortCode.slice(0, 3)}
          </span>
          <div>
            <span className="console-overline">Your corporation</span>
            <h1 id="console-company-name">{company.name}</h1>
          </div>
        </div>
        <button className="button primary console-add-member" onClick={actions.onAddMember}>
          <Plus size={16} /> Add member
        </button>
      </header>
      <div className="console-purpose">
        <p>
          {textExcerpt(company.description, 240) ||
            'Give this corporation a purpose, then build the team around it.'}
        </p>
        {company.description !== textExcerpt(company.description, 240) && (
          <details>
            <summary>Read full purpose</summary>
            <p className="console-full-text">{company.description}</p>
          </details>
        )}
        <button className="text-button" onClick={actions.onEditCompany}>
          <Pencil size={12} /> Edit company
        </button>
      </div>
      <div className="console-company-context">
        <div className="console-company-summary" aria-label="Company composition">
          <span>
            <strong>{view.counts.agents}</strong> {view.counts.agents === 1 ? 'agent' : 'agents'}
          </span>
          <span>
            <strong>{view.counts.humans}</strong> {view.counts.humans === 1 ? 'human' : 'humans'}
          </span>
          <span>
            <strong>{view.counts.departments}</strong>{' '}
            {view.counts.departments === 1 ? 'department' : 'departments'}
          </span>
        </div>
        {(view.relationships.ownedBy.length > 0 || ownedCompanyCount > 0) && (
          <div className="console-ownership-context" aria-label="Company ownership at a glance">
            {view.relationships.ownedBy.map(({ relationship, company: owner, percentage }) => (
              <span key={relationship.id}>
                Owned by{' '}
                <button className="text-button" onClick={() => actions.onOpenCompany(owner.id)}>
                  {owner.name}
                </button>{' '}
                · {percentage}
              </span>
            ))}
            {ownedCompanyCount > 0 && (
              <button className="text-button" onClick={actions.onRelationships}>
                Owns {ownedCompanyCount} {ownedCompanyCount === 1 ? 'company' : 'companies'}
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={`console-body${member ? ' has-member' : ''}`}>
        <div className="console-main">
          <section className="console-members" aria-label="Company members">
            <div className="console-section-heading">
              <div className="console-view-toggle" aria-label="Member view">
                <button
                  className={layout === 'members' ? 'selected' : ''}
                  aria-pressed={layout === 'members'}
                  onClick={() => setLayout('members')}
                >
                  <List size={15} /> Members
                </button>
                <button
                  className={layout === 'reporting' ? 'selected' : ''}
                  aria-pressed={layout === 'reporting'}
                  onClick={() => setLayout('reporting')}
                >
                  <GitBranch size={15} /> Reporting lines
                </button>
              </div>
            </div>
            {view.members.length > 0 ? (
              <>
                <div className="console-member-controls">
                  <label className="console-search">
                    <Search size={15} aria-hidden="true" />
                    <input
                      type="search"
                      aria-label="Search members"
                      placeholder="Search names, roles, responsibilities…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  {view.counts.agents > 0 && view.counts.humans > 0 && (
                    <select
                      aria-label="Member type"
                      value={kind}
                      onChange={(event) => setKind(event.target.value as typeof kind)}
                    >
                      <option value="all">Everyone</option>
                      <option value="agent">Agents</option>
                      <option value="human">Humans</option>
                    </select>
                  )}
                </div>
                {!visible.length ? (
                  <p className="console-no-results">
                    No members match.{' '}
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery('');
                        setKind('all');
                      }}
                    >
                      Clear filters
                    </button>
                  </p>
                ) : layout === 'members' ? (
                  <div className="console-table-wrap">
                    <table className="console-member-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Role</th>
                          <th>Department</th>
                          <th>Reports to</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((row) => (
                          <tr
                            key={row.id}
                            className={row.id === member?.id ? 'selected' : ''}
                            onClick={() => actions.onSelectMember(row.id)}
                          >
                            <td>
                              <button
                                ref={(node) => {
                                  if (node) memberButtons.current.set(row.id, node);
                                  else memberButtons.current.delete(row.id);
                                }}
                                className="console-member-name"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  actions.onSelectMember(row.id);
                                }}
                                aria-pressed={row.id === member?.id}
                                aria-label={`View ${row.name}, ${roleLabel(row.role)}, ${row.kind}`}
                              >
                                <span className={`console-avatar ${row.kind}`} aria-hidden="true">
                                  {agentInitials(row.name)}
                                </span>
                                <span>
                                  <strong>{row.name}</strong>
                                  <small>{row.kind === 'agent' ? 'Agent' : 'Human'}</small>
                                </span>
                              </button>
                            </td>
                            <td>
                              <span className="console-mobile-label">Role</span>
                              {roleLabel(row.role) || 'Not set'}
                            </td>
                            <td>
                              <span className="console-mobile-label">Department</span>
                              {consoleDepartmentLabel(state, row, companyId)}
                            </td>
                            <td>
                              <span className="console-mobile-label">Reports to</span>
                              {managerLabel(row.managerId)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="console-reporting-list" aria-label="Reporting hierarchy">
                    <p>
                      Reporting lines within {company.name}.{' '}
                      {query || kind !== 'all'
                        ? 'Filters can hide other members of a reporting line.'
                        : 'Select a member to see their responsibilities.'}
                    </p>
                    <ul>
                      {view.reportingRows
                        .filter(({ person }) => visibleIds.has(person.id))
                        .map(({ person, depth }) => (
                          <li
                            key={person.id}
                            style={{ paddingLeft: `${Math.min(depth, 8) * 20}px` }}
                          >
                            <button
                              ref={(node) => {
                                if (node) memberButtons.current.set(person.id, node);
                                else memberButtons.current.delete(person.id);
                              }}
                              className={`console-reporting-member${member?.id === person.id ? ' selected' : ''}`}
                              aria-pressed={member?.id === person.id}
                              onClick={() => actions.onSelectMember(person.id)}
                            >
                              {depth > 0 && (
                                <span className="console-branch" aria-hidden="true">
                                  └
                                </span>
                              )}
                              <span className={`console-avatar ${person.kind}`} aria-hidden="true">
                                {agentInitials(person.name)}
                              </span>
                              <span>
                                <strong>{person.name}</strong>
                                <small>
                                  {person.role || 'Role not set'} ·{' '}
                                  {person.kind === 'agent' ? 'Agent' : 'Human'} · Level {depth}
                                </small>
                              </span>
                              <ChevronRight size={14} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="console-empty-team">
                <Users size={26} aria-hidden="true" />
                <h2>A company starts with its people.</h2>
                <p>
                  Add an agent or a human. Give them a role and responsibilities; organize
                  departments whenever you need them.
                </p>
                <button className="button" onClick={actions.onAddMember}>
                  <Plus size={15} /> Add your first member
                </button>
              </div>
            )}
          </section>

          <div className="console-company-details">
            <section className="console-departments" aria-labelledby="console-departments-title">
              <div className="console-section-heading">
                <h2 id="console-departments-title">Departments</h2>
                <button className="text-button" onClick={actions.onAddDepartment}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {view.departments.length ? (
                <ul>
                  {view.departments.map((department) => {
                    const memberCount = view.members.filter(
                      (row) => row.departmentId === department.id,
                    ).length;
                    return (
                      <li key={department.id}>
                        <button onClick={() => actions.onEditDepartment(department.id)}>
                          <span>
                            <strong>{department.name}</strong>
                            <small>
                              {memberCount} {memberCount === 1 ? 'member' : 'members'}
                              {department.managerId
                                ? ` · Led by ${managerLabel(department.managerId)}`
                                : ''}
                            </small>
                          </span>
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>Optional. Keep a small team at company level, or group members by function.</p>
              )}
            </section>
            <section
              className="console-relationships"
              aria-labelledby="console-relationships-title"
            >
              <div className="console-section-heading">
                <h2 id="console-relationships-title">Company relationships</h2>
                <button className="text-button" onClick={actions.onRelationships}>
                  Manage <ArrowRight size={13} />
                </button>
              </div>
              {relationshipCount ? (
                <>
                  {relationshipSection('Owned by', view.relationships.ownedBy, true)}
                  {relationshipSection('Owns', view.relationships.owns, true)}
                  {relationshipSection('Collaborates with', view.relationships.collaborates, false)}
                </>
              ) : (
                <p>
                  No company relationships recorded. Connect this corporation to another company
                  through ownership or collaboration.
                </p>
              )}
            </section>
          </div>
          <footer className="console-recorded-work">
            <div>
              <Clock3 size={15} aria-hidden="true" />
              {timeError ? (
                <span role="alert">Recorded hours unavailable. {timeError}</span>
              ) : view.hours ? (
                <span>
                  <button className="text-button" onClick={actions.onViewTime}>
                    <strong>{formatTenths(view.hours.tenths)}h</strong> recorded this week{' '}
                    <ArrowRight size={12} />
                  </button>
                  <small>
                    {view.from} – {view.through} · Booked delivery hours
                  </small>
                </span>
              ) : (
                <span>Loading recorded hours…</span>
              )}
            </div>
            <div>
              <button className="text-button" onClick={actions.onViewTime}>
                Time Tracker
              </button>
              <button className="text-button" onClick={() => actions.onLogTime()}>
                Log time
              </button>
              <button className="text-button" onClick={actions.onOpenWork}>
                Work records <ArrowRight size={13} />
              </button>
            </div>
          </footer>
        </div>

        {member && (
          <aside
            ref={inspector}
            tabIndex={-1}
            className="console-inspector"
            aria-label={`${member.name} member details`}
          >
            <div className="console-inspector-top">
              <span>
                {member.kind === 'agent' ? 'Agent' : 'Human'} · {company.name}
              </span>
              <button
                className="console-icon-button"
                aria-label="Close member details"
                onClick={() => actions.onSelectMember(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="console-inspector-identity">
              <span className={`console-avatar large ${member.kind}`} aria-hidden="true">
                {agentInitials(member.name)}
              </span>
              <div>
                <h2>{member.name}</h2>
                <p>{roleLabel(member.role) || 'Role not set'}</p>
              </div>
            </div>
            <button
              className="button console-edit-member"
              onClick={() => actions.onEditMember(member.id)}
            >
              <Pencil size={14} /> Edit member
            </button>
            <dl className="console-member-facts">
              <div>
                <dt>Department</dt>
                <dd>{consoleDepartmentLabel(state, member, companyId)}</dd>
              </div>
              <div>
                <dt>Reports to</dt>
                <dd>
                  {view.localManager ? (
                    <button
                      className="text-button"
                      onClick={() => actions.onSelectMember(view.localManager!.id)}
                    >
                      {view.localManager.name} <ArrowRight size={12} />
                    </button>
                  ) : (
                    <>
                      {managerLabel(member.managerId)}
                      {view.manager && <small>Outside this company’s current team</small>}
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <section className="console-member-section">
              <h3>Responsibilities</h3>
              {member.responsibilities.length ? (
                <ul>
                  {member.responsibilities.map((responsibility, index) => (
                    <li key={index}>{responsibility}</li>
                  ))}
                </ul>
              ) : (
                <p>No responsibilities defined yet.</p>
              )}
            </section>
            {member.instructions && (
              <details className="console-instructions">
                <summary>
                  {member.kind === 'agent' ? 'Agent instructions' : 'Member instructions'}
                </summary>
                <p className="console-full-text">{member.instructions}</p>
              </details>
            )}
            <section className="console-member-section">
              <div className="console-section-heading">
                <h3>Company assignments</h3>
                <button
                  className="text-button"
                  onClick={() => actions.onManageAssignments(member.id)}
                >
                  Manage
                </button>
              </div>
              <ul className="console-assignments">
                {view.assignments.map(({ assignment, company: assigned }) => (
                  <li key={assignment.id}>
                    {assigned.id === companyId ? (
                      <strong>{assigned.name}</strong>
                    ) : (
                      <button
                        className="text-button"
                        onClick={() => actions.onOpenCompany(assigned.id)}
                      >
                        {assigned.name} <ArrowRight size={12} />
                      </button>
                    )}
                    <small>{assignment.isPrimary ? 'Primary company' : 'Shared membership'}</small>
                  </li>
                ))}
              </ul>
            </section>
            <section className="console-member-section console-member-actions">
              <h3>Work with {member.name}</h3>
              {member.kind === 'agent' ? (
                <>
                  <p className="console-runtime-state">{view.activity}</p>
                  {view.taskCompany?.id === companyId ? (
                    <>
                      <button
                        className="button"
                        disabled={!runtime.ready}
                        onClick={() => actions.onRunAgent(member.id)}
                      >
                        Give a task <ArrowRight size={14} />
                      </button>
                      <p className="console-runtime-note">
                        {runtime.label}. Tasks return text for review.
                      </p>
                      {!runtime.ready && (
                        <button className="text-button" onClick={actions.onIntegrations}>
                          Connect a runtime <ArrowRight size={12} />
                        </button>
                      )}
                    </>
                  ) : (
                    <p>
                      Tasks for this member run in{' '}
                      {view.taskCompany ? (
                        <button
                          className="text-button"
                          onClick={() => actions.onOpenCompany(view.taskCompany!.id)}
                        >
                          {view.taskCompany.name} <ArrowRight size={12} />
                        </button>
                      ) : (
                        'their primary company, once assigned'
                      )}
                      .
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>Keep this person’s contribution with the company.</p>
                  <button className="button" onClick={() => actions.onRecordWork(member.id)}>
                    Record work <ArrowRight size={14} />
                  </button>
                </>
              )}
              <button className="text-button" onClick={() => actions.onLogTime(member.id)}>
                <Clock3 size={13} /> Log time
              </button>
            </section>
          </aside>
        )}
      </div>
    </section>
  );
}
