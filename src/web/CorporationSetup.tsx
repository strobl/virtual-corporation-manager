import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import type { CompanyDefinition } from '../domain/contracts';
import { Dialog } from './Dialogs';
import {
  addSetupAgent,
  addSetupDepartment,
  addStarterStructure,
  buildCorporationDefinition,
  canReportTo,
  corporationDraftErrors,
  createCorporationDraft,
  removeSetupAgent,
  removeSetupDepartment,
  suggestCorporationCode,
  type SetupAgent,
  type SetupDepartment,
} from './corporation-setup';

export interface CorporationSetupProps {
  onReview: (definition: CompanyDefinition) => void | Promise<void>;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
  reviewing?: boolean;
}

const steps = ['Identity', 'Structure', 'Review'];

export function CorporationSetup({
  onReview,
  onClose,
  busy = false,
  error,
  reviewing = false,
}: CorporationSetupProps) {
  const [draft, setDraft] = useState(createCorporationDraft);
  const [step, setStep] = useState(0);
  const [codeEdited, setCodeEdited] = useState(false);
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const priorStep = useRef(0);
  const working = busy || submitting;
  useEffect(() => {
    if (step !== priorStep.current) heading.current?.focus();
    priorStep.current = step;
  }, [step]);
  useEffect(() => {
    if (localErrors.length || error) errorBox.current?.focus();
  }, [localErrors, error]);
  const close = () => {
    if (!working) onClose();
  };
  const move = (next: number) => {
    setLocalErrors([]);
    setStep(next);
  };
  const departmentName = (id: string | null) =>
    draft.departments.find((row) => row.id === id)?.name || 'Corporation level';
  const agentName = (id: string | null) =>
    draft.agents.find((row) => row.id === id)?.name || 'None';
  const updateDepartment = (id: string, change: Partial<SetupDepartment>) =>
    setDraft((current) => ({
      ...current,
      departments: current.departments.map((row) => (row.id === id ? { ...row, ...change } : row)),
    }));
  const updateAgent = (id: string, change: Partial<SetupAgent>) =>
    setDraft((current) => ({
      ...current,
      agents: current.agents.map((row) => (row.id === id ? { ...row, ...change } : row)),
    }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    const issues = corporationDraftErrors(draft, step === 0);
    setLocalErrors(issues);
    if (issues.length) return;
    if (step < 2) {
      move(step + 1);
      return;
    }
    setSubmitting(true);
    try {
      await onReview(buildCorporationDefinition(draft, new Date().toISOString()));
    } catch (failure) {
      setLocalErrors([
        failure instanceof Error ? failure.message : 'Could not prepare the review. Try again.',
      ]);
    } finally {
      setSubmitting(false);
    }
  }
  // The parent may show the authoritative preview in a separate native dialog.
  // Keep this component's draft while unmounting its own modal and focus trap.
  if (reviewing) return null;
  return (
    <Dialog title="Create corporation" wide onClose={close}>
      <form
        className="dialog-body editor-form corporation-setup"
        onSubmit={(event) => void submit(event)}
      >
        <ol className="setup-progress" aria-label="Corporation setup progress">
          {steps.map((label, index) => (
            <li key={label} aria-current={step === index ? 'step' : undefined}>
              <span aria-hidden="true">{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <fieldset
          className="setup-fields"
          disabled={working}
          aria-labelledby={
            ['setup-identity-title', 'setup-structure-title', 'setup-review-title'][step]
          }
        >
          {step === 0 && (
            <section className="setup-section" aria-labelledby="setup-identity-title">
              <h3 id="setup-identity-title" tabIndex={-1} ref={heading}>
                Give your corporation an identity
              </h3>
              <p className="muted">Choose a name and describe what this team is here to do.</p>
              <label>
                Corporation name
                <input
                  required
                  maxLength={120}
                  value={draft.name}
                  placeholder="Northstar Studio"
                  onChange={(event) => {
                    const name = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      name,
                      shortCode: codeEdited ? current.shortCode : suggestCorporationCode(name),
                    }));
                  }}
                />
              </label>
              <div className="form-row">
                <label>
                  Short code
                  <input
                    required
                    minLength={1}
                    maxLength={24}
                    pattern="[A-Za-z0-9]([A-Za-z0-9_]|-){0,23}"
                    value={draft.shortCode}
                    placeholder="NORTHSTAR"
                    aria-describedby="setup-code-hint"
                    onChange={(event) => {
                      setCodeEdited(true);
                      setDraft({ ...draft, shortCode: event.target.value.toUpperCase() });
                    }}
                  />
                  <small id="setup-code-hint" className="muted">
                    1–24 letters, numbers, underscores or hyphens.
                  </small>
                </label>
                <label>
                  Corporation color
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Purpose <span className="muted">Optional</span>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={draft.purpose}
                  placeholder="What will your corporation work on, and for whom?"
                  onChange={(event) => setDraft({ ...draft, purpose: event.target.value })}
                />
              </label>
            </section>
          )}
          {step === 1 && (
            <section className="setup-section" aria-labelledby="setup-structure-title">
              <h3 id="setup-structure-title" tabIndex={-1} ref={heading}>
                Shape your team
              </h3>
              <p className="muted">
                Add departments and agents, or continue with an empty corporation. You can change
                the structure later.
              </p>
              {!draft.departments.length && !draft.agents.length && (
                <div className="setup-choice">
                  <div>
                    <strong>Start with a small team</strong>
                    <p>
                      Two departments and three editable roles: Coordinator, Researcher and
                      Specialist.
                    </p>
                  </div>
                  <button
                    className="button"
                    type="button"
                    onClick={() => setDraft(addStarterStructure)}
                  >
                    Use small team
                  </button>
                </div>
              )}
              <div className="setup-card-header">
                <h4>
                  Departments <span className="muted">{draft.departments.length}</span>
                </h4>
                <button
                  className="button"
                  type="button"
                  onClick={() => setDraft(addSetupDepartment)}
                >
                  <Plus size={15} />
                  Add department
                </button>
              </div>
              {!draft.departments.length && (
                <p className="setup-empty muted">
                  Agents can also belong directly to the corporation.
                </p>
              )}
              {draft.departments.map((department, index) => (
                <div className="setup-department" key={department.id}>
                  <div className="setup-card-header">
                    <strong>Department {index + 1}</strong>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Remove ${department.name || `department ${index + 1}`}`}
                      onClick={() =>
                        setDraft((current) => removeSetupDepartment(current, department.id))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="form-row">
                    <label>
                      Department name
                      <input
                        required
                        maxLength={120}
                        value={department.name}
                        placeholder="Operations"
                        onChange={(event) =>
                          updateDepartment(department.id, { name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Department lead
                      <select
                        value={department.leadId ?? ''}
                        onChange={(event) =>
                          updateDepartment(department.id, { leadId: event.target.value || null })
                        }
                      >
                        <option value="">No lead yet</option>
                        {draft.agents.map((agent, agentIndex) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name || `Agent ${agentIndex + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Department purpose <span className="muted">Optional</span>
                    <textarea
                      rows={2}
                      maxLength={5000}
                      value={department.purpose}
                      onChange={(event) =>
                        updateDepartment(department.id, { purpose: event.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
              <div className="setup-card-header">
                <h4>
                  Agents <span className="muted">{draft.agents.length}</span>
                </h4>
                <button className="button" type="button" onClick={() => setDraft(addSetupAgent)}>
                  <Plus size={15} />
                  Add agent
                </button>
              </div>
              {!draft.agents.length && (
                <p className="setup-empty muted">
                  Your corporation can start empty. Add an agent whenever you are ready.
                </p>
              )}
              {draft.agents.map((agent, index) => (
                <div className="setup-agent" key={agent.id}>
                  <div className="setup-card-header">
                    <strong>Agent {index + 1}</strong>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Remove ${agent.name || `agent ${index + 1}`}`}
                      onClick={() => setDraft((current) => removeSetupAgent(current, agent.id))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="form-row">
                    <label>
                      Agent name
                      <input
                        required
                        maxLength={120}
                        value={agent.name}
                        placeholder="Researcher"
                        onChange={(event) => updateAgent(agent.id, { name: event.target.value })}
                      />
                    </label>
                    <label>
                      Role
                      <input
                        required
                        maxLength={120}
                        value={agent.role}
                        placeholder="Research analyst"
                        onChange={(event) => updateAgent(agent.id, { role: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Department
                      <select
                        value={agent.departmentId ?? ''}
                        onChange={(event) =>
                          updateAgent(agent.id, { departmentId: event.target.value || null })
                        }
                      >
                        <option value="">Corporation level</option>
                        {draft.departments.map((department, departmentIndex) => (
                          <option key={department.id} value={department.id}>
                            {department.name || `Department ${departmentIndex + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Reports to
                      <select
                        value={agent.reportsToId ?? ''}
                        onChange={(event) =>
                          updateAgent(agent.id, { reportsToId: event.target.value || null })
                        }
                      >
                        <option value="">No manager</option>
                        {draft.agents
                          .filter((manager) => canReportTo(draft, agent.id, manager.id))
                          .map((manager) => (
                            <option key={manager.id} value={manager.id}>
                              {manager.name || 'Unnamed agent'}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <details>
                    <summary>Responsibilities and instructions</summary>
                    <label>
                      Responsibilities <span className="muted">One per line</span>
                      <textarea
                        rows={3}
                        value={agent.responsibilities}
                        onChange={(event) =>
                          updateAgent(agent.id, { responsibilities: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Instructions <span className="muted">Optional</span>
                      <textarea
                        rows={3}
                        maxLength={20000}
                        value={agent.instructions}
                        onChange={(event) =>
                          updateAgent(agent.id, { instructions: event.target.value })
                        }
                      />
                    </label>
                  </details>
                </div>
              ))}
              <p className="muted">
                Creating this structure saves your team configuration. It does not start work or
                book delivery hours.
              </p>
            </section>
          )}
          {step === 2 && (
            <section className="setup-section setup-review" aria-labelledby="setup-review-title">
              <h3 id="setup-review-title" tabIndex={-1} ref={heading}>
                Review your corporation
              </h3>
              <div className="setup-card-header">
                <div>
                  <strong>{draft.name.trim()}</strong>
                  <p className="muted">
                    {draft.shortCode.trim().toUpperCase()} · {draft.departments.length} departments
                    · {draft.agents.length} agents
                  </p>
                </div>
                <button type="button" className="button" onClick={() => move(0)}>
                  Edit identity
                </button>
              </div>
              {draft.purpose.trim() && <p>{draft.purpose.trim()}</p>}
              <div className="setup-card-header">
                <h4>Structure and reporting lines</h4>
                <button type="button" className="button" onClick={() => move(1)}>
                  Edit structure
                </button>
              </div>
              {draft.departments.length > 0 && (
                <ul className="setup-department-summary">
                  {draft.departments.map((department) => (
                    <li key={department.id}>
                      <strong>{department.name}</strong>
                      <span>Lead: {agentName(department.leadId)}</span>
                      {department.purpose.trim() && <p>{department.purpose}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {draft.agents.length > 0 ? (
                <ul className="setup-team-summary">
                  {draft.agents.map((agent) => (
                    <li key={agent.id}>
                      <strong>{agent.name}</strong>
                      <span>
                        {agent.role} · {departmentName(agent.departmentId)}
                      </span>
                      <span>Reports to: {agentName(agent.reportsToId)}</span>
                      {(agent.responsibilities.trim() || agent.instructions.trim()) && (
                        <details>
                          <summary>Responsibilities and instructions</summary>
                          {agent.responsibilities.trim() && (
                            <p className="setup-preserve-lines">{agent.responsibilities}</p>
                          )}
                          {agent.instructions.trim() && (
                            <p className="setup-preserve-lines">{agent.instructions}</p>
                          )}
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="setup-empty">
                  An empty corporation, ready for you to add agents when needed.
                </p>
              )}
              <p className="muted">
                Next, review the exact changes and confirm creation. If this short code is already
                in use, the final review will show a unique code.
              </p>
            </section>
          )}
        </fieldset>
        {(localErrors.length > 0 || error) && (
          <div className="error-box" role="alert" tabIndex={-1} ref={errorBox}>
            {error && <p>{error}</p>}
            {localErrors.length > 0 && (
              <ul>
                {localErrors.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <footer className="dialog-actions">
          <button className="button" type="button" disabled={working} onClick={close}>
            Cancel
          </button>
          {step > 0 && (
            <button
              className="button"
              type="button"
              disabled={working}
              onClick={() => move(step - 1)}
            >
              <ArrowLeft size={15} />
              Back
            </button>
          )}
          <button className="button primary" type="submit" disabled={working}>
            {working
              ? 'Preparing review…'
              : step === 2
                ? 'Review changes'
                : step === 1
                  ? 'Review corporation'
                  : 'Continue to structure'}
            <ArrowRight size={15} />
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
