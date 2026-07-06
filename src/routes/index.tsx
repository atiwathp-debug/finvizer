import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PlaceholderPage } from '@/components/shared/PlaceholderPage'
import { AppShell } from '@/components/layout/AppShell'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { SettingsLayout } from '@/components/layout/SettingsLayout'
import { RootLayout } from '@/components/layout/RootLayout'
import { RequireAuth } from '@/components/layout/RequireAuth'
import { RedirectIfAuthed } from '@/components/layout/RedirectIfAuthed'
import { RequireCompany } from '@/components/layout/RequireCompany'
import { RequireNoCompany } from '@/components/layout/RequireNoCompany'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { CompanyOnboardingPage } from '@/features/company/CompanyOnboardingPage'
import { TemplateSelectionPage } from '@/features/company/TemplateSelectionPage'
import { InviteAcceptPage } from '@/features/members/InviteAcceptPage'
import { LazyDashboardPage } from '@/features/dashboard/LazyDashboardPage'
import { DocumentsPage } from '@/features/documents/DocumentsPage'
import { DocumentFormPage } from '@/features/documents/DocumentFormPage'
import { DocumentDetailPage } from '@/features/documents/DocumentDetailPage'
import { DocumentPrintPage } from '@/features/documents/DocumentPrintPage'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { CompanySettingsPage } from '@/features/company/CompanySettingsPage'
import { MembersSettingsPage } from '@/features/members/MembersSettingsPage'
import { TemplateSettingsPage } from '@/features/templates/TemplateSettingsPage'
import { TemplateTextSettingsPage } from '@/features/templates/TemplateTextSettingsPage'
import { SignatureSettingsPage } from '@/features/signatures/SignatureSettingsPage'
import { NumberingSettingsPage } from '@/features/numbering/NumberingSettingsPage'
import { PrivacySettingsPage } from '@/features/privacy/PrivacySettingsPage'
import { AuditLogPage } from '@/features/privacy/AuditLogPage'

const page = (title: string, description: string) => (
  <PlaceholderPage title={title} description={description} />
)

/**
 * Route map mirrors the CLAUDE.md spec's route list. As of Phase 6A every
 * route is backed by a real feature — the only PlaceholderPage left is the
 * catch-all 404 below.
 */
export const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      children: [
        { path: '/', element: <Navigate to="/login" replace /> },

        // Login/Register — Phase 1A. Guest-only: already-authenticated
        // users are bounced to /dashboard.
        {
          element: <RedirectIfAuthed />,
          children: [
            {
              element: <AuthLayout />,
              children: [
                { path: '/login', element: <LoginPage /> },
                { path: '/register', element: <RegisterPage /> },
              ],
            },
          ],
        },

        // Forgot/Reset password and invite accept stay reachable regardless
        // of auth state — a password-recovery link legitimately establishes
        // a session, and InviteAcceptPage handles both logged-out (redirect
        // to Login/Register with `from` state) and logged-in cases itself.
        {
          element: <AuthLayout />,
          children: [
            { path: '/forgot-password', element: <ForgotPasswordPage /> },
            { path: '/reset-password', element: <ResetPasswordPage /> },
            { path: '/invite/:token', element: <InviteAcceptPage /> },
          ],
        },

        // Requires auth. Onboarding/company and the main app additionally
        // branch on whether the user has a company yet.
        {
          element: <RequireAuth />,
          children: [
            // Company creation — Phase 1C. Wider card; only reachable
            // without an existing company (1 user = 1 company).
            {
              element: <RequireNoCompany />,
              children: [
                {
                  element: <AuthLayout widthClassName="max-w-2xl" />,
                  children: [{ path: '/onboarding/company', element: <CompanyOnboardingPage /> }],
                },
              ],
            },

            // Template selection — Phase 2A. Reached right after onboarding
            // (company exists, document_template is still null) and
            // whenever RequireCompany's template gate redirects here, so
            // it's intentionally not gated by RequireCompany/RequireNoCompany
            // itself (RequireCompany is what sends users *to* this route).
            {
              element: <AuthLayout widthClassName="max-w-4xl" />,
              children: [{ path: '/onboarding/template', element: <TemplateSelectionPage /> }],
            },

            // Main app — Phase 0B mock UI onward. Requires an existing company.
            {
              element: <RequireCompany />,
              children: [
                // Print/export view — deliberately outside AppShell (no
                // sidebar/topbar/toast) so "printing" this route already
                // captures just the document sheet, nothing else. Renders
                // the exact same <DocumentPreview> as the detail page — see
                // DocumentPrintPage.tsx.
                { path: '/documents/:id/print', element: <DocumentPrintPage /> },
                {
                  element: <AppShell />,
                  children: [
                    { path: '/dashboard', element: <LazyDashboardPage /> },
                    { path: '/customers', element: <CustomersPage /> },
                    { path: '/documents', element: <DocumentsPage /> },
                    { path: '/documents/new', element: <DocumentFormPage /> },
                    { path: '/documents/:id', element: <DocumentDetailPage /> },
                    { path: '/documents/:id/edit', element: <DocumentFormPage /> },
                    // The revision timeline shipped inside DocumentDetailPage
                    // itself (Phase 4C's "ประวัติ Revision" panel), not as a
                    // separate route — redirect rather than 404 in case
                    // anything old links here.
                    { path: '/documents/:id/revisions', element: <Navigate to=".." relative="path" replace /> },
                    {
                      path: '/settings',
                      element: <SettingsLayout />,
                      children: [
                        { index: true, element: <Navigate to="/settings/company" replace /> },
                        { path: '/settings/company', element: <CompanySettingsPage /> },
                        { path: '/settings/members', element: <MembersSettingsPage /> },
                        { path: '/settings/templates', element: <TemplateSettingsPage /> },
                        { path: '/settings/template-text', element: <TemplateTextSettingsPage /> },
                        { path: '/settings/signatures', element: <SignatureSettingsPage /> },
                        { path: '/settings/numbering', element: <NumberingSettingsPage /> },
                        { path: '/settings/privacy', element: <PrivacySettingsPage /> },
                        { path: '/settings/audit-logs', element: <AuditLogPage /> },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },

        {
          path: '*',
          element: page('ไม่พบหน้าที่ต้องการ', 'กรุณาตรวจสอบ URL อีกครั้ง'),
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)
