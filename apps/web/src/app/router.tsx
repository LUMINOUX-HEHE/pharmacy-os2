import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/layout/app-shell";
import { useAuthStore } from "../features/auth/auth-store";
import { AnalyticsPage } from "../pages/app/analytics-page";
import { BillingHistoryPage } from "../pages/app/billing-history-page";
import { BillingPage } from "../pages/app/billing-page";
import { CustomersPage } from "../pages/app/customers-page";
import { CustomerDetailPage } from "../pages/app/customer-detail-page";
import { DashboardPage } from "../pages/app/dashboard-page";
import { DeliveryPage } from "../pages/app/delivery-page";
import { DistributorsPage } from "../pages/app/distributors-page";
import { InventoryPage } from "../pages/app/inventory-page";
import { OrdersPage } from "../pages/app/orders-page";
import { SettingsPage } from "../pages/app/settings-page";
import { StaffPosPage } from "../pages/app/staff-pos-page";
import { StorefrontPage } from "../pages/app/storefront-page";
import { ForgotPasswordPage } from "../pages/auth/forgot-password-page";
import { LoginPage } from "../pages/auth/login-page";
import { ResetPasswordPage } from "../pages/auth/reset-password-page";
import { SignupPage } from "../pages/auth/signup-page";
import { VerifyEmailPage } from "../pages/auth/verify-email-page";
import { ContactPage } from "../pages/public/contact-page";
import { FeaturesPage } from "../pages/public/features-page";
import { LandingPage } from "../pages/public/landing-page";
import { LegalPage } from "../pages/public/legal-page";
import { PricingPage } from "../pages/public/pricing-page";
import { PublicStorePage } from "../pages/public/store-page";


const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth/login" replace />;
};

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/privacy" element={<LegalPage type="privacy" />} />
      <Route path="/terms" element={<LegalPage type="terms" />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/auth/verify-email/:token" element={<VerifyEmailPage />} />
      <Route path="/store/:pharmacySlug" element={<PublicStorePage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/billing/history" element={<BillingHistoryPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/storefront" element={<StorefrontPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/distributors" element={<DistributorsPage />} />
        <Route path="/delivery" element={<DeliveryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/:tab" element={<SettingsPage />} />
        <Route path="/staff" element={<StaffPosPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
