# OFA-Tech Central CI/CD

This repository is the organization-wide DevOps control center for reusable GitHub Actions pipelines.

## Objective

Provide production-grade, reusable CI/CD building blocks that can be consumed by any repository in OFA-Tech with minimal configuration.

## Architecture

- Reusable workflows (`workflow_call`) orchestrate CI/CD stages.
- Composite actions encapsulate reusable step logic.
- Pipeline behavior is driven by inputs and secrets.
- Language-specific behavior is dynamic and parameterized.
- No repository-specific logic is hardcoded.

## Reusable Workflows

- `.github/workflows/ci-build.yml`: Central orchestration workflow (build, test, sonar, deploy).
- `.github/workflows/stage-build.yml`: Build stage.
- `.github/workflows/stage-test.yml`: Test stage.
- `.github/workflows/stage-sonar.yml`: SonarQube code quality stage.
- `.github/workflows/stage-deploy-sftp.yml`: SFTP deployment stage.

## Composite Actions

- `actions/setup-runtime/action.yml`: Multi-language runtime setup (`dotnet`, `node`, `java`, `python`, `go`, `php`, `cpp`).
- `actions/run-command/action.yml`: Shared command runner with working directory support.
- `actions/sftp-upload/action.yml`: Shared SFTP upload step logic.

## How Consumer Repositories Use It

Create a workflow in the target repository and call the central workflow:

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:

jobs:
  pipeline:
    uses: OFA-Tech/.github/.github/workflows/ci-build.yml@v1
    with:
      language: dotnet
      language-version: '8.0'
      working-directory: .
      run-build: true
      build-command: dotnet restore && dotnet build --configuration Release --no-restore
      upload-artifact: true
      artifact-name: app
      artifact-path: ./src/MyApp/bin/Release/**
      run-tests: true
      test-command: dotnet test --configuration Release --no-build --verbosity normal
      run-sonar: true
      sonar-project-key: ofa_myapp
      sonar-project-name: MyApp
      sonar-sources: src
      enforce-quality-gate: true
      run-deploy: false
    secrets:
      sonar-token: ${{ secrets.SONAR_TOKEN }}
      sonar-host-url: ${{ secrets.SONAR_HOST_URL }}
      deploy-ssh-private-key: ${{ secrets.SFTP_PRIVATE_KEY }}
```

## Common Language Examples

Node.js:

```yaml
with:
  language: node
  language-version: '20'
  build-command: npm ci && npm run build
  test-command: npm test -- --ci
```

Python:

```yaml
with:
  language: python
  language-version: '3.12'
  build-command: python -m pip install -r requirements.txt
  test-command: pytest -q
```

Java (Maven):

```yaml
with:
  language: java
  language-version: '21'
  java-distribution: temurin
  build-command: mvn -B -DskipTests package
  test-command: mvn -B test
```

## Input Strategy

- Use `run-build`, `run-tests`, `run-sonar`, and `run-deploy` to enable or disable stages.
- Pass language/runtime through `language` and `language-version`.
- Keep commands repository-specific through `build-command`, `test-command`, and optional `sonar-command`.
- Use artifact parameters for cross-stage deployment (`artifact-name`, `artifact-path`).

## Secrets Strategy

- Sonar: `sonar-token`, `sonar-host-url`
- Deploy: `deploy-ssh-private-key`

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
