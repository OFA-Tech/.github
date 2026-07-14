import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BuildEnvironment,
  bumpForBranch,
  ImageCoordinates,
  InvalidInputError,
  latestSemverBaseline,
  nextVersion,
  SemverDateTag,
} from "../src/domain";

test("ImageCoordinates normalizes case and surrounding slashes", () => {
  const coordinates = ImageCoordinates.create("Docker.io", "/OFA-Tech/", "My-App");
  assert.equal(coordinates.registry, "docker.io");
  assert.equal(coordinates.account, "ofa-tech");
  assert.equal(coordinates.repository, "my-app");
});

test("ImageCoordinates omits the registry prefix for Docker Hub", () => {
  assert.equal(ImageCoordinates.create("docker.io", "acme", "app").imagePath, "acme/app");
  assert.equal(ImageCoordinates.create("", "acme", "app").imagePath, "acme/app");
  assert.equal(
    ImageCoordinates.create("ghcr.io", "acme", "app").imagePath,
    "ghcr.io/acme/app",
  );
});

test("ImageCoordinates builds tagged references", () => {
  assert.equal(ImageCoordinates.create("", "acme", "app").taggedAs("1.0.1-20260712"), "acme/app:1.0.1-20260712");
});

test("ImageCoordinates rejects empty and malformed components", () => {
  assert.throws(() => ImageCoordinates.create("docker.io", "", "app"), InvalidInputError);
  assert.throws(() => ImageCoordinates.create("docker.io", "a/b", "app"), InvalidInputError);
  assert.throws(() => ImageCoordinates.create("docker.io", "acme", "-bad"), InvalidInputError);
});

test("SemverDateTag parses prefixed and bare tags", () => {
  const tag = SemverDateTag.parse("stg-2.3.14-20260701");
  assert.equal(tag?.prefix, "stg-");
  assert.equal(tag?.major, 2);
  assert.equal(tag?.minor, 3);
  assert.equal(tag?.point, 14);
  assert.equal(tag?.date, "20260701");
  assert.equal(SemverDateTag.parse("1.0.0-20260701")?.prefix, "");
  assert.equal(SemverDateTag.parse("latest"), null);
  assert.equal(SemverDateTag.parse("v1.0.0"), null);
});

test("SemverDateTag renders back to the tag scheme", () => {
  assert.equal(SemverDateTag.of("dev-", 3, 1, 7, "20260712").toString(), "dev-3.1.7-20260712");
  assert.equal(SemverDateTag.of("", 1, 0, 2, "20260712").withPoint(3).toString(), "1.0.3-20260712");
});

test("latestSemverBaseline finds the highest triplet and max point overall", () => {
  const baseline = latestSemverBaseline([
    "latest",
    "1.0.5-20260101",
    "2.1.3-20260401",
    "dev-2.0.9-20260301",
    "not-a-version",
  ]);
  // 2.1 is the highest major.minor; the max point (9) comes from another line.
  assert.deepEqual(baseline, { major: 2, minor: 1, maxPoint: 9 });
});

test("latestSemverBaseline defaults to zero without matching tags", () => {
  assert.deepEqual(latestSemverBaseline(["latest", "abc"]), { major: 0, minor: 0, maxPoint: 0 });
});

test("bumpForBranch maps branch prefixes to bump kinds", () => {
  assert.equal(bumpForBranch("feature/login"), "major");
  assert.equal(bumpForBranch("feat/login"), "major");
  assert.equal(bumpForBranch("fix/crash"), "minor");
  assert.equal(bumpForBranch("hotfix/crash"), "minor");
  assert.equal(bumpForBranch("chore/deps"), "patch");
  assert.equal(bumpForBranch(""), "patch");
});

test("nextVersion always advances the point and applies the bump", () => {
  const baseline = { major: 2, minor: 1, maxPoint: 9 };
  assert.deepEqual(nextVersion(baseline, "major"), { major: 3, minor: 0, point: 10 });
  assert.deepEqual(nextVersion(baseline, "minor"), { major: 2, minor: 2, point: 10 });
  assert.deepEqual(nextVersion(baseline, "patch"), { major: 2, minor: 1, point: 10 });
});

test("BuildEnvironment honors the requested environment and its spellings", () => {
  assert.equal(BuildEnvironment.resolve("dev", "main").tagPrefix, "dev-");
  assert.equal(BuildEnvironment.resolve("Staging", "main").tagPrefix, "stg-");
  assert.equal(BuildEnvironment.resolve("production", "develop").tagPrefix, "");
});

test("BuildEnvironment falls back to the ref name, defaulting to production", () => {
  assert.equal(BuildEnvironment.resolve("", "develop").name, "development");
  assert.equal(BuildEnvironment.resolve("", "stg").name, "staging");
  assert.equal(BuildEnvironment.resolve("", "main").name, "production");
  assert.equal(BuildEnvironment.resolve("", "").tagPrefix, "");
});

test("BuildEnvironment rejects unsupported environments", () => {
  assert.throws(() => BuildEnvironment.resolve("qa", "main"), InvalidInputError);
});
