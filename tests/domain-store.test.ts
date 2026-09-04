import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createWorkspaceStore, restoreWorkspaceBackup } from '../src/db/store.js';
import { getTemplate, listTemplates } from '../src/company/templates.js';
import { DomainError } from '../src/domain/errors.js';
import { validateDefinition } from '../src/domain/model.js';
import type { DomainCommand, WorkspaceStore } from '../src/domain/contracts.js';

const directories: string[] = [];
const stores: WorkspaceStore[] = [];
function directory() { const dir = mkdtempSync(join(tmpdir(), 'gitflash-domain-')); directories.push(dir); return dir; }
function open(dir = directory()) { const store = createWorkspaceStore(dir); stores.push(store); return store; }
function apply(store: WorkspaceStore, commands: DomainCommand[]) { return store.apply(store.preview(commands, store.snapshot().revision).id); }
const company = (name: string): DomainCommand => ({ type: 'company.create', input: { name, shortCode: name, description: '', color: '#123456' } });
const agent = (companyId: string, name = 'Builder'): DomainCommand => ({ type: 'agent.create', companyId, input: { name, role: 'Engineer', kind: 'agent', instructions: 'Produce verified implementation evidence.', responsibilities: ['Deliver the assigned task'], departmentId: null, managerId: null } });
function expectCode(run: () => unknown, code: string) { try { run(); throw new Error('Expected domain failure'); } catch (error) { expect(error).toBeInstanceOf(DomainError); expect((error as DomainError).code).toBe(code); } }
afterEach(() => { for (const store of stores.splice(0)) store.close(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('local SQLite company store', () => {
  it('persists preview separately, applies once, and retains state and replay after restart', () => {
    const dir = directory(); const store = open(dir);
    const preview = store.preview([company('STUDIO')], 0);
    expect(store.snapshot().companies).toHaveLength(0);
    store.close(); const restarted = open(dir);
    const result = restarted.apply(preview.id);
    expect(result.state.companies[0]?.name).toBe('STUDIO'); expect(result.state.revision).toBe(1);
    const replay = restarted.apply(preview.id); expect(replay.replayed).toBe(true); expect(replay.changeId).toBe(result.changeId); expect(replay.state.revision).toBe(1);
    apply(restarted, [agent(result.state.companies[0]!.id)]); restarted.close();
    const recovered = open(dir).snapshot(); expect(recovered.agents).toHaveLength(1); expect(recovered.assignments[0]?.isPrimary).toBe(true);
  });

  it('refuses stale and invalid atomic previews without partial writes', () => {
    const store = open(); const a = store.preview([company('A')], 0); const b = store.preview([company('B')], 0);
    store.apply(a.id); expectCode(() => store.apply(b.id), 'STALE_PREVIEW');
    const before = store.snapshot(); expectCode(() => store.preview([company('C'), agent('missing')], before.revision), 'NOT_FOUND');
    expect(store.snapshot()).toEqual(before);
    expectCode(() => store.preview([company('A')], before.revision), 'DUPLICATE_SHORT_CODE');
  });

  it('undoes the latest change atomically with a monotonic revision and retained audit', () => {
    const store = open(); const first = apply(store, [company('A')]); const second = apply(store, [agent(first.state.companies[0]!.id)]);
    expectCode(() => store.undo(first.changeId, 2), 'UNDO_UNAVAILABLE');
    const restored = store.undo(second.changeId, 2); expect(restored.revision).toBe(3); expect(restored.agents).toHaveLength(0); expect(restored.companies).toHaveLength(1);
    expect(restored.history).toHaveLength(3); expect(restored.history[0]?.action).toBe('change.undo'); expect(restored.history.some((h) => h.undoable)).toBe(false);
    expectCode(() => store.undo(second.changeId, 3), 'UNDO_UNAVAILABLE');
  });

  it('enforces ownership cycles, incoming totals and self/duplicate edges', () => {
    const store = open(); const s = apply(store, [company('A'), company('B'), company('C')]).state; const [a,b,c] = s.companies.map((x) => x.id);
    const edge = (from: string, to: string, percentage: number | null): DomainCommand => ({ type: 'relationship.create', input: { fromCompanyId: from, toCompanyId: to, kind: 'ownership', percentage, description: '' } });
    apply(store, [edge(a!,b!,60)]);
    expectCode(() => store.preview([edge(b!,a!,50)], 2), 'OWNERSHIP_CYCLE');
    expectCode(() => store.preview([edge(c!,b!,41)], 2), 'OWNERSHIP_EXCEEDED');
    expectCode(() => store.preview([edge(a!,a!,20)], 2), 'SELF_RELATIONSHIP');
    expectCode(() => store.preview([edge(a!,b!,30)], 2), 'DUPLICATE_RELATIONSHIP');
    apply(store, [edge(c!,b!,40)]); expect(store.snapshot().relationships).toHaveLength(2);
  });

  it('preserves dated assignment history and rejects manager cycles', () => {
    const store = open(); const s = apply(store, [company('A'),company('B')]).state; const [a,b] = s.companies.map((x) => x.id);
    const team = apply(store, [agent(a!,'Lead'),agent(a!,'Builder')]).state.agents; const [lead,builder] = team.map((x) => x.id);
    apply(store, [{ type:'agent.update',id:builder!,input:{managerId:lead!} }]);
    expectCode(() => store.preview([{ type:'agent.update',id:lead!,input:{managerId:builder!} }],3), 'MANAGER_CYCLE');
    apply(store, [{type:'assignment.primary',agentId:builder!,companyId:b!}]);
    const rows = store.snapshot().assignments.filter((x) => x.agentId === builder); expect(rows).toHaveLength(3); expect(rows.filter((x) => x.isPrimary && !x.endedAt)).toHaveLength(1);
    expectCode(() => store.preview([{type:'assignment.end',id:rows.find((x) => x.isPrimary && !x.endedAt)!.id}],4), 'PRIMARY_REQUIRED');
  });

  it('archives company relations, preserves multi-company members and clears dangling managers', () => {
    const store = open(); const s = apply(store,[company('A'),company('B')]).state; const [a,b] = s.companies.map((x) => x.id);
    const team = apply(store,[agent(a!,'Lead'),agent(a!,'Builder')]).state.agents;
    apply(store,[{type:'assignment.add',agentId:team[1]!.id,companyId:b!},{type:'agent.update',id:team[1]!.id,input:{managerId:team[0]!.id}}]);
    const state = apply(store,[{type:'company.archive',id:a!}]).state;
    expect(state.agents[0]?.status).toBe('archived'); expect(state.agents[1]?.status).toBe('active'); expect(state.agents[1]?.managerId).toBeNull();
    expect(state.assignments.find((x) => x.agentId === team[1]!.id && x.companyId === b && !x.endedAt)?.isPrimary).toBe(true);
    apply(store,[{type:'company.restore',id:a!},{type:'agent.restore',id:team[0]!.id,companyId:a!}]);
    expect(store.snapshot().agents.every((x) => x.status === 'active')).toBe(true);
  });

  it('imports a realistic 100-agent template twice with fresh IDs and no synthetic work', () => {
    const store = open(); const definition = getTemplate('studio-100'); const first = apply(store,[{type:'definition.import',definition}]).state;
    expect(first.agents).toHaveLength(100); expect(first.departments).toHaveLength(10); expect(first.work).toHaveLength(0);
    expect(new Set(first.agents.map((a) => a.role)).size).toBe(100);
    expect(new Set(first.agents.map((a) => a.responsibilities[0])).size).toBe(100);
    expect(first.agents.find((a) => a.role === 'SQLite Engineer')?.instructions).toContain('transactions, constraints, indexes');
    const second = apply(store,[{type:'definition.import',definition}]).state;
    expect(second.agents).toHaveLength(200); expect(new Set(second.agents.map((a) => a.id)).size).toBe(200); expect(second.companies.map((c) => c.shortCode)).toEqual(['STUDIO','STUDIO-2']);
    expect(validateDefinition(store.exportDefinition()).agents).toHaveLength(200);
    expect(listTemplates().map((x) => x.agentCount)).toEqual([20,100]); expect(getTemplate('studio-20').agents).toHaveLength(20);
  });

  it('rejects malformed definitions and unknown commands without reserving a partial template', () => {
    const store = open(); const definition = getTemplate('studio-20'); definition.assignments[0]!.companyId = 'missing';
    expectCode(() => store.preview([{type:'definition.import',definition}],0),'INVALID_REFERENCE');
    expect(store.snapshot().revision).toBe(0); expect(store.snapshot().companies).toHaveLength(0);
    expectCode(() => validateDefinition({...definition,schemaVersion:99}), 'UNSUPPORTED_SCHEMA');
    expectCode(() => store.preview([{type:'anything'} as unknown as DomainCommand],0), 'UNKNOWN_COMMAND');
    expectCode(() => validateDefinition({...getTemplate('studio-20'),work:[]}), 'INVALID_DEFINITION');
    const unsupported = getTemplate('studio-20'); Object.assign(unsupported.agents[0]!,{apiKey:'not-a-real-secret'});
    expectCode(() => validateDefinition(unsupported), 'INVALID_DEFINITION');
  });

  it('records real supplied work with provenance, idempotency and acceptance semantics', () => {
    const store = open(); const s = apply(store,[company('A')]).state; const cid = s.companies[0]!.id; const aid = apply(store,[agent(cid)]).state.agents[0]!.id;
    const command: DomainCommand = {type:'work.record',input:{companyId:cid,agentId:aid,title:'Review result',output:'Checked the three specified routes. Route /health returned 200.',provenance:'manual',status:'submitted',durationMs:null,runId:'test-real-run'}};
    const result = apply(store,[command]); expect(result.state.work[0]?.provenance).toBe('manual'); expect(result.state.history[0]?.undoable).toBe(false);
    expectCode(() => store.undo(result.changeId,3),'UNDO_UNAVAILABLE');
    expectCode(() => store.preview([command],3),'DUPLICATE_RUN');
    apply(store,[{type:'work.accept',id:result.state.work[0]!.id}]); expect(store.snapshot().work[0]?.status).toBe('accepted');
    expectCode(() => store.preview([{type:'work.accept',id:result.state.work[0]!.id}],4),'INVALID_STATE');
  });

  it('backs up a live WAL workspace, validates restoration, and preserves recovery evidence', async () => {
    const dir = directory(); const store = open(dir); apply(store,[company('A')]);
    const ledger = new DatabaseSync(join(dir,'workspace.sqlite')); ledger.prepare('INSERT INTO integration_runs VALUES (?,?,?,?)').run('run-a','request-a',JSON.stringify({id:'run-a',requestId:'request-a',output:'Saved original result',status:'completed'}),'{}');
    const backup = join(dir,'first.sqlite'); await store.backup(backup);
    ledger.prepare('INSERT INTO integration_runs VALUES (?,?,?,?)').run('run-b','request-b',JSON.stringify({id:'run-b',requestId:'request-b',output:'Later result',status:'completed'}),'{}'); ledger.close();
    apply(store,[company('B')]); await expect(restoreWorkspaceBackup(dir,backup)).rejects.toMatchObject({code:'WORKSPACE_BUSY'});
    store.close(); await restoreWorkspaceBackup(dir,backup); const restored = open(dir); expect(restored.snapshot().companies.map((c) => c.name)).toEqual(['A']);
    expect(readdirSync(join(dir,'backups')).some((f) => f.startsWith('before-restore-'))).toBe(true);
    const recoveredLedger = new DatabaseSync(join(dir,'workspace.sqlite')); expect(recoveredLedger.prepare('SELECT id FROM integration_runs').all().map((r)=>r.id)).toEqual(['run-a']); expect(recoveredLedger.prepare('SELECT info FROM integration_runs').get()?.info).toContain('Saved original result'); recoveredLedger.close();
    await expect(restored.backup(backup)).rejects.toMatchObject({code:'BACKUP_EXISTS'});
    restored.close(); const corrupt = join(dir,'corrupt.sqlite'); writeFileSync(corrupt,'not a database');
    await expect(restoreWorkspaceBackup(dir,corrupt)).rejects.toMatchObject({code:'INVALID_BACKUP'}); expect(open(dir).snapshot().companies).toHaveLength(1);
  });

  it('journals migrations, backs up before upgrade, and enforces SQLite foreign keys', () => {
    const dir = directory(); const store = open(dir); apply(store,[company('A')]); store.close();
    const db = new DatabaseSync(join(dir,'workspace.sqlite')); db.exec('DROP INDEX unique_work_run; DROP INDEX work_company_date; DROP INDEX agents_department; DROP INDEX assignments_company; DROP INDEX changes_revision; DROP TABLE integration_runs; ALTER TABLE changes DROP COLUMN undoable; DELETE FROM schema_migrations WHERE version>1; PRAGMA user_version=1;'); db.close();
    const reopened = open(dir); expect(reopened.snapshot().schemaVersion).toBe(3); expect(reopened.snapshot().companies).toHaveLength(1); reopened.close();
    const backups = readdirSync(join(dir,'backups')); expect(backups).toHaveLength(1); const old = new DatabaseSync(join(dir,'backups',backups[0]!)); expect(old.prepare('PRAGMA user_version').get()?.user_version).toBe(1); old.close();
    const checkDb = new DatabaseSync(join(dir,'workspace.sqlite')); expect(checkDb.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get()?.n).toBe(3); checkDb.exec('PRAGMA foreign_keys=ON;');
    expect(() => checkDb.prepare('INSERT INTO departments VALUES (?,?,?,?,?)').run('bad','missing','No company','',null)).toThrow(); checkDb.close();
    expect(statSync(join(dir,'workspace.sqlite')).mode & 0o777).toBe(0o600);
  });

  it('refuses a second process store and recovers a stale process lock', () => {
    const dir = directory(); const store = open(dir); expectCode(() => createWorkspaceStore(dir),'WORKSPACE_BUSY'); store.close();
    writeFileSync(join(dir,'workspace.lock'),JSON.stringify({pid:2147483647,token:'dead-process'})); const recovered = open(dir); expect(recovered.snapshot().revision).toBe(0);
    expect(JSON.parse(readFileSync(join(dir,'workspace.lock'),'utf8')).pid).toBe(process.pid);
  });

  it('refuses a newer workspace schema without rewriting its database', () => {
    const dir = directory(); const store = open(dir); store.close();
    const future = new DatabaseSync(join(dir,'workspace.sqlite')); future.exec('PRAGMA user_version=999;'); future.close();
    const original = readFileSync(join(dir,'workspace.sqlite'));
    expectCode(() => createWorkspaceStore(dir),'UPGRADE_REQUIRED'); expect(readFileSync(join(dir,'workspace.sqlite'))).toEqual(original);
  });

  it('records completion after an agent was archived and preserves work during later configuration undo', () => {
    const store = open(); const companyId = apply(store,[company('A')]).state.companies[0]!.id; const agentId = apply(store,[agent(companyId)]).state.agents[0]!.id;
    apply(store,[{type:'agent.archive',id:agentId}]);
    apply(store,[{type:'work.record',input:{companyId,agentId,title:'Execution completed',output:'The requested analysis finished after archival.',provenance:'codex',status:'submitted',durationMs:10,runId:'archived-completion'}}]);
    const config = apply(store,[company('B')]); store.undo(config.changeId,config.state.revision);
    expect(store.snapshot().work).toHaveLength(1); expect(store.snapshot().work[0]?.runId).toBe('archived-completion');
  });

  it('previews exact field changes and full role instructions before any mutation', () => {
    const store = open(); const preview = store.preview([{type:'company.create',input:{name:'Studio',shortCode:'STUDIO',description:'Build useful local software.',color:'#123456'}}],0);
    expect(preview.changes.join('\n')).toContain('Purpose: Build useful local software.'); expect(preview.changes.join('\n')).toContain('Short code: STUDIO');
    const companyId = store.apply(preview.id).state.companies[0]!.id;
    const update = store.preview([{type:'company.update',id:companyId,input:{description:'Deliver reviewed products.'}}],1);
    expect(update.changes.join('\n')).toContain('Build useful local software. → Deliver reviewed products.');
    const template = store.preview([{type:'definition.import',definition:getTemplate('studio-100')}],1);
    expect(template.changes.some((line) => line.includes('Agent SQLite Engineer') && line.includes('Instructions:'))).toBe(true);
    expect(store.snapshot().agents).toHaveLength(0);
  });

  it('rolls back a failing migration and keeps its pre-upgrade backup', () => {
    const dir = directory(); const store = open(dir); apply(store,[company('A')]); store.close();
    const legacy = new DatabaseSync(join(dir,'workspace.sqlite'));
    legacy.exec('DROP INDEX unique_work_run; DROP INDEX work_company_date; DROP INDEX agents_department; DROP INDEX assignments_company; DROP INDEX changes_revision; DROP TABLE integration_runs; ALTER TABLE changes DROP COLUMN undoable; DELETE FROM schema_migrations WHERE version>1; PRAGMA user_version=1; CREATE INDEX work_company_date ON work(companyId);'); legacy.close();
    expect(() => createWorkspaceStore(dir)).toThrow();
    const checked = new DatabaseSync(join(dir,'workspace.sqlite'));
    expect(checked.prepare('PRAGMA user_version').get()?.user_version).toBe(1); expect(checked.prepare('SELECT name FROM companies').get()?.name).toBe('A');
    expect(checked.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get()?.n).toBe(1);
    expect(checked.prepare("SELECT name FROM sqlite_master WHERE name='unique_work_run'").get()).toBeUndefined(); checked.close();
    expect(readdirSync(join(dir,'backups'))).toHaveLength(1);
    expect(() => readFileSync(join(dir,'workspace.lock'))).toThrow();
  });

  it('rejects a structurally invalid SQLite backup before replacing a working workspace', async () => {
    const dir = directory(); const store = open(dir); apply(store,[company('A')]); const backup = join(dir,'invalid-ledger.sqlite'); await store.backup(backup); store.close();
    const invalid = new DatabaseSync(backup); invalid.prepare('INSERT INTO integration_runs VALUES (?,?,?,?)').run('run-a','request-a',JSON.stringify({id:'other-run',requestId:'request-a',status:'completed',output:'Result'}),'{}'); invalid.close();
    await expect(restoreWorkspaceBackup(dir,backup)).rejects.toMatchObject({code:'INVALID_BACKUP'});
    expect(open(dir).snapshot().companies[0]?.name).toBe('A');
  });

  it('restores a valid backup over an unreadable current database and preserves original bytes', async () => {
    const dir = directory(); const store = open(dir); apply(store,[company('A')]); const backup = join(dir,'valid.sqlite'); await store.backup(backup); store.close();
    const broken = Buffer.from('Simulated unreadable database bytes.'); writeFileSync(join(dir,'workspace.sqlite'),broken);
    await restoreWorkspaceBackup(dir,backup);
    expect(open(dir).snapshot().companies[0]?.name).toBe('A');
    const recovery = readdirSync(join(dir,'backups')).find((name)=>name.startsWith('before-restore-unreadable-'))!;
    expect(readFileSync(join(dir,'backups',recovery,'workspace.sqlite'))).toEqual(broken);
  });
});
