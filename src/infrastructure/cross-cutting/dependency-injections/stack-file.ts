/**
 * Composition root for stack-file resolution: wires the filesystem adapter
 * into the {@link StackFileResolver}'s workspace-file port.
 */
import { StackFileResolver } from "../../../application/core/stack-file-resolver";
import type { VariableSource } from "../../../domain";
import { NodeWorkspaceFileReader } from "../../data/file-system-repository/workspace-file-reader";

export function createStackFileResolver(env: VariableSource = process.env): StackFileResolver {
  return new StackFileResolver(new NodeWorkspaceFileReader(env));
}
