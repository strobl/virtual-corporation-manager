import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import type { CompanyDefinition } from '../domain/contracts';
import { Dialog } from './Dialogs';
import {
  buildCorporationDefinition,
  corporationDraftErrors,
  createCorporationDraft,
  suggestCorporationCode,
} from './corporation-setup';

export interface QuickCompanySetupProps {
  onReview: (definition: CompanyDefinition) => void | Promise<void>;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
  reviewing?: boolean;
}

export function QuickCompanySetup({
  onReview,
  onClose,
  busy = false,
  error,
  reviewing = false,
}: QuickCompanySetupProps) {
  const [draft, setDraft] = useState(createCorporationDraft);
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const errorBox = useRef<HTMLDivElement>(null);
  const working = busy || submitting;

  useEffect(() => {
    if (!reviewing && (localErrors.length || error)) errorBox.current?.focus();
  }, [localErrors, error, reviewing]);

  const close = () => {
    if (!working) onClose();
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    const definitionDraft = {
      ...draft,
      // Names in any script remain valid; the internal code is resolved at save review.
      shortCode: suggestCorporationCode(draft.name) || 'COMPANY',
    };
    const issues = corporationDraftErrors(definitionDraft);
    setLocalErrors(issues);
    if (issues.length) return;
    setSubmitting(true);
    try {
      await onReview(buildCorporationDefinition(definitionDraft, new Date().toISOString()));
    } catch (failure) {
      setLocalErrors([
        failure instanceof Error ? failure.message : 'Could not prepare your company. Try again.',
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  // The parent owns the save review. Keep the draft when that dialog opens or is cancelled.
  if (reviewing) return null;

  return (
    <Dialog title="Create your company" onClose={close} closeDisabled={working}>
      <form
        className="dialog-body editor-form corporation-setup quick-company-setup"
        onSubmit={(event) => void submit(event)}
      >
        <p className="muted">
          Start with a name. Add agents, people and their responsibilities as your company grows.
        </p>
        <fieldset className="setup-fields setup-section" disabled={working}>
          <label>
            Company name
            <input
              required
              maxLength={120}
              autoComplete="off"
              value={draft.name}
              placeholder="Northstar Studio"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            Purpose <span className="muted">Optional</span>
            <textarea
              rows={3}
              maxLength={5000}
              value={draft.purpose}
              placeholder="What is this company here to do?"
              onChange={(event) => setDraft({ ...draft, purpose: event.target.value })}
            />
          </label>
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
        <p className="muted">
          Your company is saved on this computer. You can edit it at any time.
        </p>
        <footer className="dialog-actions">
          <button className="button" type="button" onClick={close} disabled={working}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={working}>
            {working ? 'Preparing…' : 'Continue'} <ArrowRight size={15} />
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
