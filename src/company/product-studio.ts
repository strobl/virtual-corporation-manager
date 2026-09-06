import type { CompanyDefinition } from '../domain/contracts.js';
import { validateDefinition } from '../domain/model.js';
import { studioContent } from '../jobs/content.js';

export function productStudioTemplate(): CompanyDefinition {
  const now = new Date().toISOString();
  const companyId = 'ao.company.product-studio';
  const stages = Object.entries(studioContent.stages);
  const managerRole = studioContent.stages.intake.role;
  const definition: CompanyDefinition = {
    schemaVersion: 1,
    name: 'Product Studio (5 seats)',
    description:
      'Five accountable roles with the installed PS-001 brief, full role instructions, independent QA and explicit owner review.',
    companies: [
      {
        id: companyId,
        name: 'Product Studio',
        shortCode: 'STUDIO',
        description:
          'Turn a small software brief into real files, independent checks and an explicit owner decision.',
        color: '#d9372f',
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    departments: [
      {
        id: 'studio-delivery',
        companyId,
        name: 'Product Delivery',
        description: 'A bounded production, independent review and handoff team.',
        managerId: managerRole,
      },
    ],
    agents: [],
    assignments: [],
    relationships: [],
  };
  for (const [, stage] of stages) {
    const role = studioContent.rolePrompts[stage.role];
    definition.agents.push({
      id: stage.role,
      name: role.name,
      role: stage.role,
      kind: 'agent',
      instructions: role.instructions,
      responsibilities: role.responsibilities,
      departmentId: 'studio-delivery',
      managerId: stage.role === managerRole ? null : managerRole,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    definition.assignments.push({
      id: `assignment-${stage.role}`,
      agentId: stage.role,
      companyId,
      isPrimary: true,
      startedAt: now,
      endedAt: null,
    });
  }
  return validateDefinition(definition);
}
