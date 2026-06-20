import type {
  AgentStatus,
  LedgerStatus,
  MollieStatus,
  TxDecision,
  WalletStatus,
} from "@/types";
import { Badge, type BadgeTone } from "./Badge";

const walletTone: Record<WalletStatus, BadgeTone> = {
  active: "green",
  suspended: "amber",
  depleted: "red",
};

const agentTone: Record<AgentStatus, BadgeTone> = {
  active: "green",
  suspended: "amber",
  revoked: "red",
};

const decisionTone: Record<TxDecision, BadgeTone> = {
  approved: "green",
  pending: "amber",
  rejected: "red",
};

const ledgerTone: Record<LedgerStatus, BadgeTone> = {
  settled: "green",
  pending: "amber",
  failed: "red",
  reversed: "neutral",
};

const mollieTone: Record<MollieStatus, BadgeTone> = {
  paid: "green",
  pending: "amber",
  open: "blue",
  failed: "red",
  expired: "neutral",
};

export function WalletStatusBadge({ status }: { status: WalletStatus }) {
  return (
    <Badge tone={walletTone[status]} dot>
      {status}
    </Badge>
  );
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <Badge tone={agentTone[status]} dot>
      {status}
    </Badge>
  );
}

export function DecisionBadge({ decision }: { decision: TxDecision }) {
  return <Badge tone={decisionTone[decision]}>{decision}</Badge>;
}

export function LedgerStatusBadge({ status }: { status: LedgerStatus }) {
  return <Badge tone={ledgerTone[status]}>{status}</Badge>;
}

export function MollieStatusBadge({ status }: { status: MollieStatus }) {
  return <Badge tone={mollieTone[status]}>{status}</Badge>;
}
