import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { X, ArrowRight, Check, Undo2 } from "lucide-react";
import type {
  ChangePreview,
  DomainCommand,
  WorkspaceState,
} from "../domain/contracts";
import type { Selection } from "./model";
import { companyAgents } from "./model";

export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `dialog-${title.toLowerCase().replace(/\W/g, "-")}`;
  useEffect(() => {
    const element = ref.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    element?.showModal();
    element
      ?.querySelector<HTMLElement>('input:not([type="file"]):not([readonly]), textarea, select')
      ?.focus();
    return () => {
      element?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`gf-dialog ${wide ? "gf-dialog-wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

export interface EditorTarget {
  kind: Selection["kind"];
  id?: string;
  companyId?: string;
  departmentId?: string;
}
export function EntityEditor({
  target,
  state,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  target: EditorTarget;
  state: WorkspaceState;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (commands: DomainCommand[], summary: string) => Promise<void>;
}) {
  const company = state.companies.find(
    (row) =>
      row.id === (target.kind === "company" ? target.id : target.companyId),
  );
  const agent = state.agents.find((row) => row.id === target.id);
  const department = state.departments.find((row) => row.id === target.id);
  const initial =
    target.kind === "company"
      ? company
      : target.kind === "department"
        ? department
        : agent;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(
    target.kind === "agent"
      ? (agent?.instructions ?? "")
      : initial && "description" in initial
        ? initial.description
        : "",
  );
  const [shortCode, setShortCode] = useState(
    target.kind === "company" ? (company?.shortCode ?? "") : "",
  );
  const [color, setColor] = useState(company?.color || "#d4b62e");
  const [role, setRole] = useState(agent?.role ?? "");
  const [responsibilities, setResponsibilities] = useState(
    agent?.responsibilities.join("\n") ?? "",
  );
  const [departmentId, setDepartmentId] = useState(
    agent?.departmentId ?? target.departmentId ?? "",
  );
  const [managerId, setManagerId] = useState(
    (target.kind === "department" ? department?.managerId : agent?.managerId) ??
      "",
  );
  const companyId = target.companyId ?? company?.id ?? "";
  const departmentCompanyIds = new Set(target.kind === "agent" && target.id
    ? state.assignments.filter(row => row.agentId === target.id && !row.endedAt).map(row => row.companyId)
    : [companyId]);
  const people = target.kind === "agent"
    ? state.agents.filter(row => row.status === "active" && row.id !== target.id)
    : companyId ? companyAgents(state, companyId).filter(row => row.id !== target.id) : [];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    let command: DomainCommand;
    if (target.kind === "company") {
      const input = {
        name: name.trim(),
        shortCode: shortCode.trim(),
        description: description.trim(),
        color,
      };
      command = target.id
        ? { type: "company.update", id: target.id, input }
        : { type: "company.create", input };
    } else if (target.kind === "department") {
      const input = {
        name: name.trim(),
        description: description.trim(),
        managerId: managerId || null,
      };
      command = target.id
        ? { type: "department.update", id: target.id, input }
        : { type: "department.create", input: { ...input, companyId } };
    } else {
      const input = {
        name: name.trim(),
        role: role.trim(),
        instructions: description.trim(),
        responsibilities: responsibilities
          .split("\n")
          .map((row) => row.trim())
          .filter(Boolean),
        departmentId: departmentId || null,
        managerId: managerId || null,
      };
      command = target.id
        ? { type: "agent.update", id: target.id, input }
        : {
            type: "agent.create",
            companyId,
            input: { ...input, kind: "agent" },
          };
    }
    await onSubmit(
      [command],
      `${target.id ? "Update" : "Create"} ${target.kind}: ${name.trim()}`,
    );
  };
  return (
    <Dialog
      title={`${target.id ? "Edit" : "Create"} ${target.kind}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="dialog-body editor-form">
        <p className="muted">
          {target.kind === "company"
            ? "Give your company an identity and a clear purpose."
            : target.kind === "department"
              ? "Bring related responsibilities together."
              : "Define what this agent owns and how it should work."}{" "}
          You will review before saving.
        </p>
        <label>
          Name
          <input
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              target.kind === "company"
                ? "Acme Studio"
                : target.kind === "department"
                  ? "Engineering"
                  : "Product engineer"
            }
          />
        </label>
        {target.kind === "company" && (
          <div className="form-row">
            <label>
              Short code
              <input
                required
                pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,15}"
                maxLength={16}
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                placeholder="ACME"
              />
            </label>
            <label>
              Company color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
        )}
        {target.kind === "agent" && (
          <label>
            Role
            <input
              required
              maxLength={120}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Turns product requirements into working software"
            />
          </label>
        )}
        <label>
          {target.kind === "agent" ? "Instructions" : "Purpose"}
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              target.kind === "agent"
                ? "Working context, constraints, and expected outputs…"
                : "What does this team exist to do?"
            }
          />
        </label>
        {target.kind === "agent" && (
          <>
            <label>
              Responsibilities <span className="muted">One per line</span>
              <textarea
                rows={3}
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder={
                  "Implement reviewed changes\nWrite meaningful tests\nDocument decisions"
                }
              />
            </label>
            <label>
              Department
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Company level</option>
                {state.departments
                  .filter((row) => departmentCompanyIds.has(row.companyId))
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {departmentCompanyIds.size > 1 ? `${state.companies.find(company => company.id === row.companyId)?.name} / ` : ""}{row.name}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        {target.kind !== "company" && (
          <label>
            {target.kind === "department" ? "Department lead" : "Reports to"}
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">No manager</option>
              {people.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.role}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <footer className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Preparing…" : "Review change"}
            <ArrowRight size={15} />
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

export function PreviewDialog({
  preview,
  busy,
  error,
  onClose,
  onApply,
  onRefresh,
}: {
  preview: ChangePreview;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onApply: () => void;
  onRefresh: () => void;
}) {
  return (
    <Dialog title="Review your changes" wide onClose={onClose}>
      <div className="dialog-body">
        <div className="draft-label">
          <span /> Draft · Nothing has been saved
        </div>
        <h3 className="preview-title">{preview.summary}</h3>
        <p className="muted">
          Review {preview.changes.length} items below. Everything is saved
          together when you confirm; your current organization stays intact
          until then.
        </p>
        <ol className="preview-list">
          {preview.changes.map((change, index) => (
            <li key={index}>
              <span className="change-number">{index + 1}</span>
              {change}
            </li>
          ))}
        </ol>
        <p className="preview-note">
          <Undo2 size={15} /> Configuration changes can be undone while safe.
          Executed and accepted work is kept as evidence.
        </p>
        {error && (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button className="button" onClick={onRefresh} disabled={busy}>
              Refresh preview
            </button>
          </div>
        )}
        <footer className="dialog-actions">
          <button className="button" disabled={busy} onClick={onClose}>
            Discard draft
          </button>
          <button
            className="button primary"
            disabled={busy || Boolean(error)}
            onClick={onApply}
          >
            <Check size={16} />
            {busy ? "Applying…" : "Apply changes"}
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
