# Branch Snapshot

_Snapshot date: 2026-07-12_

This file documents the observed state of this workspace at documentation time.

## Git identity

- Current branch: `feat/ts-script-migration`
- Remote:
  - `origin https://github.com/OFA-Tech/.github.git` (fetch/push)

## State of the TypeScript migration

The migration of orchestration logic from shell to the TypeScript action
library is complete for the current surface:

- Node 20 actions (committed `dist/` bundles): `portainer/deploy-update`,
  `portainer/stack-exists`, `portainer/rollback`, `docker/metadata`.
- `actions/docker/build-image` resolves metadata through the
  `docker-metadata` bundle; only `docker login`/`build`/`tag`/`push` remain
  shell steps.
- Stack-file placeholder interpolation happens in TypeScript inside the
  Portainer deploy path (`StackFileResolver`).
- `scripts/` retains only dumb helpers (truthy parsing, lowercase, output
  writing, `docker login`, Docker Hub preflight).
- Reusable workflows reference sibling workflows and this repository's
  actions by local relative path (with a pinned `.ofa-tech-actions/`
  checkout for step-level actions).

## Documentation scope note

All documents in `/docs` describe the repository as it exists in this
workspace snapshot.
