# Actions Reference

This section summarizes action contracts in `actions/**/action.yml`.

## Setup and utility actions

### `actions/setup/resolve`
Resolves language defaults:

- version
- distribution
- build command
- test command

Supported languages: `dotnet`, `node`, `java`, `python`, `go`, `php`, `cpp`.

### `actions/setup/runtime`
Installs runtime/toolchain using upstream setup actions:

- .NET, Node, Java, Python, Go, PHP
- C/C++ installs toolchain via apt on Ubuntu

### `actions/run-command`
Executes arbitrary command in optional working directory (`bash`, strict mode enabled).

---

## Docker actions

### `actions/docker/build-image`
Composite action that:

1. resolves image metadata (registry/account/repo/tag)
2. logs in to registry
3. builds image
4. tags `latest` optionally
5. pushes version and optional latest tags

It emits rich metadata outputs used by downstream workflows.

### `actions/docker/remove`
Safe container/image removal with optional force/volume cleanup and dangling prune.

### `actions/docker/swarm-deploy`
Create or update swarm service. Handles replicas, ports, mounts, env, constraints, networks.

### `actions/docker/swarm-scale`
Scales existing swarm service to desired replicas.

### `actions/docker/swarm-rollback`
Rolls a swarm service back to previous version.

### `actions/docker/standalone-deploy`
Despite the directory name, current manifest is a generalized `docker run` wrapper with configurable runtime options.

---

## Portainer actions

### `actions/portainer/deploy-update` (Node 20)
Uses TypeScript bundle (`dist/portainer-deploy/index.js`) for deploy/update orchestration.

### `actions/portainer/stack-exists` (Node 20)
Uses TypeScript bundle (`dist/portainer-stack-exists/index.js`) for stack lookup and type resolution.

### `actions/portainer/rollback` (composite shell)
Calls Portainer rollback API directly with `curl` + `jq`, computes fallback rollback version from current version.

### `actions/portainer/status`
Checks Portainer health and optionally endpoint runtime mode.

### `actions/portainer/stack-inspect`
Fetches stack metadata and emits full stack JSON.

### `actions/portainer/stack-file`
Fetches stack compose file content (latest or versioned).

### `actions/portainer/scale`
Updates stack using provided stack file content to apply scaling changes.

---

## SSH actions

### `actions/ssh/command`
Thin wrapper over `appleboy/ssh-action@v1.2.0`.

### `actions/ssh/upload`
Thin SCP wrapper over `appleboy/scp-action@v0.1.7`.
