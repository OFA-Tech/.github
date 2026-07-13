# OFA-Tech `.github` Documentation

_Last updated: 2026-07-12_

This folder documents the current state of the **`OFA-Tech/.github` repository** in this workspace, based on the current branch snapshot.

## What this repository is

This repo is the organization-level CI/CD platform for OFA-Tech. It provides:

- Reusable GitHub workflows (`workflow_call`)
- Reusable actions (composite + Node 20 actions)
- A shared TypeScript action library for orchestration logic
- Committed `dist/` bundles used directly by GitHub Actions runners
- Starter workflow templates for consumer repositories

## Documentation map

- [Repository Overview](./repository-overview.md)
- [Workflows & Templates Reference](./workflows-reference.md)
- [Actions Reference](./actions-reference.md)
- [TypeScript Library & Build System](./typescript-library.md)
- [Development & Operations Guide](./development-operations.md)
- [Branch Snapshot (`main`)](./branch-snapshot-main.md)

## Important operational rule

`dist/` is intentionally version-controlled. Any change under `src/` requires rebuilding and committing `dist/`.

The guard workflow `.github/workflows/check-dist.yml` enforces this.
