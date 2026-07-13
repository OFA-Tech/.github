import assert from "node:assert/strict";
import { test } from "node:test";
import { ResolveImageMetadataUseCase } from "../src/application/docker/use-cases/resolve-image-metadata";
import type {
  ImageCoordinates,
  ImageManifestAccess,
  ImageTagRepository,
  SourceBranchAccess,
  VariableSource,
} from "../src/domain";

/** In-memory fake of the registry tag port. */
class FakeTagRepository implements ImageTagRepository {
  constructor(
    private readonly tags: string[] = [],
    private readonly published = new Set<string>(),
  ) {}

  async listTags(): Promise<string[]> {
    return this.tags;
  }

  async tagExists(_coordinates: ImageCoordinates, tag: string): Promise<boolean> {
    return this.published.has(tag);
  }
}

function fakeManifests(existing: string[] = []): ImageManifestAccess {
  return { manifestExists: async (reference) => existing.includes(reference) };
}

function fakeBranches(branch = ""): SourceBranchAccess {
  return { detect: async () => branch };
}

function useCase(overrides: {
  tags?: ImageTagRepository;
  manifests?: ImageManifestAccess;
  branches?: SourceBranchAccess;
  env?: VariableSource;
}): ResolveImageMetadataUseCase {
  return new ResolveImageMetadataUseCase({
    tags: overrides.tags ?? new FakeTagRepository(),
    manifests: overrides.manifests ?? fakeManifests(),
    branches: overrides.branches ?? fakeBranches(),
    env: overrides.env ?? {},
    now: () => new Date("2026-07-12T10:00:00Z"),
  });
}

const baseInput = {
  registry: "docker.io",
  namespace: "",
  repository: "",
  tag: "",
  environment: "",
  username: "",
};

test("an explicit tag override skips version generation entirely", async () => {
  const metadata = await useCase({ env: {} }).execute({
    ...baseInput,
    namespace: "acme",
    repository: "app",
    tag: "9.9.9",
  });
  assert.equal(metadata.version, "9.9.9");
  assert.equal(metadata.image, "acme/app");
  assert.equal(metadata.imageVersionTag, "acme/app:9.9.9");
  assert.equal(metadata.imageLatestTag, "acme/app:latest");
});

test("account falls back through username, secrets, env, then the repo owner", async () => {
  const env: VariableSource = {
    DOCKER_ACCOUNT_SECRET: "secret-account",
    DOCKER_ACCOUNT: "env-account",
    GITHUB_REPOSITORY_OWNER: "OFA-Tech",
    GITHUB_REPOSITORY: "OFA-Tech/My-App",
  };
  const run = (input: Partial<typeof baseInput>) =>
    useCase({ env }).execute({ ...baseInput, tag: "1", ...input });

  assert.equal((await run({ namespace: "override" })).account, "override");
  assert.equal((await run({ username: "user" })).account, "user");
  assert.equal((await run({})).account, "secret-account");

  const withoutSecret = useCase({
    env: { ...env, DOCKER_ACCOUNT_SECRET: undefined },
  });
  assert.equal((await withoutSecret.execute({ ...baseInput, tag: "1" })).account, "env-account");

  const ownerOnly = useCase({ env: { GITHUB_REPOSITORY_OWNER: "OFA-Tech", GITHUB_REPOSITORY: "OFA-Tech/app" } });
  // Owner fallback strips characters outside [a-z0-9].
  assert.equal((await ownerOnly.execute({ ...baseInput, tag: "1" })).account, "ofatech");
});

test("repository falls back through secret, env, then the repo basename", async () => {
  const env: VariableSource = {
    DOCKER_IMAGE_NAME_SECRET: "secret-name",
    DOCKER_IMAGE_NAME: "env-name",
    GITHUB_REPOSITORY_OWNER: "acme",
    GITHUB_REPOSITORY: "acme/My-App",
  };
  const run = (input: Partial<typeof baseInput>, source: VariableSource = env) =>
    useCase({ env: source }).execute({ ...baseInput, namespace: "acme", tag: "1", ...input });

  assert.equal((await run({ repository: "override" })).imageName, "override");
  assert.equal((await run({})).imageName, "secret-name");
  assert.equal(
    (await run({}, { ...env, DOCKER_IMAGE_NAME_SECRET: undefined })).imageName,
    "env-name",
  );
  assert.equal(
    (
      await run(
        {},
        { GITHUB_REPOSITORY_OWNER: "acme", GITHUB_REPOSITORY: "acme/My-App" },
      )
    ).imageName,
    "my-app",
  );
});

test("generates the next version from the published baseline and build date", async () => {
  const metadata = await useCase({
    tags: new FakeTagRepository(["2.1.3-20260401", "1.0.5-20260101"]),
  }).execute({ ...baseInput, namespace: "acme", repository: "app" });
  // patch bump: highest triplet 2.1, max point 5 → 2.1.6, dated today (UTC).
  assert.equal(metadata.version, "2.1.6-20260712");
  assert.equal(metadata.imageVersionTag, "acme/app:2.1.6-20260712");
});

test("feature branches bump the major version; fix branches the minor", async () => {
  const tags = new FakeTagRepository(["2.1.3-20260401"]);
  const feature = await useCase({ tags, branches: fakeBranches("Feature/Login") }).execute({
    ...baseInput,
    namespace: "acme",
    repository: "app",
  });
  assert.equal(feature.version, "3.0.4-20260712");

  const fix = await useCase({ tags, branches: fakeBranches("fix/crash") }).execute({
    ...baseInput,
    namespace: "acme",
    repository: "app",
  });
  assert.equal(fix.version, "2.2.4-20260712");
});

test("applies the environment prefix from the requested environment", async () => {
  const metadata = await useCase({}).execute({
    ...baseInput,
    namespace: "acme",
    repository: "app",
    environment: "development",
  });
  assert.equal(metadata.version, "dev-0.0.1-20260712");
});

test("derives the environment from the ref name when not requested", async () => {
  const metadata = await useCase({ env: { GITHUB_REF_NAME: "staging" } }).execute({
    ...baseInput,
    namespace: "acme",
    repository: "app",
  });
  assert.equal(metadata.version, "stg-0.0.1-20260712");
});

test("advances the point version until no published tag or manifest collides", async () => {
  const metadata = await useCase({
    tags: new FakeTagRepository([], new Set(["0.0.1-20260712"])),
    manifests: fakeManifests(["acme/app:0.0.2-20260712"]),
  }).execute({ ...baseInput, namespace: "acme", repository: "app" });
  assert.equal(metadata.version, "0.0.3-20260712");
});

test("keeps a non-hub registry in the image path", async () => {
  const metadata = await useCase({}).execute({
    ...baseInput,
    registry: "ghcr.io",
    namespace: "acme",
    repository: "app",
    tag: "1.0.0",
  });
  assert.equal(metadata.registry, "ghcr.io");
  assert.equal(metadata.image, "ghcr.io/acme/app");
});
