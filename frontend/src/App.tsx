import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { HomePage } from "@/pages/HomePage";
import { WalletDetailPage } from "@/pages/WalletDetailPage";
import { DepositPage } from "@/pages/DepositPage";
import { DepositSuccessPage } from "@/pages/DepositSuccessPage";
import { AgentNewPage } from "@/pages/AgentNewPage";
import { AgentDetailPage } from "@/pages/AgentDetailPage";
import { AgentPolicyPage } from "@/pages/AgentPolicyPage";
import { AssetsPage } from "@/pages/AssetsPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import { TransactionDetailPage } from "@/pages/TransactionDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { GovernancePage } from "@/pages/GovernancePage";
import { PolicyPage } from "@/pages/PolicyPage";
import { IntegrationsPage } from "@/pages/IntegrationsPage";
import { FinancePage } from "@/pages/FinancePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/wallets" element={<AssetsPage initialTab="wallets" />} />
        <Route path="/wallets/:id" element={<WalletDetailPage />} />
        <Route path="/wallets/:id/deposit" element={<DepositPage />} />
        <Route path="/wallets/deposit/success" element={<DepositSuccessPage />} />
        <Route path="/agents" element={<AssetsPage initialTab="agents" />} />
        <Route path="/agents/new" element={<AgentNewPage />} />
        <Route path="/agents/:id" element={<AgentDetailPage />} />
        <Route path="/agents/:id/policy" element={<AgentPolicyPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />

        {/* Composite tabbed pages */}
        <Route path="/governance" element={<GovernancePage />} />
        <Route path="/oob" element={<GovernancePage initialTab="oob" />} />
        <Route path="/gc" element={<GovernancePage initialTab="gc" />} />
        <Route path="/forecast" element={<GovernancePage initialTab="forecast" />} />
        <Route path="/approval" element={<GovernancePage initialTab="approval" />} />

        <Route path="/policy" element={<PolicyPage />} />
        <Route path="/plugins" element={<PolicyPage initialTab="plugins" />} />
        <Route path="/agent-access" element={<PolicyPage initialTab="access" />} />
        <Route path="/agent-access/authorize" element={<PolicyPage initialTab="access" />} />
        <Route path="/reputation" element={<PolicyPage initialTab="reputation" />} />

        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/devin" element={<IntegrationsPage initialTab="devin" />} />
        <Route path="/webhooks" element={<IntegrationsPage initialTab="webhooks" />} />

        <Route path="/finance" element={<FinancePage />} />
        <Route path="/billing" element={<FinancePage initialTab="billing" />} />
        <Route path="/currency" element={<FinancePage initialTab="currency" />} />
        <Route path="/providers" element={<FinancePage initialTab="providers" />} />
        <Route path="/licensing" element={<FinancePage initialTab="licensing" />} />

        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
