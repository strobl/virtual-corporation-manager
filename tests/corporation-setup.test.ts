import { describe, expect, it } from 'vitest';
import { emptyState, executeCommands, validateDefinition } from '../src/domain/model';
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
} from '../src/web/corporation-setup';

const now = '2026-09-05T15:00:00.000Z';
const identity = () => ({
  ...createCorporationDraft(),
  name: 'Northstar Studio',
  shortCode: 'NORTHSTAR',
  purpose: 'Research and deliver useful work.',
});

describe('corporation setup definition builder', () => {
  it('keeps an empty corporation empty and matches the actual 1–24 character code contract', () => {
    for (const shortCode of ['x', 'a'.repeat(24)]) {
      const definition = buildCorporationDefinition({ ...identity(), shortCode }, now);
      expect(validateDefinition(definition)).toEqual(definition);
      expect(definition.companies[0].shortCode).toBe(shortCode.toUpperCase());
      expect(definition.agents).toEqual([]);
      expect(definition.departments).toEqual([]);
      expect(definition.assignments).toEqual([]);
    }
    for (const shortCode of ['', 'a'.repeat(25), '-A', 'A B', 'A/B'])
      expect(() => buildCorporationDefinition({ ...identity(), shortCode }, now)).toThrow(/1–24/);
  });

  it('builds the editable starter with durable role, lead and reporting references without mutating the draft', () => {
    const draft = addStarterStructure(identity());
    draft.agents[1].name = '  Evidence researcher  ';
    draft.agents[1].instructions = '  Cite the source of each finding.  ';
    draft.agents[1].responsibilities = ' Collect evidence \n\n Explain uncertainty ';
    const before = structuredClone(draft);
    const definition = buildCorporationDefinition(draft, now);
    expect(draft).toEqual(before);
    expect(validateDefinition(definition)).toEqual(definition);
    expect(definition.departments).toHaveLength(2);
    expect(definition.agents).toHaveLength(3);
    expect(definition.agents[1]).toMatchObject({
      name: 'Evidence researcher',
      instructions: 'Cite the source of each finding.',
      responsibilities: ['Collect evidence', 'Explain uncertainty'],
      departmentId: draft.departments[1].id,
      managerId: draft.agents[0].id,
    });
    expect(definition.departments[1].managerId).toBe(draft.agents[2].id);
    expect(definition.assignments.every((row) => row.isPrimary && row.endedAt === null)).toBe(true);
    expect(definition.relationships).toEqual([]);
  });

  it('imports the graph with remapped IDs and reviewed code collision while retaining the existing corporation', () => {
    const definition = buildCorporationDefinition(addStarterStructure(identity()), now);
    const first = executeCommands(
      emptyState(),
      [{ type: 'definition.import', definition }],
      now,
    ).state;
    const before = structuredClone(first);
    const second = executeCommands(first, [{ type: 'definition.import', definition }], now);
    expect(first).toEqual(before);
    expect(second.state.companies).toHaveLength(2);
    expect(second.state.companies[0]).toEqual(before.companies[0]);
    const newCompany = second.state.companies[1];
    expect(newCompany.shortCode).toBe('NORTHSTAR-2');
    expect(newCompany.id).not.toBe(definition.companies[0].id);
    expect(second.changes.some((line) => line.includes('Short code: NORTHSTAR-2'))).toBe(true);
    const assignments = second.state.assignments.filter((row) => row.companyId === newCompany.id);
    const members = second.state.agents.filter((row) =>
      assignments.some((a) => a.agentId === row.id),
    );
    const departments = second.state.departments.filter((row) => row.companyId === newCompany.id);
    expect(members).toHaveLength(3);
    expect(assignments).toHaveLength(3);
    const coordinator = members.find((row) => row.name === 'Coordinator')!;
    expect(coordinator.id).not.toBe('draft-coordinator');
    expect(
      members
        .filter((row) => row.id !== coordinator.id)
        .every((row) => row.managerId === coordinator.id),
    ).toBe(true);
    expect(departments.every((row) => members.some((agent) => agent.id === row.managerId))).toBe(
      true,
    );
    expect(
      members.every((row) => departments.some((department) => department.id === row.departmentId)),
    ).toBe(true);
    expect(second.state.work).toEqual([]);
  });

  it('removes a draft agent or department without dangling leads, managers or membership references', () => {
    const draft = addStarterStructure(identity());
    const before = structuredClone(draft);
    const withoutCoordinator = removeSetupAgent(draft, 'draft-coordinator');
    expect(withoutCoordinator.agents.every((row) => row.reportsToId === null)).toBe(true);
    expect(withoutCoordinator.departments[0].leadId).toBeNull();
    const withoutDelivery = removeSetupDepartment(withoutCoordinator, 'draft-delivery');
    expect(withoutDelivery.agents.every((row) => row.departmentId === null)).toBe(true);
    expect(() =>
      validateDefinition(buildCorporationDefinition(withoutDelivery, now)),
    ).not.toThrow();
    expect(draft).toEqual(before);
  });

  it('rejects self-reporting, indirect cycles and missing references before a server preview', () => {
    const draft = addStarterStructure(identity());
    expect(canReportTo(draft, 'draft-coordinator', 'draft-coordinator')).toBe(false);
    expect(canReportTo(draft, 'draft-coordinator', 'draft-researcher')).toBe(false);
    expect(canReportTo(draft, 'draft-researcher', 'draft-specialist')).toBe(true);
    draft.agents[0].reportsToId = draft.agents[1].id;
    expect(() => buildCorporationDefinition(draft, now)).toThrow(/cycle/);
    draft.agents[0].reportsToId = null;
    draft.agents[1].departmentId = 'missing';
    expect(() => buildCorporationDefinition(draft, now)).toThrow(/existing department/);
    draft.agents[1].departmentId = null;
    draft.departments[0].leadId = 'missing';
    expect(() => buildCorporationDefinition(draft, now)).toThrow(/existing agent/);
  });

  it('preserves identity and does not silently replace a custom structure with the starter', () => {
    const draft = addSetupAgent(addSetupDepartment(identity()));
    expect(draft.name).toBe('Northstar Studio');
    expect(draft.agents[0].id).not.toBe(draft.departments[0].id);
    expect(() => addStarterStructure(draft)).toThrow(/before adding/);
    expect(corporationDraftErrors(draft, true)).toEqual([]);
    expect(corporationDraftErrors(draft)).toContain('Department 1 name is required.');
    expect(corporationDraftErrors(draft)).toContain('Agent 1 name is required.');
    expect(addSetupAgent(draft).agents[1].id).not.toBe(draft.agents[0].id);
  });

  it('suggests valid codes for accented/long names and checks saved responsibility bounds', () => {
    expect(suggestCorporationCode('Élan Studio')).toBe('ELAN-STUDIO');
    expect(suggestCorporationCode('A'.repeat(40))).toHaveLength(24);
    const draft = addStarterStructure(identity());
    draft.agents[0].responsibilities = Array.from({ length: 51 }, () => 'Review evidence').join(
      '\n',
    );
    expect(() => buildCorporationDefinition(draft, now)).toThrow(/50 responsibilities/);
    draft.agents[0].responsibilities = 'x'.repeat(1001);
    expect(() => buildCorporationDefinition(draft, now)).toThrow(/1,000 characters/);
  });
});
