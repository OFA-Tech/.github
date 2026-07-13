# TypeScript Library & Build System

## Source layout (`src/`)

Domain is organized by concept type, application by feature area, and
infrastructure by runtime/data-access concern.

- `src/domain/` — pure business model and contract surface:
  - `entities/` (Stack)
  - `enums/` (StackType, DeployOperation, ApiRequestMethod)
  - `interfaces/` (ports: StackRepository, WorkspaceFileReader, RestApiAccess, FileSystemAccess)
  - `models/` (StackLookup, StackEnvironment, RollbackTarget, Template, Placeholder, ScopedVariables, RestApiRequest/RestApiResponse)
  - `shared-utils/` (error kernel + pure helpers, one per file: `sleep`, `truncate`, `buildUrl`, `toEnvKey`/`isValidVariableName`)
  - `mappings/` and `extensions/` are reserved slots for future domain mapping contracts and extension helpers
- `src/application/` — orchestration by feature area:
  - `core/` — shared area: logger, typed inputs/outputs, `runAction()`, `StackFileResolver`
  - `portainer/` — feature area: `use-cases/` plus its own `actions/` entrypoints
- `src/infrastructure/` — side effects and wiring:
  - `cross-cutting/dependency-injections/` — factories wiring ports to implementations (`setups/` reserved)
  - `data/api-repositories/rest-api-access.ts` — `FetchRestApiAccess`, implementing the domain `RestApiAccess` port (all HTTP execution, translated from `RestApiAccess.cs`; the request/response contract lives in `domain/models/rest-api.ts`)
  - `data/api-repositories/portainer/` — named Portainer client, wire DTOs, DTO→domain mapper, repository adapter (one concern per file)
  - `data/file-system-repository/` — `NodeFileSystemAccess`, implementing the domain `FileSystemAccess` port, + workspace file reader
  - `data/database-repositories/` — reserved; add a shared `DatabaseAccess` modeled on `docs/guides/snippets/DatabaseAccess.cs`

Dependency direction: `domain` depends on nothing; `application` depends on
`domain`; `infrastructure` implements domain interfaces. Entrypoints reach
infrastructure only via the dependency-injection factories.

---

## `domain/shared` and `application/core`

### `domain/shared-utils/errors.ts`
Defines the stable error model with explicit exit codes (shared kernel — the
one domain module every layer may import; re-exported by `application/core`):

- `Success=0`
- `Failure=1`
- `InvalidInput=2`
- `UpstreamError=3`
- `PreconditionFailed=4`
- `Timeout=5`

Provides typed subclasses (`InvalidInputError`, `PreconditionError`, `UpstreamError`, `TimeoutError`) and normalization helper `toActionError`.

### `logger.ts`
Structured logging wrapper over `@actions/core` with:

- `debug/info/notice/warn/error`
- grouped logging
- secret masking

### `inputs.ts`
Typed input parsing helpers:

- `getString`
- `getRequired`
- `getBoolean`
- `getEnum`

### `outputs.ts`
`setOutputs({...})` helper to publish action outputs consistently.

### `run.ts`
`runAction()` lifecycle wrapper:

- starts timing
- runs body
- normalizes errors
- logs structured failure
- calls `core.setFailed`
- sets process exit code deterministically

---

## Interpolation & stack-file resolution

Stack-file variable expansion (equivalent to the old shell interpolation
logic) is split across the layers:

- `domain/models/` — `Template` (expands `${NAME}` / `${NAME:-default}`, iterative with a loop guard) and `ScopedVariables` (precedence rules)
- `domain/interfaces/workspace-file-reader.ts` — the file port
- `application/core/stack-file-resolver.ts` — `StackFileResolver` (inline content preferred, file fallback, then interpolation)
- `infrastructure/data/file-system-repository/` — `NodeWorkspaceFileReader` (workspace rule: `GITHUB_WORKSPACE` fallback to cwd) delegating path resolution and disk reads to the shared `FileSystemAccess` service

Resolution precedence:

1. `WF_OUTPUT_*`
2. `ACTION_OUTPUT_*`
3. `SECRET_*`
4. bare env (`NAME`)
5. `ENV_*`
6. `VAR_*`

---

## Portainer application area

### Domain pieces
Business model with no side effects:

- `entities/stack.ts` — `Stack` entity (normalized id/name/type/endpoint/version/git-backed)
- `models/stack-lookup.ts` — `StackLookup` result model owning the expected-type rule
- `models/stack-environment.ts` — `StackEnvironment` value object (`env-json` parsing, "none" vs explicit set)
- `models/rollback-target.ts` — `RollbackTarget` value object (explicit version validation, current-1 default rule)
- `interfaces/stack-repository.ts` — `StackRepository` port plus the command types the adapter consumes

### `application/portainer/use-cases/`
One use-case class per operation, each depending only on the `StackRepository` port:

- `FindStackUseCase` — lookup by id (direct) or name scoped to an endpoint
- `DeployStackUseCase` — create `standalone` or `swarm` stacks (swarm requires `swarm-id`)
- `UpdateStackUseCase` — git redeploy preference or file update with current-file fallback
- `RollbackStackUseCase` — explicit or computed rollback target

### `infrastructure/data/api-repositories/`
The shared access service plus everything Portainer-specific:

- `rest-api-access.ts` — `FetchRestApiAccess` (implements the domain `RestApiAccess` port), the one place HTTP happens: JSON encode/decode, default + custom headers, `Authorization` support, request timeout (→ `TimeoutError`), bounded retry policy for retryable requests, non-2xx mapped to `UpstreamError`. Configured per consumer with a service `name` used in errors and logs. The request/response models and the URL/truncate/sleep helpers it uses live in domain.
- `portainer/client.ts` — named Portainer client: base URL normalization, `X-API-Key` header, secret masking, marks GETs retryable; delegates every request to the `RestApiAccess` port
- `portainer/api-types.ts` — wire DTOs (never leave this layer)
- `portainer/stack-mapper.ts` — DTO → domain mapping at the boundary (`toStack`, `resolveStackType`)
- `portainer/stack-repository.ts` — `PortainerStackRepository` adapter: API paths and request bodies only

### `infrastructure/cross-cutting/dependency-injections/`
`createPortainerStacks()` and `createStackFileResolver()` wire the repositories into the use cases; entrypoints only see the returned use-case objects.

---

## Action entrypoints

### `src/application/portainer/actions/deploy-action.ts`
Parses action inputs, resolves stack file content/interpolation via `StackFileResolver`, dispatches deploy/update, writes outputs.

### `src/application/portainer/actions/stack-exists-action.ts`
Runs `FindStackUseCase`, lets `StackLookup.ensureType` enforce the optional expected type, writes existence outputs.

---

## Build and distribution pipeline

### Bundler script: `scripts/build/bundle.mjs`
Uses `@vercel/ncc` to build self-contained action bundles.

Current `ACTION_ENTRIES`:

- `src/application/portainer/actions/deploy-action.ts` → `dist/portainer-deploy/index.js`
- `src/application/portainer/actions/stack-exists-action.ts` → `dist/portainer-stack-exists/index.js`

### Why `dist/` is committed

GitHub Action runners execute Node actions from committed bundle files. They do not install repository dependencies when running reused actions. Therefore `dist/` must be versioned.

---

## Tests (`test/`)

- `interpolate.test.ts` validates `Template`/`ScopedVariables` resolution behavior and precedence
- `stack-file.test.ts` drives `StackFileResolver` against a fake `WorkspaceFileReader` (inline preference, file fallback, interpolation, missing input)
- `portainer-domain.test.ts` validates the value objects and lookup rules (env parsing, rollback target, type expectation)
- `portainer-use-cases.test.ts` drives every use case against an in-memory `StackRepository` fake
- `portainer-repository.test.ts` covers the adapter boundary: DTO → domain mapping, API paths, and request body assembly against a stubbed client
- `rest-api-access.test.ts` covers the shared HTTP service against a stubbed `fetch`: query building, headers/auth, JSON handling, error mapping, retry policy, timeout
- `portainer-client.test.ts` proves the named client only adds Portainer specifics on top of `RestApiAccess`
- `file-system-access.test.ts` covers the shared filesystem service and the workspace reader against real temp files
- `shared-utils.test.ts` covers the pure helpers (`truncate`, `buildUrl`, `toEnvKey`, `isValidVariableName`) and the `Placeholder` model
