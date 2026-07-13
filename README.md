# OFA-Tech Central CI/CD

This repository is the organization-wide DevOps control center for reusable GitHub Actions pipelines.

## Objective

Provide production-grade, reusable CI/CD building blocks that can be consumed by any repository in OFA-Tech with minimal configuration.

## Architecture

- Reusable workflows (`workflow_call`) orchestrate CI/CD stages.
- Actions (Node 20 + composite) encapsulate reusable step logic.
- Pipeline behavior is driven by inputs and secrets.
- Language-specific behavior is dynamic and parameterized.
- No repository-specific logic is hardcoded.
- Within this repository, workflows reference each other and their actions by
  local relative path (`./…`), so a pipeline always runs the workflows and
  actions from the same commit instead of mixing refs.

### Orchestration vs operations (TypeScript vs Shell)

Complex logic — branching, multi-step orchestration, API clients, error
handling, and retries — lives in the shared **TypeScript action library**
under `src/` (built on `@actions/core`/`@actions/exec`, bundled into `dist/`).
Shell stays dumb: single-purpose, stateless CLI invocations under `scripts/`.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the full decision rule, repository
layout, and the audit map of what moved where.

## Reusable Workflows

- `.github/workflows/ci-cd.yml`: Central orchestration entrypoint (build, test, sonar, image, deploy, post-deploy checks, auto-rollback).
- `.github/workflows/stage-build.yml`: Build/test/sonar stage plus docker image build and push.
- `.github/workflows/stage-deploy-portainer.yml`: Portainer stack deploy/update stage.
- `.github/workflows/stage-post-deploy.yml`: Post-deploy HTTP health checks.
- `.github/workflows/stage-rollback-portainer.yml`: Portainer stack rollback stage (used by auto-rollback).
- `.github/workflows/check-dist.yml`: Repository guard that keeps the committed `dist/` bundles in sync with `src/`.

## Actions

Node 20 actions (TypeScript, run from committed `dist/` bundles):

- `actions/portainer/deploy-update`: Deploy a new stack or update/redeploy an existing one via the Portainer API.
- `actions/portainer/stack-exists`: Stack lookup by ID or name with stack-type resolution.
- `actions/portainer/rollback`: Roll a stack back to an explicit or computed previous version.
- `actions/docker/metadata`: Resolve image registry/account/repository and generate the next version tag (branch-based bumping, collision checks).

Composite/shell actions:

- `actions/setup/resolve`: Resolves per-language defaults (version, distribution, build/test commands).
- `actions/setup/runtime`: Multi-language runtime setup (`dotnet`, `node`, `java`, `python`, `go`, `php`, `cpp`).
- `actions/run-command`: Shared command runner with working directory support.
- `actions/docker/build-image`: Docker image build/tag/push (metadata step backed by the TypeScript bundle).
- `actions/docker/remove`, `actions/docker/standalone-deploy`, `actions/docker/swarm-deploy`, `actions/docker/swarm-scale`, `actions/docker/swarm-rollback`: Thin docker CLI wrappers.
- `actions/portainer/status`, `actions/portainer/stack-inspect`, `actions/portainer/stack-file`, `actions/portainer/scale`: Portainer API utilities.
- `actions/ssh/command`, `actions/ssh/upload`: Thin wrappers over `appleboy` SSH/SCP actions.

## How Consumer Repositories Use It

Create a workflow in the target repository and call the central workflow
(`workflow-templates/ci-cd.yml` is a ready-made starter):

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:

jobs:
  pipeline:
    permissions:
      contents: write
      packages: write
    uses: OFA-Tech/.github/.github/workflows/ci-cd.yml@main
    with:
      gh-runner: ubuntu-latest
      language: dotnet
      language-version: "8.0"
      working-directory: .
      build-command: ""

      run-unit-tests: true
      unit-test-command: ""
      run-integration-tests: false

      run-sonar: true
      sonar-enforce-quality-gate: true
      sonar-exclusions: ""

      generate-docker-image: true
      docker-registry: docker.io
      docker-image-namespace: ""
      docker-image-repository: ""
      docker-image-tag: ""
      docker-image-environment: production
      dockerfile-path: Dockerfile

      run-deploy: true
      portainer-endpoint-id: "2"
      portainer-swarm-id: "swarm-cluster-id"
      portainer-stack-type: swarm
      portainer-stack-name: my-app
      portainer-stack-file-path: deploy/docker-stack.yml

      run-post-deploy-tests: true
      run-health-check: true
      health-check-url: https://my-app.example.com/health
      health-check-retries: "10"
      rollback-to: ""
    secrets:
      SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
      SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
      SONAR_PROJECT_KEY: ${{ secrets.SONAR_PROJECT_KEY }}
      DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
      DOCKERHUB_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}
      PORTAINER_URL: ${{ secrets.PORTAINER_URL }}
      PORTAINER_TOKEN: ${{ secrets.PORTAINER_TOKEN }}
```

`secrets: inherit` also works when the caller repository defines the same
secret names (this is what the starter template uses).

## Common Language Examples

Node.js:

```yaml
with:
  language: node
  language-version: "20"
  build-command: npm ci && npm run build
  unit-test-command: npm test
```

Python:

```yaml
with:
  language: python
  language-version: "3.12"
  build-command: python -m pip install -r requirements.txt
  unit-test-command: pytest -q
```

Java:

```yaml
with:
  language: java
  language-version: "21"
  language-distribution: temurin
  build-command: mvn -B -DskipTests package
  unit-test-command: mvn -B test
```

## Input Strategy

- Use `run-unit-tests`, `run-integration-tests`, `run-sonar`, `generate-docker-image`, `run-deploy`, `run-post-deploy-tests`, and `run-health-check` to enable or disable stages.
- Pass language/runtime through `language`, `language-version`, and optional `language-distribution`.
- Keep commands repository-specific through `build-command`, `unit-test-command`, and `integration-test-command` (empty values fall back to language defaults).
- Docker image naming is resolved automatically (owner/repository based) and can be overridden with `docker-image-namespace`, `docker-image-repository`, and `docker-image-tag`.
- Deployment targets Portainer: `portainer-stack-type` (`swarm` or `standalone`), `portainer-stack-name`, and a stack file via `portainer-stack-file-path` or `portainer-stack-file-content`. Placeholders like `${IMAGE_VERSION_TAG:-fallback}` in the stack file are interpolated by the TypeScript deploy action.

## Secrets Strategy

- Sonar: `SONAR_TOKEN`, `SONAR_HOST_URL`, `SONAR_PROJECT_KEY`
- Docker Hub: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
- Portainer: `PORTAINER_URL`, `PORTAINER_TOKEN`

Only provide secrets required by enabled stages.

## Versioning and Governance

- Use version tags when consuming workflows (`@v1`, `@v1.1.0`).
- Avoid `@main` in production repositories.
- Keep this repository backward-compatible for versioned workflow contracts.

## Design Principles

- Small workflows, shared components.
- Input-driven pipelines.
- Separation of concerns by stage.
- Maximum reuse across organization repositories.
