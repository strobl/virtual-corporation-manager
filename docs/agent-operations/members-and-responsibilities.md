# Members and responsibilities

Give each member a recognizable role and a clear area of responsibility. Start with the team you actually need. A configured member is an organizational record; it is not proof of an active agent or completed work.

## Define a useful role

In **Add member**, choose **Human** or **AI agent**, then enter a name and role. Open **Working context & responsibilities** for a human or **Instructions & responsibilities** for an agent. Enter one responsibility per line. State an output the owner can inspect, the decisions the member may make, and when help is needed.

For example, an optional review role could use these responsibilities:

```text
Review the supplied material against the owner's stated criteria.
Return a short list of findings with the supporting evidence.
Ask the owner when the brief is incomplete or the requested action exceeds permission.
Leave the final acceptance decision to the named owner.
```

This is writing guidance, not a default member, an executed review or a replacement for a specialized workflow's full role prompt. Keep working context specific: purpose, relevant inputs, expected output and authority limits. Add reporting or department detail only where it clarifies real responsibility.

## Keep three relationships distinct

| Relationship | What it means | Where to inspect it |
| --- | --- | --- |
| Company membership | The companies to which this member is assigned; one can be the primary company and others shared memberships | Member inspector → Company assignments → Manage |
| Reporting | Who manages the member | Member inspector → Reports to; company → Reporting lines |
| Company ownership | A relationship between companies, with a recorded percentage where applicable | Company's ownership/relationship controls |

Sharing a member keeps one identity. It does not create a separate teammate for each company. The save review lists affected companies for a shared-member edit; review that scope before applying a change. Instructions, role and responsibilities belong to the member, so a shared-member edit can affect how the member appears in other assigned companies. Do not assume they are private overrides for the company currently open.

Primary membership is not a reporting line. A company's ownership percentage is not a human's equity holding or a legal cap table. A named workflow acceptance owner is a separate responsibility and is not an ownership transaction.

## Work follows the member

An AI agent's **Give a task** control requires a connected, ready runtime and the eligible company context shown by the product. A shared agent may need to run in its primary company; follow the indicated company instead of treating the company currently visible as execution authority. Ordinary agent tasks return text for review. Reporting relationships do not automatically schedule, run or delegate work.

A human uses **Record work** to retain a contribution with the company and does not receive an agent execution control. Recording a contribution, reviewing a result and recording delivery hours are separate actions.

Use specialized role packages and Product Studio only when choosing that optional workflow. Their full prompts, limits, actual stage identities, QA criteria and acceptance requirements still apply. A list of five or one hundred configured roles is neither five or one hundred running agents nor completed business work.

## Check a change

After saving, reopen the member from the intended company. Confirm the member type, role, responsibilities, **Reports to** relationship and **Company assignments**. For a shared member, confirm both the retained identity and the reviewed scope. Use [support](../support.md) if the save fails, company context changes unexpectedly or a human receives a model-execution control.

Return to [company setup](company-management.md) or the [optional Product Studio workflow](../product-studio.md).
