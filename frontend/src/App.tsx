import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { WalletsPage } from "@/pages/WalletsPage";
import { WalletDetailPage } from "@/pages/WalletDetailPage";
import { DepositPage } from "@/pages/DepositPage";
import { DepositSuccessPage } from "@/pages/DepositSuccessPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { AgentNewPage } from "@/pages/AgentNewPage";
import { AgentDetailPage } from "@/pages/AgentDetailPage";
import { AgentPolicyPage } from "@/pages/AgentPolicyPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import { TransactionDetailPage } from "@/pages/TransactionDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { GcPage } from "@/pages/GcPage";
import { OobPage } from "@/pages/OobPage";
import { ForecastPage } from "@/pages/ForecastPage";
import { ReputationPage } from "@/pages/ReputationPage";
import { ApprovalPage } from "@/pages/ApprovalPage";
import { WebhooksPage } from "@/pages/WebhooksPage";
import { PluginsPage } from "@/pages/PluginsPage";
import { CurrencyPage } from "@/pages/CurrencyPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/wallets" element={<WalletsPage />} />
        <Route path="/wallets/:id" element={<WalletDetailPage />} />
        <Route path="/wallets/:id/deposit" element={<DepositPage />} />
        <Route path="/wallets/deposit/success" element={<DepositSuccessPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/new" element={<AgentNewPage />} />
        <Route path="/agents/:id" element={<AgentDetailPage />} />
        <Route path="/agents/:id/policy" element={<AgentPolicyPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
        <Route path="/gc" element={<GcPage />} />
        <Route path="/oob" element={<OobPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/reputation" element={<ReputationPage />} />
        <Route path="/approval" element={<ApprovalPage />} />
        <Route path="/webhooks" element={<WebhooksPage />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/currency" element={<CurrencyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
