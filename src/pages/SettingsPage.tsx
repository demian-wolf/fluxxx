import { useState, type FormEvent } from "react";
import {
  Bell,
  CreditCard,
  KeyRound,
  TriangleAlert,
  User as UserIcon,
} from "lucide-react";
import { api, IS_MOCK } from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";

const PROVIDER_KEY = "provider_flux_live_8x2kQ9fbN3wZ";

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [notif, setNotif] = useState({
    anomaly: true,
    lowBalance: true,
    suspension: true,
  });

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await api.updateProfile({ full_name: fullName, email });
      setUser(updated);
      toast("success", "Profile updated");
    } catch {
      toast("error", "Could not update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your operator account." />

      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-flux-cyan" /> Profile
              </span>
            }
          />
          <CardBody>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Change password" hint="Leave blank to keep current password.">
                <Input type="password" placeholder="••••••••" />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={savingProfile}>
                  Save changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-flux-violet" /> Mollie
              </span>
            }
          />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-line bg-bg-raised/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">Connected account</p>
                <p className="font-mono text-xs text-ink-muted">
                  {user?.mollie_customer_id ?? "Not connected"}
                </p>
              </div>
              <Badge tone="green" dot>
                connected
              </Badge>
            </div>
            <p className="text-xs text-ink-muted">
              Payment methods on file: iDEAL, Credit Card, Bancontact.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-flux-amber" /> Notifications
              </span>
            }
          />
          <CardBody className="space-y-1">
            <Toggle
              label="Anomaly alerts"
              description="Get notified when an agent's request is rejected."
              checked={notif.anomaly}
              onChange={(v) => setNotif((s) => ({ ...s, anomaly: v }))}
            />
            <Toggle
              label="Low balance"
              description="Alert when a wallet balance falls below threshold."
              checked={notif.lowBalance}
              onChange={(v) => setNotif((s) => ({ ...s, lowBalance: v }))}
            />
            <Toggle
              label="Agent suspension"
              description="Alert when an agent is auto-suspended."
              checked={notif.suspension}
              onChange={(v) => setNotif((s) => ({ ...s, suspension: v }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-flux-cyan" /> Provider API key
              </span>
            }
            subtitle="For paywall providers calling /tokens/verify"
          />
          <CardBody>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md bg-bg px-3 py-2 font-mono text-xs text-ink">
                {PROVIDER_KEY}
              </code>
              <CopyButton value={PROVIDER_KEY} />
            </div>
          </CardBody>
        </Card>

        <Card className="border-flux-red/30">
          <CardHeader
            title={
              <span className="flex items-center gap-2 text-flux-red">
                <TriangleAlert className="h-4 w-4" /> Danger zone
              </span>
            }
          />
          <CardBody className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-muted">
              Permanently delete your account and all wallets, agents, and
              ledger history.
            </p>
            <Button
              variant="danger"
              onClick={() =>
                toast(
                  "warning",
                  IS_MOCK ? "Disabled in demo" : "Confirmation required",
                  "Account deletion is not available in this build.",
                )
              }
            >
              Delete account
            </Button>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-2.5">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-flux-cyan" : "bg-bg-raised"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
