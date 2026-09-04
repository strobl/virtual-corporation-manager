# Backup, restore and upgrade

These commands assume the GitFlash CLI is installed. The default workspace is `~/.gitflash`. Add the same `--data-dir <path>` to every command when using a different workspace.

## Save a complete workspace

Stop the running GitFlash server with **Ctrl+C**, then choose a new backup filename:

```sh
gitflash backup --output ./gitflash-backup.sqlite
```

The command saves a verified, consistent SQLite copy containing company configuration, work records, audit history, pending previews and the execution ledger. Existing destination files are never overwritten. The separate `runs/` text artifacts are not required to recover saved outputs: those outputs are also in the database and remain available in the Work view.

Runtime installations, provider login stores and environment credentials are external prerequisites. A workspace backup does not copy them. The backup does contain your company instructions, task context and results.

## Restore and verify

Stop GitFlash, then restore the chosen file:

```sh
gitflash restore --from ./gitflash-backup.sqlite
gitflash doctor
gitflash --no-open
```

Open the printed local URL. Check the expected companies, agents and Work results. `doctor` reports the database schema, revision and entity counts without making external model requests.

Restore acquires the workspace lock and verifies SQLite integrity, foreign keys, migration checksums, company invariants and execution-record identities before replacing the current database. It retains the previous readable workspace under `backups/before-restore-*.sqlite`. An unreadable current database is preserved byte for byte, together with any WAL/SHM sidecars, in a `backups/before-restore-unreadable-*` directory. That directory is recovery evidence, not a verified SQLite backup.

The restored database replaces the current workspace state and task ledger together. It does not merge later changes. Restoring local records cannot retract work or messages already performed by an external system. On startup, interrupted tasks are reconciled with saved work; tasks without a confirmed saved result are marked failed instead of being executed automatically again.

## Export configuration for another company

```sh
gitflash export --output ./company-definition.json
```

Import that JSON through **Settings → Import a company definition**, review the changes, then apply. The import creates fresh IDs and preserves existing companies. A definition contains configuration only; it is not a replacement for the full SQLite backup.

## Upgrade safely

1. Stop GitFlash and make a backup with the command above.
2. Install the desired published GitFlash release.
3. Run `gitflash doctor`, then start GitFlash and inspect the company and Work views.

Opening an older supported workspace runs its migrations automatically. GitFlash first saves a `backups/before-schema-*.sqlite` copy, then applies pending schema changes and journal entries in one transaction. A failed migration leaves the previous schema and data in place. The current release supports database schema 3 and refuses a newer schema rather than changing it.

To return to an earlier release, restore the backup created before that upgrade and use the compatible older GitFlash version. Installing old code over a newer database is not a downgrade procedure.

## Recovery messages

| Message                                    | Next step                                                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace already open                     | Stop the server using that directory before running backup, restore, export or doctor. Different workspaces can run separately.                                                                    |
| Workspace lock cannot be read              | Confirm no GitFlash process is using this directory. Preserve the directory, then remove only its stale `workspace.lock`. Normal stale locks with a dead recorded PID are recovered automatically. |
| Newer schema or migration journal mismatch | Keep the database unchanged. Use its compatible release, upgrade GitFlash, or restore a known compatible backup.                                                                                   |
| Invalid backup or entity records           | The current workspace has not been replaced. Choose another backup; retain the rejected file for diagnosis.                                                                                        |
| Stale preview                              | Refresh the preview, inspect the new changes, and confirm again.                                                                                                                                   |
| Interrupted or failed task                 | Inspect the saved output and any external runtime activity before submitting a new request. GitFlash does not automatically repeat uncertain external work.                                        |

Do not delete `workspace.sqlite-wal` or `workspace.sqlite-shm` from a running or crashed workspace to clear an error. They may belong to committed data. Use the stopped-workspace recovery commands so SQLite can preserve and verify the state.
