import type { AgentIdentity } from "@/types";

/** An agent enriched with its position in the spend tree. */
export interface AgentTreeNode {
  agent: AgentIdentity;
  depth: number;
  children: AgentTreeNode[];
}

/**
 * Build the parent/child forest from a flat list of agents. Agents whose
 * `parent_id` is null — or points at an agent not present in the list — become
 * roots, so the result always contains every agent exactly once. Roots and
 * children preserve the input ordering.
 */
export function buildAgentForest(agents: AgentIdentity[]): AgentTreeNode[] {
  const nodes = new Map<string, AgentTreeNode>();
  for (const agent of agents) {
    nodes.set(agent.id, { agent, depth: 0, children: [] });
  }

  const roots: AgentTreeNode[] = [];
  for (const agent of agents) {
    const node = nodes.get(agent.id)!;
    const parent = agent.parent_id ? nodes.get(agent.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const setDepth = (node: AgentTreeNode, depth: number) => {
    node.depth = depth;
    for (const child of node.children) setDepth(child, depth + 1);
  };
  for (const root of roots) setDepth(root, 0);

  return roots;
}

/**
 * Depth-first flatten of the forest into render order, skipping the subtrees of
 * any node whose id is in `collapsed`.
 */
export function flattenForest(
  forest: AgentTreeNode[],
  collapsed: Set<string>,
): AgentTreeNode[] {
  const out: AgentTreeNode[] = [];
  const walk = (node: AgentTreeNode) => {
    out.push(node);
    if (collapsed.has(node.agent.id)) return;
    for (const child of node.children) walk(child);
  };
  for (const root of forest) walk(root);
  return out;
}
