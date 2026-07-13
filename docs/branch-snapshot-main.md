# Branch Snapshot: `main`

_Snapshot date: 2026-07-12_

This file documents the observed state of this workspace at documentation time.

## Git identity

- Current branch: `main`
- Remote:
  - `origin https://github.com/OFA-Tech/.github.git` (fetch/push)

## Working tree status (captured)

Modified files:

- `.gitignore`
- `README.md`
- `actions/portainer/deploy-update/action.yml`
- `actions/portainer/stack-exists/action.yml`

Untracked files/folders:

- `.github/workflows/check-dist.yml`
- `CONTRIBUTING.md`
- `dist/`
- `package-lock.json`
- `package.json`
- `scripts/build/`
- `src/`
- `test/`
- `tsconfig.json`

## Interpretation

This branch currently contains substantial in-progress migration work introducing:

- a TypeScript action library under `src/`
- bundled Node actions under `dist/`
- stricter contributor guidance (`CONTRIBUTING.md`)
- dist parity validation workflow (`check-dist.yml`)

Given the number of untracked core files, this looks like a large pending commit set rather than a clean synchronized `main` checkout.

## Documentation scope note

All documents in `/docs` describe the repository as it exists in this workspace snapshot, including pending local changes listed above.
