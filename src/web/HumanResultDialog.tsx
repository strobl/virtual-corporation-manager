import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Agent, DomainCommand } from '../domain/contracts';
import { Dialog } from './Dialogs';

/** Record completed human work; this never queues or executes an agent. */
export function HumanResultDialog({
  agent,
  companyId,
  busy,
  error,
  reviewing = false,
  onClose,
  onSubmit,
}: {
  agent: Agent;
  companyId: string;
  busy: boolean;
  error: string | null;
  reviewing?: boolean;
  onClose: () => void;
  onSubmit: (commands: DomainCommand[], summary: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [output, setOutput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const saving = busy || submitting;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || inFlight.current) return;
    if (agent.kind !== 'human' || agent.status !== 'active' || !companyId) {
      setLocalError('Choose an active human teammate and their company to record a result.');
      return;
    }
    const resultTitle = title.trim();
    const resultOutput = output.trim();
    if (!resultTitle || !resultOutput) {
      setLocalError('Add a title and the completed result.');
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setLocalError(null);
    try {
      await onSubmit(
        [
          {
            type: 'work.record',
            input: {
              companyId,
              agentId: agent.id,
              title: resultTitle,
              output: resultOutput,
              provenance: 'manual',
              status: 'submitted',
              durationMs: null,
              runId: null,
            },
          },
        ],
        `Record ${agent.name}’s result: ${resultTitle}`,
      );
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'The result could not be prepared.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  if (reviewing) return null;
  return (
    <Dialog title={`Record ${agent.name}’s result`} onClose={onClose} closeDisabled={saving}>
      <form className="dialog-body editor-form" onSubmit={submit}>
        <p className="muted">
          Add work {agent.name} has already completed. It will appear in your company’s results for
          review.
        </p>
        <label>
          Result title
          <input
            autoFocus
            required
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Customer interview findings"
            disabled={saving}
          />
        </label>
        <label>
          Completed result
          <textarea
            required
            rows={8}
            maxLength={1_000_000}
            value={output}
            onChange={(event) => setOutput(event.target.value)}
            placeholder="Paste the completed work, findings, or a summary with links to the deliverables…"
            disabled={saving}
          />
        </label>
        {(localError || error) && (
          <p className="error-box" role="alert">
            {localError || error}
          </p>
        )}
        <footer className="dialog-actions">
          <button type="button" className="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? 'Preparing…' : 'Review result'} <ArrowRight size={15} />
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
