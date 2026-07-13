# Workflows & Templates Reference

## Reusable workflow: `.github/workflows/ci-cd.yml`

Main orchestration entrypoint (`workflow_call`) for build, image, deploy, post-deploy validation, and conditional rollback.

### High-level pipeline

1. **`build-docker`** → calls `stage-build.yml`
2. **`deploy-portainer`** (if `run-deploy`) → calls `stage-deploy-portainer.yml`
3. **`post-deploy`** (if `run-post-deploy-tests`) → calls `stage-post-deploy.yml`
4. **`auto-rollback`** (if post-deploy failed) → calls `stage-rollback-portainer.yml`

### Outputs propagated

- Docker image outputs (`full-image-name`, registry/namespace/repository/tag)
- Deploy outputs (`deploy-stack-id`, `deploy-operation`)
- Rollback outputs (`rollback-stack-id`, `rollback-target-version`)

### Core input domains

- Runtime and language setup (`language`, `language-version`, etc.)
- Build/test toggles and command overrides
- Sonar toggles and exclusions
- Docker image generation parameters
- Portainer deploy parameters
- Post-deploy health-check parameters
- Rollback target override

---

## Stage workflow: `stage-build.yml`

Two-job stage:

- `build`: checkout, resolve defaults, setup runtime, build, tests, optional Sonar scan + optional quality gate
- `docker`: optional image build + push via `actions/docker/build-image`

This stage emits image metadata for downstream deploy steps.

---

## Stage workflow: `stage-deploy-portainer.yml`

- Detects stack existence using `actions/portainer/stack-exists`
- Chooses operation dynamically (`deploy` vs `update`)
- Executes using `actions/portainer/deploy-update`
- Injects image metadata via env (`WF_OUTPUT_*`) to support template interpolation

---

## Stage workflow: `stage-post-deploy.yml`

Runs HTTP health probing (`curl`) with retry loop and fixed interval.

- Fails stage if expected `200` status is not reached within retry budget

---

## Stage workflow: `stage-rollback-portainer.yml`

Runs rollback action (`actions/portainer/rollback`) after failed post-deploy validation.

Defaults to `self-hosted` runner if not overridden.

---

## Guard workflow: `check-dist.yml`

Triggered when `src/`, TS/build config, or bundler scripts change.

Steps:

1. install deps
2. typecheck + test
3. rebuild `dist/`
4. fail if rebuilt `dist/` differs from committed tree

This enforces source/bundle parity for Node actions.

---

## Workflow templates (`workflow-templates/`)

### `ci-cd.yml` template
Consumer-facing starter workflow that calls central reusable pipeline with defaults and `secrets: inherit`.

### Sonar templates
Language-scoped templates:

- `sonar-dotnet.yml`
- `sonar-gradle.yml`
- `sonar-js_ts.yml`
- `sonar-maven.yml`
- `sonar-others.yml`

Each has a companion `*.properties.json` metadata file for template cataloging.
