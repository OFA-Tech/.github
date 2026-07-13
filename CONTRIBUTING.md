# Contributing to OFA-Tech CI/CD

This repository hosts the organization's reusable GitHub Actions, reusable
workflows, and the shared TypeScript action library. It follows one core
architectural rule that every contribution must respect.

---

## Architecture: TypeScript vs Shell

There is a hard boundary between **orchestration logic** and **operational
commands**. Put code on the correct side of that boundary.

### The decision rule

> **If a step branches, coordinates multiple calls, handles errors/retries, or
> talks to an HTTP API, it is _logic_ → write it in TypeScript.**
>
> **If a step is a single, stateless CLI invocation that takes arguments and
> does one thing, it is _operational_ → keep it in shell.**

Ask these questions about the step. **Any "yes" means TypeScript:**

| Question | Yes → TypeScript |
| --- | --- |
| Does it have conditional branches (`if`/`case`) that change what runs? | ✅ |
| Does it orchestrate more than one dependent call/step? | ✅ |
| Does it call an HTTP API and parse/branch on the response? | ✅ |
| Does it implement retries, backoff, or polling? | ✅ |
| Does it map failures to specific exit codes / structured errors? | ✅ |
| Is the logic reused across more than one action? | ✅ |
| Does it parse/transform structured data (JSON, semver, env scopes)? | ✅ |

If **all** answers are "no" — it is shell:

| Shell is correct when… | Example |
| --- | --- |
| One CLI command with assembled args | `docker build -f "$DF" -t "$TAG" .` |
| Stateless push/pull/login | `docker push "$TAG"` |
| Git operations | `git tag`, `git push` |
| Package installs | `npm ci`, `dotnet restore` |
| Thin wrapper over a third-party action | `appleboy/ssh-action` |

### Constraints

- **Do not rewrite shell in TypeScript unless it contains logic.** A `docker push`
  does not become `exec("docker", ["push"])` for its own sake.
- **Shell scripts stay dumb.** They receive arguments, do one thing, and exit.
  No multi-scope variable resolution, no API clients, no retry loops in bash.
- **Build on `@actions/core` and `@actions/exec`.** Do not reinvent input
  parsing, output writing, secret masking, logging, or process execution.
- **Preserve public contracts.** Action paths (`actions/<group>/<name>`),
  workflow file names, job names, and input/output names are referenced by
  external repositories. Refactor the _implementation_, never the contract.

---

## Repository layout

```
.
├── .github/workflows/      # Reusable workflows (workflow_call) — orchestration glue
├── actions/                # Action manifests (action.yml) — the public contract
│   ├── portainer/          #   node20 actions → point at dist/ bundles
│   ├── docker/             #   shell actions  → thin docker CLI wrappers
│   └── ssh/                #   shell actions  → third-party action wrappers
├── src/                    # TypeScript source, organized as DDD layers
│   ├── domain/             #   business model — pure, side-effect free
│   │   ├── entities/       #     aggregate roots / entities (Stack)
│   │   ├── enums/          #     closed vocabularies (StackType, DeployOperation)
│   │   ├── interfaces/     #     ports implemented by infrastructure
│   │   ├── models/         #     value objects & result models (Template, StackLookup, …)
│   │   └── shared-utils/   #     shared kernel: error taxonomy + exit codes
│   │       #                     (mappings/ and extensions/ are reserved slots)
│   ├── application/        #   orchestration, organized by feature area
│   │   ├── core/           #     shared area: logging, typed IO, runAction(), StackFileResolver
│   │   └── portainer/      #     feature area owning everything Portainer
│   │       ├── actions/    #       node action entrypoints (deploy, stack-exists)
│   │       └── use-cases/  #       one use-case class per stack operation
│   └── infrastructure/     #   side effects and runtime wiring
│       ├── cross-cutting/
│       │   └── dependency-injections/  # factories wiring ports → implementations
│       │       #                         (setups/ is a reserved slot)
│       └── data/
│           ├── api-repositories/       # RestApiAccess (shared HTTP) + per-API clients (portainer/)
│           └── file-system-repository/ # FileSystemAccess (shared FS) + repositories
│           #   database-repositories/ is a reserved slot (see docs/guides/snippets)
├── scripts/                # Dumb shell helpers sourced by shell actions
│   ├── docker/             #   single-purpose docker helpers
│   ├── common/             #   single-purpose shell helpers
│   └── build/              #   bundler that emits dist/
├── dist/                   # Committed ncc bundles — what node actions actually run
└── test/                   # Unit tests for the library
```

### Where things go

- **Entity with identity** → `src/domain/entities/`
- **Closed vocabulary / union type** → `src/domain/enums/`
- **Port an adapter must implement** → `src/domain/interfaces/`
- **Value object or result model** → `src/domain/models/`
- **Cross-layer vocabulary (errors, exit codes)** → `src/domain/shared-utils/`
- **Pure reusable helpers (sleep, truncate, URL/query building, key
  normalization)** → `src/domain/shared-utils/`, one helper per file — never
  inline them in infrastructure or application files
- **Feature use case, orchestration, or command** → `src/application/<area>/use-cases/`
- **A single action's entrypoint** → `src/application/<area>/actions/<name>-action.ts`
- **Reusable application-level logic** → `src/application/core/`
- **External HTTP/API access** → `src/infrastructure/data/api-repositories/<system>/`,
  built on the shared `RestApiAccess` service — never call `fetch` directly
- **File and path based operations** → `src/infrastructure/data/file-system-repository/`,
  built on the shared `FileSystemAccess` service — never call `node:fs` directly
- **Database access (when added)** → `src/infrastructure/data/database-repositories/`,
  as a shared `DatabaseAccess` service modeled on `docs/guides/snippets/DatabaseAccess.cs`
- **Wiring a port to an implementation** → `src/infrastructure/cross-cutting/dependency-injections/`
- **A single-purpose shell command** → `scripts/<domain>/`
- **The public manifest** → `actions/<group>/<name>/action.yml`

---

## The TypeScript action library

### `src/application/core` — the runtime foundation

Every node action is wrapped by `runAction()`, which owns the cross-cutting
concerns so action bodies stay focused:

- **`logger`** — structured logging over `@actions/core` (groups, masking,
  `key=value` fields).
- **`errors`** — `ActionError` hierarchy with stable `ExitCode`s
  (`InvalidInput=2`, `UpstreamError=3`, `PreconditionFailed=4`, `Timeout=5`).
  Lives in `src/domain/shared-utils` (every layer may depend on it) and is
  re-exported by the `application/core` barrel.
- **`inputs`** — typed, validated input accessors (`getRequired`, `getBoolean`,
  `getEnum`).
- **`outputs`** — `setOutputs({...})` writes the whole output contract at once.
- **`run`** — `runAction()` centralizes timing, failure rendering, and exit codes.

```ts
async function body(): Promise<void> {
  const url = getRequired("portainer-url");      // throws InvalidInputError (exit 2)
  const op = getEnum("operation", ["deploy", "update"] as const, "deploy");
  // ... domain logic, throw ActionError subclasses on failure ...
  setOutputs({ "stack-id": id, operation: op });
}

void runAction({ name: "my-action" }, body);
```

### Portainer — the model application area

Portainer is one feature area; use it as the template for any new area:

- **Domain** — the `Stack` entity (`domain/entities`), `StackType`
  (`domain/enums`), `StackEnvironment`, `RollbackTarget`, and `StackLookup`
  (`domain/models`), and the `StackRepository` port (`domain/interfaces`).
  Pure business rules, unit-testable without HTTP.
- **`src/application/portainer/use-cases/`** — one use-case class per
  operation (`FindStackUseCase`, `DeployStackUseCase`, `UpdateStackUseCase`,
  `RollbackStackUseCase`), each depending only on the `StackRepository` port.
- **`src/application/portainer/actions/`** — the feature's action entrypoints
  (`deploy-action.ts`, `stack-exists-action.ts`): read inputs, call use cases,
  write outputs.
- **`src/infrastructure/data/api-repositories/portainer/`** —
  `PortainerClient` (a *named client*: base URL, `X-API-Key`, secret masking,
  and which calls are idempotent), the wire DTOs, and
  `PortainerStackRepository`, which implements the port and maps DTOs to the
  domain model at the boundary. All transport mechanics — query assembly,
  JSON encode/decode, timeout, retries, non-2xx → `UpstreamError` — live once
  in the shared `RestApiAccess` service (the TypeScript translation of
  `docs/guides/snippets/RestApiAccess.cs`); a future API area adds its own
  named client and reuses it.
- **`src/infrastructure/cross-cutting/dependency-injections/portainer.ts`** —
  `createPortainerStacks()` wires the repository into the use cases so
  entrypoints never construct infrastructure directly.

The same pattern covers stack-file resolution: interpolation rules live in
`domain/models` (`Template`, `ScopedVariables`), the shared `StackFileResolver`
lives in `application/core`, its `WorkspaceFileReader` port in
`domain/interfaces`, and the filesystem adapter in
`infrastructure/data/file-system-repository`. New behaviour extends these
layers — it does not re-implement `curl`/`jq` in bash.

---

## Building and testing

The `dist/` bundles are **committed**. GitHub runs node actions directly from
`dist/` without `npm install`, so you must rebuild and commit after any `src/`
change.

```bash
npm install        # one-time / after dependency changes
npm run typecheck  # tsc --noEmit
npm test           # node:test unit tests via tsx
npm run build      # bundle src/application/*/actions/* into dist/ with ncc
npm run all        # typecheck + test + build
```

`.github/workflows/check-dist.yml` fails any PR where `dist/` is out of sync
with `src/`. Always run `npm run build` and commit `dist/` before pushing.

### Adding a new node action

1. Create `src/application/<area>/actions/<name>-action.ts` ending in
   `void runAction(..., body)`. Reach infrastructure only through the
   `infrastructure/cross-cutting/dependency-injections` factories.
2. Add a manifest at `actions/<group>/<name>/action.yml` with
   `runs: { using: node20, main: ../../../dist/<name>/index.js }`.
3. Register the entry in `scripts/build/bundle.mjs`.
4. `npm run all`, then commit `src/`, `dist/`, and `action.yml` together.

---

## Audit map (initial refactor)

How the existing surface was classified against the decision rule.

| Item | Classification | Rationale |
| --- | --- | --- |
| `actions/portainer/deploy-update` | **→ TypeScript** | deploy/update branching, git-redeploy detection, API error handling |
| `actions/portainer/stack-exists` | **→ TypeScript** | API lookup + stack-type resolution |
| `actions/portainer/rollback` | **→ TypeScript** (lib ready) | version math, validation, API call |
| `scripts/common/action-common.sh` (`common_interpolate_vars`) | **→ TypeScript** | multi-scope `${VAR:-default}` resolution engine |
| `scripts/docker/common.sh` (`docker_resolve_metadata`) | **→ TypeScript** (candidate) | semver resolution, branch-based bumping, collision-retry loop |
| `actions/docker/build-image` (build/tag/push steps) | **stays shell** | stateless `docker build`/`tag`/`push` |
| `actions/docker/swarm-deploy` / `swarm-scale` / `remove` | **stays shell** | `docker service` CLI invocations |
| `actions/run-command` | **stays shell** | single `eval` of a command |
| `actions/ssh/command` / `ssh/upload` | **stays shell** | thin wrappers over `appleboy/ssh-action` |

Items marked "candidate"/"lib ready" have their logic available in the `src/`
layers and are the next migrations; their shell remains until converted so no contract
breaks in the interim.
