import { Field, Input } from "@/components/ui/Input";
import type { PolicyFormValues } from "@/lib/policy";

export function PolicyFields({
  values,
  onChange,
}: {
  values: PolicyFormValues;
  onChange: (next: PolicyFormValues) => void;
}) {
  const set = (key: keyof PolicyFormValues, value: string) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="space-y-5">
      <div>
        <label className="label">Spend limits</label>
        <div className="grid gap-3 rounded-lg border border-line bg-bg-raised/30 p-4 sm:grid-cols-3">
          <Field label="Per transaction">
            <Input
              type="number"
              min="0"
              step="0.01"
              leading="€"
              value={values.perTx}
              onChange={(e) => set("perTx", e.target.value)}
            />
          </Field>
          <Field label="Hourly burn rate">
            <Input
              type="number"
              min="0"
              step="0.01"
              leading="€"
              value={values.hourly}
              onChange={(e) => set("hourly", e.target.value)}
            />
          </Field>
          <Field label="Daily limit">
            <Input
              type="number"
              min="0"
              step="0.01"
              leading="€"
              value={values.daily}
              onChange={(e) => set("daily", e.target.value)}
            />
          </Field>
        </div>
      </div>

      <Field
        label="Allowed domains (optional)"
        hint="Comma-separated. Leave blank to allow all domains."
      >
        <Input
          value={values.allowed}
          onChange={(e) => set("allowed", e.target.value)}
          placeholder="dataset.io, arxiv.org, openai.com"
        />
      </Field>

      <Field label="Blocked domains (optional)" hint="Comma-separated.">
        <Input
          value={values.blocked}
          onChange={(e) => set("blocked", e.target.value)}
          placeholder="gambling.com"
        />
      </Field>
    </div>
  );
}
