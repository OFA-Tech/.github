# OFA-Tech Central CI/CD

Reusable GitHub Actions workflows and composite actions for consistent CI/CD across repositories.

## Canonical Contract

Primary orchestration entrypoint: `workflow-templates/ci-cd.yml`.

Canonical input names are kebab-case and are used consistently across stage workflows:

- Runtime: `language`, `language-version`, `distribution`, `working-directory`, `runner`
- Verify: `run-build`, `build-command`, `run-tests`, `run-unit-tests`, `unit-test-command`, `run-integration-tests`, `integration-test-command`, `run-mutation-tests`, `mutation-test-command`, `test-command`
- Sonar: `run-sonar`, `sonar-project-key`, `sonar-project-name`, `sonar-sources`, `sonar-command`, `enforce-quality-gate`, `sonar-token`, `sonar-host-url`
- Docker: `run-docker-image`, `docker-registry`, `docker-image-name`, `dockerfile`, `docker-context`, `docker-version`, `docker-push-latest`, `docker-username`, `docker-password`
- Deploy: `run-deploy`, `deploy-strategy`, `deploy-mode`, `deploy-host`, `deploy-port`, `deploy-username`, `deploy-remote-path`, `deploy-source-glob`, `deploy-strip-components`, `deploy-overwrite`, `deploy-clean-remote`, `deploy-docker-image`, `deploy-docker-compose-file`, `deploy-docker-run-command`, `deploy-docker-swarm-service-name`, `deploy-docker-swarm-replicas`, `deploy-docker-registry`, `deploy-docker-username`, `deploy-docker-password`, `deploy-ssh-private-key`
- Portainer: `portainer-operation`, `portainer-stack-type`, `portainer-stack-id`, `portainer-stack-name`, `portainer-stack-file-content`, `portainer-swarm-id`, `portainer-env-json`, `portainer-prune`, `portainer-repull-image-and-redeploy`, `portainer-prefer-git-redeploy`, `portainer-endpoint-id`, `portainer-url`, `portainer-rollback-to`
- Post-deploy and rollback: `run-post-deploy-tests`, `run-health-check`, `health-check-url`, `health-check-command`, `health-check-expected-status`, `health-check-retries`, `health-check-interval-seconds`, `run-load-test`, `load-test-command`, `run-contract-test`, `contract-test-command`, `run-rollback`, `auto-rollback`, `manual-rollback`, `docker-rollback-command`, `ssh-rollback-command`

## Global Precedence Model

All resolution is centralized in `workflow-templates/ci-cd.yml` (`resolve-contract` job) with this order:

1. Explicit input (`inputs.*`)
2. Passed workflow secret (`secrets.*`)
3. Environment-level vars/secrets (when available in context)
4. Repository/organization vars/secrets (`vars.*`, fallback `secrets.*`)

Stage workflows consume resolved values and do not re-resolve fallbacks.

## Defaults Matrix (selected)

| Canonical key | Resolution chain |
|---|---|
| `sonar-token` | `inputs.sonar-token` → `secrets.sonar-token` |
| `sonar-host-url` | `inputs.sonar-host-url` → `secrets.sonar-host-url` → `vars.SONAR_HOST_URL` |
| `sonar-project-key` | `inputs.sonar-project-key` → `vars.SONAR_PROJECT_KEY` |
| `docker-password` | `inputs.docker-password` → `secrets.docker-password` |
| `deploy-host` | `inputs.deploy-host` → `vars.DEPLOY_HOST` |
| `deploy-ssh-private-key` | `inputs.deploy-ssh-private-key` → `secrets.deploy-ssh-private-key` |
| `portainer-api-key` | `secrets.portainer-api-key` |

## Sonar Templates

All Sonar templates in `workflow-templates/sonar-*.yml` now use one identical contract and delegate execution to `workflows/stage-sonar.yml`. No template contains hardcoded project keys or secrets.

## Guardrails

`workflows/ci-guardrails.yml` enforces:

- `actionlint` on `workflow-templates/*.yml` and `workflows/*.yml`
- `shellcheck` on `scripts/**/*.sh`

## Usage Example

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:

jobs:
  pipeline:
    uses: OFA-Tech/.github/workflow-templates/ci-cd.yml@v1
    with:
      language: dotnet
      language-version: "8.0"
      run-build: true
      run-tests: true
      run-sonar: true
      sonar-project-key: ofa_myapp
      sonar-project-name: MyApp
      deploy-strategy: docker
      run-deploy: false
    secrets:
      sonar-token: ${{ secrets.SONAR_TOKEN }}
      sonar-host-url: ${{ secrets.SONAR_HOST_URL }}
```
