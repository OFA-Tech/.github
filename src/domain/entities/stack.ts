/**
 * Stack entity: the domain's normalized view of a deployed stack.
 *
 * Transport quirks (duplicate `Id`/`ID` casings, numeric type codes, raw
 * `GitConfig` payloads) are resolved at the infrastructure boundary before a
 * `Stack` is created, so everything in here can be unit tested without HTTP.
 */
import type { ResolvedStackType } from "../enums/stack-type";
import { PreconditionError } from "../shared-utils/errors";

export interface StackProps {
  id: string;
  name: string;
  type: ResolvedStackType;
  endpointId: string;
  version?: number;
  isGitBacked: boolean;
}

export class Stack {
  readonly id: string;
  readonly name: string;
  readonly type: ResolvedStackType;
  readonly endpointId: string;
  readonly version?: number;
  readonly isGitBacked: boolean;

  private constructor(props: StackProps) {
    this.id = props.id;
    this.name = props.name;
    this.type = props.type;
    this.endpointId = props.endpointId;
    this.version = props.version;
    this.isGitBacked = props.isGitBacked;
  }

  static create(props: StackProps): Stack {
    if (!props.id) {
      throw new PreconditionError("A stack cannot be created without an ID");
    }
    return new Stack(props);
  }
}
