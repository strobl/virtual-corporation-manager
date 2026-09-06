import { useState, type FormEvent } from 'react';
import { ArrowRight, Link2, Upload, X } from 'lucide-react';
import type { CompanyDefinition, DomainCommand, WorkspaceState } from '../domain/contracts';
import { Dialog } from './Dialogs';

export type AdvancedTarget =
  | { kind: 'relationships'; companyId: string }
  | { kind: 'assignments'; agentId: string }
  | { kind: 'import' };
interface Props {
  target: AdvancedTarget;
  state: WorkspaceState;
  busy: boolean;
  error: string | null;
  reviewing?: boolean;
  onClose: () => void;
  onSubmit: (commands: DomainCommand[], summary: string) => Promise<void>;
}

export function AdvancedDialog(props: Props) {
  if (props.target.kind === 'import') return <DefinitionImport {...props} />;
  if (props.target.kind === 'relationships')
    return <Relationships {...props} companyId={props.target.companyId} />;
  return <Assignments {...props} agentId={props.target.agentId} />;
}

function UnavailableTarget({
  kind,
  busy,
  onClose,
}: {
  kind: 'company' | 'member';
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      title={`${kind === 'company' ? 'Company' : 'Member'} no longer available`}
      onClose={onClose}
      closeDisabled={busy}
    >
      <div className="dialog-body">
        <p className="error-box" role="alert">
          The selected {kind} has been removed or archived. Close this draft and select an active{' '}
          {kind} to continue.
        </p>
        <footer className="dialog-actions">
          <button className="button" type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </footer>
      </div>
    </Dialog>
  );
}

function DefinitionImport({ busy, error, reviewing = false, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || reviewing) return;
    setParseError(null);
    try {
      const definition = JSON.parse(text) as CompanyDefinition;
      if (definition === null || typeof definition !== 'object' || Array.isArray(definition))
        throw new Error('Choose a company definition JSON file.');
      await onSubmit(
        [{ type: 'definition.import', definition }],
        `Import company definition: ${definition.name || fileName || 'organization'}`,
      );
    } catch (cause) {
      setParseError(cause instanceof Error ? cause.message : 'The definition is not valid JSON.');
    }
  };
  if (reviewing) return null;
  return (
    <Dialog title="Import a company definition" wide onClose={onClose} closeDisabled={busy}>
      <form className="dialog-body editor-form" onSubmit={submit}>
        <p className="muted">
          Choose an exported company definition. Its companies, departments, agents, and
          relationships are validated locally before you review and apply any changes.
        </p>
        <label>
          Company definition (.json)
          <input
            autoFocus
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setParseError(null);
              if (file.size > 5_000_000) {
                setParseError('The definition must be smaller than 5 MB.');
                return;
              }
              setFileName(file.name);
              setText(await file.text());
            }}
          />
        </label>
        <label>
          Definition JSON
          <textarea
            disabled={busy}
            required
            rows={12}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="You can also paste your exported definition here."
            spellCheck={false}
          />
        </label>
        {(parseError || error) && (
          <p className="error-box" role="alert">
            {parseError || error}
          </p>
        )}
        <footer className="dialog-actions">
          <button className="button" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !text.trim()}>
            <Upload size={14} />
            {busy ? 'Validating…' : 'Review import'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function Relationships({
  companyId,
  state,
  busy,
  error,
  reviewing = false,
  onClose,
  onSubmit,
}: Props & { companyId: string }) {
  const company = state.companies.find((row) => row.id === companyId && row.status === 'active');
  const [targetId, setTargetId] = useState('');
  const [kind, setKind] = useState<'ownership' | 'collaboration'>('collaboration');
  const [percentage, setPercentage] = useState('100');
  const [description, setDescription] = useState('');
  const otherCompanies = state.companies.filter(
    (row) => row.status === 'active' && row.id !== companyId,
  );
  const links = state.relationships.filter(
    (row) => !row.endedAt && (row.fromCompanyId === companyId || row.toCompanyId === companyId),
  );
  const nameOf = (id: string) => state.companies.find((row) => row.id === id)?.name ?? id;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || reviewing || !company) return;
    await onSubmit(
      [
        {
          type: 'relationship.create',
          input: {
            fromCompanyId: companyId,
            toCompanyId: targetId,
            kind,
            percentage: kind === 'ownership' ? Number(percentage) : null,
            description,
          },
        },
      ],
      `Connect ${company.name} to ${nameOf(targetId)} (${kind})`,
    );
  };
  if (reviewing) return null;
  if (!company) return <UnavailableTarget kind="company" busy={busy} onClose={onClose} />;
  return (
    <Dialog
      title={`${company.name} · Company relationships`}
      wide
      onClose={onClose}
      closeDisabled={busy}
    >
      <div className="dialog-body">
        <p className="muted small">
          Ownership describes company structure. Collaboration describes how companies work
          together. These are separate relationships.
        </p>
        <div className="relationship-list">
          {links.map((link) => (
            <article key={link.id}>
              <Link2 size={15} />
              <div>
                <strong>
                  {nameOf(link.fromCompanyId)} → {nameOf(link.toCompanyId)}
                </strong>
                <span>
                  {link.kind}
                  {link.kind === 'ownership' && link.percentage !== null
                    ? ` · ${link.percentage}%`
                    : ''}
                  {link.description ? ` · ${link.description}` : ''}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label={`End ${link.kind} relationship from ${nameOf(link.fromCompanyId)} to ${nameOf(link.toCompanyId)}`}
                disabled={busy}
                onClick={() =>
                  void onSubmit(
                    [{ type: 'relationship.end', id: link.id }],
                    `End ${link.kind} relationship: ${nameOf(link.fromCompanyId)} → ${nameOf(link.toCompanyId)}`,
                  )
                }
              >
                <X size={15} />
              </button>
            </article>
          ))}
          {!links.length && <p className="connection-note">No company relationships yet.</p>}
        </div>
        {otherCompanies.length ? (
          <form className="editor-form" onSubmit={submit}>
            <h3 className="small-heading">Add a relationship</h3>
            <label>
              From
              <input readOnly value={company.name} />
            </label>
            <label>
              To company
              <select
                disabled={busy}
                autoFocus
                required
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="">Choose a company</option>
                {otherCompanies.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Relationship
                <select
                  disabled={busy}
                  value={kind}
                  onChange={(event) => setKind(event.target.value as typeof kind)}
                >
                  <option value="collaboration">Collaboration</option>
                  <option value="ownership">Ownership</option>
                </select>
              </label>
              {kind === 'ownership' && (
                <label>
                  Ownership %
                  <input
                    disabled={busy}
                    type="number"
                    required
                    min={0}
                    max={100}
                    step="0.01"
                    value={percentage}
                    onChange={(event) => setPercentage(event.target.value)}
                  />
                </label>
              )}
            </div>
            <label>
              Purpose
              <textarea
                disabled={busy}
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What connects these companies?"
              />
            </label>
            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            <footer className="dialog-actions">
              <button className="button" type="button" onClick={onClose} disabled={busy}>
                Close
              </button>
              <button className="button primary" disabled={busy}>
                Review relationship
                <ArrowRight size={14} />
              </button>
            </footer>
          </form>
        ) : (
          <p className="connection-note">
            Create another company to add ownership or collaboration relationships.
          </p>
        )}
        {error && !otherCompanies.length && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function Assignments({
  agentId,
  state,
  busy,
  error,
  reviewing = false,
  onClose,
  onSubmit,
}: Props & { agentId: string }) {
  const agent = state.agents.find((row) => row.id === agentId && row.status === 'active');
  const [companyId, setCompanyId] = useState('');
  const assignments = state.assignments.filter((row) => row.agentId === agentId && !row.endedAt);
  const options = state.companies.filter(
    (row) =>
      row.status === 'active' && !assignments.some((assignment) => assignment.companyId === row.id),
  );
  const nameOf = (id: string) => state.companies.find((row) => row.id === id)?.name ?? id;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || reviewing || !agent) return;
    await onSubmit(
      [{ type: 'assignment.add', agentId, companyId }],
      `Assign ${agent.name} to ${nameOf(companyId)}`,
    );
  };
  if (reviewing) return null;
  if (!agent) return <UnavailableTarget kind="member" busy={busy} onClose={onClose} />;
  return (
    <Dialog
      title={`${agent.name} · Company assignments`}
      wide
      onClose={onClose}
      closeDisabled={busy}
    >
      <div className="dialog-body">
        <p className="muted small">
          A member has one primary company and can support other companies. Changing an assignment
          is reviewed before it is saved.
        </p>
        <div className="assignment-list">
          {assignments.map((row) => (
            <article key={row.id}>
              <div>
                <strong>{nameOf(row.companyId)}</strong>
                <span>{row.isPrimary ? 'Primary company' : 'Additional assignment'}</span>
              </div>
              {!row.isPrimary && (
                <>
                  <button
                    className="button small-button"
                    disabled={busy}
                    onClick={() =>
                      void onSubmit(
                        [
                          {
                            type: 'assignment.primary',
                            agentId,
                            companyId: row.companyId,
                          },
                        ],
                        `Make ${nameOf(row.companyId)} the primary company for ${agent.name}`,
                      )
                    }
                  >
                    Make primary
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`End assignment to ${nameOf(row.companyId)}`}
                    disabled={busy}
                    onClick={() =>
                      void onSubmit(
                        [{ type: 'assignment.end', id: row.id }],
                        `End ${agent.name} assignment to ${nameOf(row.companyId)}`,
                      )
                    }
                  >
                    <X size={15} />
                  </button>
                </>
              )}
            </article>
          ))}
        </div>
        {options.length > 0 && (
          <form className="editor-form" onSubmit={submit}>
            <label>
              Add company assignment
              <select
                disabled={busy}
                required
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
              >
                <option value="">Choose a company</option>
                {options.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <footer className="dialog-actions">
              <button className="button" type="button" onClick={onClose} disabled={busy}>
                Close
              </button>
              <button className="button primary" disabled={busy}>
                Review assignment
                <ArrowRight size={14} />
              </button>
            </footer>
          </form>
        )}
        {!options.length && (
          <p className="connection-note">
            This member is assigned to every active company. Create another company to add an
            assignment.
          </p>
        )}
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
