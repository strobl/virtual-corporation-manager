import {
  ArrowRight,
  Building2,
  Clock3,
  GitBranch,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { WorkspaceState } from '../domain/contracts';
import type { TimeSnapshot } from '../time/contracts';
import { CorporationOrgChart } from '../components/organization/CorporationOrgChart';
import { companyAgents, toSnapshot } from './model';
import { aggregateTime, formatTenths, timeMonday } from './time-view-model';
import { textExcerpt } from './TextDisclosure';

interface Props {
  mode: 'index' | 'company';
  state: WorkspaceState;
  companyId: string | null;
  time: TimeSnapshot | null;
  timeError: string | null;
  onRefresh: () => void;
  onCreate: () => void;
  onBrowseTemplates: () => void;
  onImport: () => void;
  onOpenCompany: (id: string) => void;
  onEditCompany: () => void;
  onAddAgent: () => void;
  onAddDepartment: () => void;
  onManageOrganization: () => void;
  onOpenAgent: (id: string) => void;
  onLogTime: () => void;
  onViewTime: () => void;
}

export function CorporationWorkspace({
  mode,
  state,
  companyId,
  time,
  timeError,
  ...actions
}: Props) {
  const companies = state.companies.filter((row) => row.status === 'active');
  const company = companies.find((row) => row.id === companyId);
  const ledger = timeError ? null : time;
  const from = ledger ? timeMonday(ledger.today) : '';
  const companyEntries = ledger?.entries.filter((row) => row.companyId === companyId) ?? [];
  const recorded = ledger ? aggregateTime(companyEntries, from, ledger.today) : null;
  const members = companyId ? companyAgents(state, companyId) : [];
  const departments = state.departments.filter((row) => row.companyId === companyId);
  const period = ledger ? `${from} – ${ledger.today}` : 'Current week';
  const timeNotice = timeError ? (
    <div className="corporation-data-error" role="alert">
      <span>Delivery hours could not be loaded. {timeError}</span>
      <button className="text-button" onClick={actions.onRefresh}>
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  ) : null;

  if (!companies.length) {
    return (
      <section className="corporation-empty" aria-labelledby="corporation-empty-title">
        <span className="eyebrow">Virtual Corporation Manager</span>
        <h1 id="corporation-empty-title">Your companies, in one place.</h1>
        <p>Manage your virtual corporations and the agents and people behind them.</p>
        <div className="welcome-actions">
          <button className="button primary large" onClick={actions.onCreate}>
            Create your company <ArrowRight size={17} />
          </button>
          <button className="button" onClick={actions.onBrowseTemplates}>
            <Layers3 size={16} /> Browse templates
          </button>
        </div>
        <p className="corporation-local-note">
          Start with a name. Add your team and its responsibilities when you are ready.
          <br />
          Your companies are saved on this computer.
        </p>
        <button className="text-button" onClick={actions.onImport}>
          Import a company <ArrowRight size={14} />
        </button>
      </section>
    );
  }

  if (mode === 'index' || !company) {
    return (
      <section className="corporations-index" aria-labelledby="corporations-title">
        <div className="corporation-page-heading">
          <div>
            <span className="eyebrow">Virtual Corporation Manager</span>
            <h1 id="corporations-title">Your companies</h1>
            <p>Manage each company, its team and their responsibilities.</p>
            <button className="text-button" onClick={actions.onBrowseTemplates}>
              <Layers3 size={14} /> Browse templates
            </button>
          </div>
          <button className="button primary" onClick={actions.onCreate}>
            <Plus size={16} /> Create company
          </button>
        </div>
        <div className="corporation-list-context">
          <span>
            {companies.length} {companies.length === 1 ? 'company' : 'companies'}
          </span>
          <span>Agents and people, together</span>
        </div>
        <ul className="corporation-list">
          {companies.map((row) => {
            const team = companyAgents(state, row.id);
            const agents = team.filter((member) => member.kind === 'agent').length;
            const people = team.length - agents;
            const teamDescription = `${agents} ${agents === 1 ? 'agent' : 'agents'} · ${people} ${people === 1 ? 'person' : 'people'}`;
            return (
              <li key={row.id}>
                <button
                  className="corporation-list-row company-picker-row"
                  onClick={() => actions.onOpenCompany(row.id)}
                >
                  <span
                    className="corporation-monogram"
                    style={{ borderColor: row.color }}
                    aria-hidden="true"
                  >
                    {row.shortCode.slice(0, 2)}
                  </span>
                  <span className="corporation-row-identity">
                    <strong>{row.name}</strong>
                    <span>
                      {textExcerpt(row.description, 140) ||
                        'Add your company’s purpose and introduce its team.'}
                    </span>
                    <span className="corporation-row-mobile-meta">{teamDescription}</span>
                  </span>
                  <span className="corporation-row-stat" title={teamDescription}>
                    <strong>{team.length}</strong>
                    <span>{team.length === 1 ? 'team member' : 'team members'}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="corporation-index-footer">
          <p>Your companies are saved on this computer.</p>
          <button className="text-button" onClick={actions.onImport}>
            Import a company <ArrowRight size={14} />
          </button>
        </div>
      </section>
    );
  }

  const recent = [...companyEntries]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  return (
    <section className="corporation-overview" aria-labelledby="corporation-title">
      <div className="corporation-switcher">
        <label htmlFor="overview-company">
          <Building2 size={15} /> Corporation
        </label>
        <select
          id="overview-company"
          value={company.id}
          onChange={(event) => actions.onOpenCompany(event.target.value)}
        >
          {companies.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </div>
      <div className="corporation-page-heading">
        <div>
          <span className="eyebrow">Your corporation · {company.shortCode}</span>
          <h1 id="corporation-title">{company.name}</h1>
          <p>
            {company.description ||
              'Give your corporation a clear purpose and organize the team behind it.'}
          </p>
          <button className="text-button" onClick={actions.onEditCompany}>
            <Pencil size={13} /> Edit corporation
          </button>
        </div>
        <button className="button primary" onClick={actions.onLogTime}>
          <Clock3 size={16} /> Log time
        </button>
      </div>
      {timeNotice}
      <div className="corporation-measures" aria-label="Corporation overview">
        <button className="corporation-hours-measure" onClick={actions.onViewTime}>
          <span>Recorded delivery hours</span>
          <strong>{recorded ? `${formatTenths(recorded.tenths)}h` : '—'}</strong>
          <small>
            {period}
            {ledger ? ` · ${ledger.timezone}` : ''}
          </small>
        </button>
        <div>
          <span>Agents</span>
          <strong>{members.filter((row) => row.kind === 'agent').length}</strong>
          <small>
            {members.length} assigned {members.length === 1 ? 'member' : 'members'}
          </small>
        </div>
        <div>
          <span>Departments</span>
          <strong>{departments.length}</strong>
          <small>Teams and responsibilities</small>
        </div>
      </div>
      <div className="corporation-workspace-grid">
        <section className="corporation-structure" aria-labelledby="corporation-structure-title">
          <header className="corporation-section-heading">
            <div>
              <span className="eyebrow">People and agents</span>
              <h2 id="corporation-structure-title">Reporting structure</h2>
            </div>
            <div className="corporation-structure-actions">
              <button className="button" onClick={actions.onAddAgent}>
                <Plus size={14} /> Add agent
              </button>
              <button className="text-button" onClick={actions.onAddDepartment}>
                <Layers3 size={14} /> Add department
              </button>
            </div>
          </header>
          {members.length ? (
            <CorporationOrgChart
              snapshot={toSnapshot(state)}
              corporationId={company.id}
              corporationName={company.name}
              onSelectAgent={(id) => {
                if (id) actions.onOpenAgent(id);
              }}
            />
          ) : (
            <div className="corporation-structure-empty">
              <Users size={28} />
              <h3>Give every agent a place.</h3>
              <p>
                Add the first agent, then define its role, department and reporting relationship.
                Assigned members can record delivery hours.
              </p>
              <button className="button primary" onClick={actions.onAddAgent}>
                <Plus size={15} /> Add your first agent
              </button>
            </div>
          )}
          <footer className="corporation-structure-footer">
            <span>Reporting lines show who manages whom. Company ownership is separate.</span>
            <button className="text-button" onClick={actions.onManageOrganization}>
              <GitBranch size={14} /> Manage organization <ArrowRight size={14} />
            </button>
          </footer>
        </section>
        <section className="corporation-recent-hours" aria-labelledby="recent-hours-title">
          <header className="corporation-section-heading">
            <div>
              <span className="eyebrow">Time Tracker</span>
              <h2 id="recent-hours-title">Recent entries</h2>
            </div>
            <Clock3 size={19} />
          </header>
          {!ledger ? (
            <p className="corporation-side-note">
              {timeError
                ? 'Entries are unavailable until the ledger reconnects.'
                : 'Loading recorded hours…'}
            </p>
          ) : recent.length ? (
            <ul>
              {recent.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{entry.description}</strong>
                    <span>
                      {entry.agentName} · {entry.date}
                    </span>
                  </div>
                  <span className={entry.status === 'void' ? 'is-void' : ''}>
                    {formatTenths(entry.tenths)}h{entry.status === 'void' && <small>Void</small>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="corporation-side-note">
              No delivery hours recorded for this corporation yet. Log an entry when there is work
              to record.
            </p>
          )}
          <button className="text-button" onClick={actions.onViewTime}>
            Open Time Tracker <ArrowRight size={14} />
          </button>
          <p className="corporation-hours-note">
            Delivery hours are recorded effort. Agent runtime never creates a time entry.
          </p>
        </section>
      </div>
    </section>
  );
}
