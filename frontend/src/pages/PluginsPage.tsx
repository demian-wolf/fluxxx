import { useCallback } from "react";
import { Puzzle, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useRefreshOnFocus } from "@/hooks/useInterval";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import type { PolicyPluginInfo } from "@/types";

export function PluginsPage() {
  const { toast } = useToast();
  const plugins = useAsync(() => api.listPlugins(), []);

  const refreshAll = useCallback(() => { plugins.refresh(); }, [plugins]);
  useRefreshOnFocus(refreshAll);

  const handleToggle = async (plugin: PolicyPluginInfo) => {
    try {
      await api.togglePlugin(plugin.id, !plugin.enabled);
      toast("success", `${plugin.name} ${plugin.enabled ? "disabled" : "enabled"}`);
      refreshAll();
    } catch {
      toast("error", "Failed to toggle plugin");
    }
  };

  if (plugins.loading && !plugins.data) return <LoadingState label="Loading plugins..." />;

  return (
    <>
      <PageHeader
        title="Policy Plugins"
        subtitle="Custom rule evaluators that extend the KYA Policy Engine. Enable or disable to control agent spend behavior."
      />

      {!plugins.data?.length ? (
        <Card className="p-6"><EmptyState icon={Puzzle} title="No plugins" description="No policy plugins registered." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {plugins.data.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </>
  );
}

function PluginCard({ plugin, onToggle }: { plugin: PolicyPluginInfo; onToggle: (p: PolicyPluginInfo) => void }) {
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-flux-violet" />
            <span className="text-sm font-semibold text-ink">{plugin.name}</span>
          </div>
          <button onClick={() => onToggle(plugin)} className="transition hover:opacity-80">
            {plugin.enabled ? (
              <ToggleRight className="h-6 w-6 text-flux-green" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-ink-muted" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">{plugin.description}</p>
        <div className="mt-3 flex items-center gap-2">
          <Badge tone={plugin.enabled ? "green" : "neutral"}>{plugin.enabled ? "Active" : "Disabled"}</Badge>
          <Badge tone="neutral">Priority: {plugin.priority}</Badge>
        </div>
        {Object.keys(plugin.config).length > 0 && (
          <div className="mt-3 rounded bg-bg-raised/50 p-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted mb-1">Config</div>
            <pre className="text-xs text-ink-muted font-mono whitespace-pre-wrap">{JSON.stringify(plugin.config, null, 2)}</pre>
          </div>
        )}
      </div>
    </Card>
  );
}
