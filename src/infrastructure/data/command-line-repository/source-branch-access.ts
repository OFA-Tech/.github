/**
 * Adapter implementing the {@link SourceBranchAccess} domain port for GitHub
 * Actions runners — the TypeScript port of `docker_detect_source_branch`.
 *
 * Detection precedence:
 *   1. `GITHUB_HEAD_REF` (pull_request events)
 *   2. the event payload at `GITHUB_EVENT_PATH` (`pull_request.head.ref`,
 *      then a bare `head_ref`)
 *   3. the last commit subject (merge commits: `... from owner/branch`)
 * Returns an empty string when nothing matches.
 */
import { getExecOutput } from "@actions/exec";
import type { FileSystemAccess, SourceBranchAccess, VariableSource } from "../../../domain";
import { NodeFileSystemAccess } from "../file-system-repository/file-system-access";

interface EventPayload {
  pull_request?: { head?: { ref?: string } };
  head_ref?: string;
}

export class GitHubSourceBranchAccess implements SourceBranchAccess {
  constructor(
    private readonly env: VariableSource = process.env,
    private readonly files: FileSystemAccess = new NodeFileSystemAccess(),
  ) {}

  async detect(): Promise<string> {
    if (this.env.GITHUB_HEAD_REF) {
      return this.env.GITHUB_HEAD_REF;
    }

    const fromEvent = this.readEventPayloadBranch();
    if (fromEvent) {
      return fromEvent;
    }

    const subject = await this.lastCommitSubject();
    const fromSubject = /.* from [^/]+\/(.+)$/.exec(subject);
    if (fromSubject) {
      return fromSubject[1];
    }

    return "";
  }

  private readEventPayloadBranch(): string {
    const eventPath = this.env.GITHUB_EVENT_PATH;
    if (!eventPath) {
      return "";
    }
    try {
      const payload = JSON.parse(this.files.readText(eventPath)) as EventPayload;
      return payload.pull_request?.head?.ref ?? payload.head_ref ?? "";
    } catch {
      return "";
    }
  }

  private async lastCommitSubject(): Promise<string> {
    try {
      const output = await getExecOutput("git", ["log", "-1", "--pretty=%s"], {
        silent: true,
        ignoreReturnCode: true,
      });
      return output.exitCode === 0 ? output.stdout.trim() : "";
    } catch {
      return "";
    }
  }
}
