/**
 * Hand-written to match supabase/migrations exactly (Phase 1B tables only).
 * Shaped the same way `supabase gen types typescript` would generate it, so
 * swapping in a CLI-generated file later is a drop-in replacement — see
 * docs/supabase-setup.md for how to regenerate this against a real project.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type MemberRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'EDITOR' | 'VIEWER'
export type MemberStatus = 'ACTIVE' | 'INVITED' | 'DISABLED'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'
export type DocumentTemplateEnum = 'EXECUTIVE_CLASSIC' | 'MODERN_ACCENT' | 'MINIMAL_PRINT'
// Pass 2.1 — see supabase/migrations/20260719120000_company_logo_layout.sql
// and src/types/logoLayout.ts (the app-level equivalent, with clamp/slot
// helpers). Declared separately here, same reasoning as every other
// hand-mirrored enum-like text column in this file.
export type LogoPositionCode =
  | 'left_of_company_name'
  | 'header_left'
  | 'header_center'
  | 'header_right'
  | 'centered_logo_above_company'
  | 'hidden'
export type ResetPolicy = 'DAILY' | 'MONTHLY' | 'YEARLY' | 'NEVER'
export type DocumentTypeCode =
  | 'RFQ'
  | 'QUOTATION'
  | 'INVOICE'
  | 'TAX_INVOICE'
  | 'RECEIPT'
  | 'RECEIPT_TAX_INVOICE'
  | 'CREDIT_NOTE'
  | 'CREDIT_NOTE_TAX'
export type DocumentStatusCode = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED'
export type VatModeCode = 'NON_VAT' | 'VAT_EXCLUDED' | 'VAT_INCLUDED'
export type DiscountTypeCode = 'AMOUNT' | 'PERCENT'

// Named separately (not just inline under Tables.companies.Row) so it can
// also be reused as the create_company_with_owner RPC's Returns type below.
//
// Must be a `type` alias, not an `interface`: postgrest-js's generic
// inference relies on structural checks (e.g. against Record<string,
// unknown>) that only succeed for object type literals/aliases, which get
// an implicit index signature. `interface` doesn't get one, which silently
// broke `.from()`/`.rpc()` typing to `never` here — confirmed by bisecting
// in an isolated repro against the installed postgrest-js 2.110.0.
export type CompanyRow = {
  id: string
  // Nullable since Phase 1E: deleting the owner's account via the
  // delete-account Edge Function sets this to null (on delete set null)
  // rather than blocking the deletion or cascading into the company row
  // itself — see supabase/migrations/20260705120000_account_deletion_support.sql.
  owner_id: string | null
  name_th: string
  name_en: string | null
  company_code: string
  tax_id: string
  branch_code: string
  branch_name: string
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  contact_name: string | null
  document_template: DocumentTemplateEnum | null
  // Pass 2.1 additions — see
  // supabase/migrations/20260719120000_company_logo_layout.sql.
  logo_size: number
  logo_position: LogoPositionCode
  // Pass 4 addition — see
  // supabase/migrations/20260721120000_document_template_text_overrides.sql.
  template_text_overrides: Json
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
}

// Named separately so it can also be reused as approve_document()'s
// Returns type below — same `type` alias reasoning as CompanyRow above.
export type DocumentRow = {
  id: string
  company_id: string
  document_type: DocumentTypeCode
  status: DocumentStatusCode
  customer_code: string | null
  /** Null while DRAFT — only ever set by the approve_document() RPC. */
  document_number: string | null
  created_by: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  // Phase 4A additions — see
  // supabase/migrations/20260709120000_document_drafts.sql.
  customer_id: string | null
  vat_mode: VatModeCode
  issue_date: string
  due_date: string | null
  note: string | null
  document_discount_type: DiscountTypeCode
  document_discount_value: number
  subtotal: number
  discount_total: number
  vat_amount: number
  grand_total: number
  // Phase 4C additions — see
  // supabase/migrations/20260711120000_document_revisions.sql.
  parent_document_id: string | null
  revision_no: number | null
  // Phase 6A addition — see
  // supabase/migrations/20260712120000_document_conversion.sql.
  source_document_id: string | null
  // Production readiness pass 2 addition — see
  // supabase/migrations/20260717120000_document_installments.sql.
  installment_number: number | null
  // Pass 5B addition — see
  // supabase/migrations/20260722120000_document_soft_delete.sql. Only ever
  // set by the soft_delete_document() RPC (Pass 5C-B), never a direct
  // client UPDATE.
  deleted_at: string | null
  deleted_by: string | null
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: CompanyRow
        Insert: {
          id?: string
          owner_id: string
          name_th: string
          name_en?: string | null
          company_code: string
          tax_id: string
          branch_code?: string
          branch_name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          contact_name?: string | null
          document_template?: DocumentTemplateEnum | null
          logo_size?: number
          logo_position?: LogoPositionCode
          template_text_overrides?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Update: {
          id?: string
          owner_id?: string | null
          name_th?: string
          name_en?: string | null
          company_code?: string
          tax_id?: string
          branch_code?: string
          branch_name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          contact_name?: string | null
          document_template?: DocumentTemplateEnum | null
          logo_size?: number
          logo_position?: LogoPositionCode
          template_text_overrides?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: MemberRole
          status: MemberStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role: MemberRole
          status?: MemberStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: MemberRole
          status?: MemberStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          id: string
          company_id: string
          invited_email: string
          invited_role: MemberRole
          invited_by: string
          token_hash: string
          status: InvitationStatus
          expires_at: string
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          invited_email: string
          invited_role: MemberRole
          invited_by: string
          token_hash: string
          status?: InvitationStatus
          expires_at: string
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          invited_email?: string
          invited_role?: MemberRole
          invited_by?: string
          token_hash?: string
          status?: InvitationStatus
          expires_at?: string
          created_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          company_id: string
          // Nullable since Phase 1E: on delete set null once the acting
          // user's account is deleted — see
          // supabase/migrations/20260705120000_account_deletion_support.sql.
          // Ordinary client inserts still require a non-null actor_id
          // (audit_logs_insert_self_within_company checks actor_id =
          // auth.uid()); null only ever appears after that FK action fires.
          actor_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          actor_id: string
          action: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          actor_id?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      numbering_settings: {
        Row: {
          id: string
          company_id: string
          /** null = company-wide default; a specific type = override for that type only. */
          document_type: DocumentTypeCode | null
          pattern: string
          reset_policy: ResetPolicy
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          document_type?: DocumentTypeCode | null
          pattern: string
          reset_policy?: ResetPolicy
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          document_type?: DocumentTypeCode | null
          pattern?: string
          reset_policy?: ResetPolicy
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: DocumentRow
        Insert: {
          id?: string
          company_id: string
          document_type: DocumentTypeCode
          status?: DocumentStatusCode
          customer_code?: string | null
          document_number?: string | null
          created_by: string
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
          customer_id?: string | null
          vat_mode?: VatModeCode
          issue_date?: string
          due_date?: string | null
          note?: string | null
          document_discount_type?: DiscountTypeCode
          document_discount_value?: number
          subtotal?: number
          discount_total?: number
          vat_amount?: number
          grand_total?: number
          parent_document_id?: string | null
          revision_no?: number | null
          source_document_id?: string | null
          installment_number?: number | null
        }
        // Phase 4A added a scoped UPDATE grant/policy (Draft-only, status
        // and document_number pinned — see
        // supabase/migrations/20260709120000_document_drafts.sql), so this
        // type is exercised now, unlike the Phase 2C comment that used to
        // be here.
        Update: {
          id?: string
          company_id?: string
          document_type?: DocumentTypeCode
          status?: DocumentStatusCode
          customer_code?: string | null
          document_number?: string | null
          created_by?: string
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
          customer_id?: string | null
          vat_mode?: VatModeCode
          issue_date?: string
          due_date?: string | null
          note?: string | null
          document_discount_type?: DiscountTypeCode
          document_discount_value?: number
          subtotal?: number
          discount_total?: number
          vat_amount?: number
          grand_total?: number
          parent_document_id?: string | null
          revision_no?: number | null
          source_document_id?: string | null
          installment_number?: number | null
        }
        Relationships: []
      }
      document_items: {
        Row: {
          id: string
          document_id: string
          description: string
          quantity: number
          unit: string | null
          unit_price: number
          discount_type: DiscountTypeCode
          discount_value: number
          amount: number
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          description: string
          quantity?: number
          unit?: string | null
          unit_price?: number
          discount_type?: DiscountTypeCode
          discount_value?: number
          amount?: number
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          description?: string
          quantity?: number
          unit?: string | null
          unit_price?: number
          discount_type?: DiscountTypeCode
          discount_value?: number
          amount?: number
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      numbering_sequences: {
        Row: {
          id: string
          company_id: string
          document_type: DocumentTypeCode
          sequence_key: string
          running_number: number
          created_at: string
          updated_at: string
        }
        // No Insert/Update is exercised by the app — every write happens
        // inside approve_document()'s security definer privileges, never a
        // direct client call (select-only grant, see the Phase 2C migration).
        Insert: {
          id?: string
          company_id: string
          document_type: DocumentTypeCode
          sequence_key: string
          running_number?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          document_type?: DocumentTypeCode
          sequence_key?: string
          running_number?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          company_id: string
          customer_code: string
          name: string
          tax_id: string | null
          branch: string | null
          address: string | null
          phone: string | null
          email: string | null
          contact_name: string | null
          note: string | null
          created_by: string
          created_at: string
          updated_at: string
          deleted_at: string | null
          deleted_by: string | null
        }
        Insert: {
          id?: string
          company_id: string
          customer_code: string
          name: string
          tax_id?: string | null
          branch?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          contact_name?: string | null
          note?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          customer_code?: string
          name?: string
          tax_id?: string | null
          branch?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          contact_name?: string | null
          note?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Relationships: []
      }
      signature_slots: {
        Row: {
          id: string
          company_id: string
          label: string
          sort_order: number
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          label: string
          sort_order?: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          label?: string
          sort_order?: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_installments: {
        Row: {
          id: string
          document_id: string
          installment_no: number
          amount_type: 'PERCENT' | 'FIXED'
          amount_value: number
          computed_amount: number
          due_date: string | null
          note: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          installment_no: number
          amount_type?: 'PERCENT' | 'FIXED'
          amount_value?: number
          computed_amount?: number
          due_date?: string | null
          note?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          installment_no?: number
          amount_type?: 'PERCENT' | 'FIXED'
          amount_value?: number
          computed_amount?: number
          due_date?: string | null
          note?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    // No views yet — kept as an empty record because supabase-js's
    // GenericSchema constraint requires every table to have a
    // `Relationships` array and Tables/Views/Functions to all be present on
    // the schema, or it silently falls back to `never` for insert/update/
    // rpc argument types instead of a helpful type error.
    Views: Record<string, never>
    Functions: {
      // Phase 1C: atomically inserts the company row and the caller's
      // OWNER company_members row in one transaction (see
      // supabase/migrations/20260703120000_create_company_with_owner.sql).
      // security invoker — it still goes through the normal RLS policies
      // on both tables, it just wraps them in a single round trip so a
      // failure on the second insert rolls back the first.
      create_company_with_owner: {
        Args: {
          p_name_th: string
          p_name_en: string | null
          p_company_code: string
          p_tax_id: string
          p_address: string | null
          p_phone: string | null
          p_email: string | null
          p_contact_name: string | null
          p_logo_url: string | null
        }
        Returns: CompanyRow
      }
      // Phase 1D: validates the invite token hash + email match + no
      // existing membership, then atomically creates the ACTIVE
      // company_members row and marks the invitation ACCEPTED (see
      // supabase/migrations/20260704120000_accept_invitation.sql).
      // security definer — the invited user isn't the company owner, so it
      // intentionally bypasses invitations/company_members RLS after
      // re-validating everything itself.
      accept_invitation: {
        Args: {
          p_token_hash: string
        }
        Returns: CompanyRow
      }
      // Phase 2C: validates the caller's role, resolves the effective
      // numbering_settings row (override or company default), atomically
      // increments numbering_sequences, renders the pattern, and retries up
      // to 3 times on a unique_violation before assigning document_number
      // and flipping status to APPROVED (see
      // supabase/migrations/20260707120000_document_numbering_generation.sql).
      // security definer — approving isn't the document owner's own row
      // insert like Phase 1C's bootstrap case, and numbering_sequences has
      // no client-facing write grant at all, so this needs elevated
      // privilege the same way accept_invitation does.
      approve_document: {
        Args: {
          p_document_id: string
        }
        Returns: DocumentRow
      }
      // Phase 4B: APPROVED -> PAID, same role-check/security-definer shape
      // as approve_document (see
      // supabase/migrations/20260710120000_document_status_actions.sql).
      mark_document_paid: {
        Args: {
          p_document_id: string
        }
        Returns: DocumentRow
      }
      // Phase 4B: APPROVED -> CANCELLED, same shape as mark_document_paid.
      cancel_document: {
        Args: {
          p_document_id: string
        }
        Returns: DocumentRow
      }
      // Phase 4C: copies an APPROVED, non-revision document into a new
      // Draft with parent_document_id set (customer/items/VAT mode/note/
      // due_date/document type/totals copied verbatim) — see
      // supabase/migrations/20260711120000_document_revisions.sql.
      // security definer for the same reason as the other document RPCs:
      // documents_insert_editors' with check forbids a direct client
      // insert from ever setting parent_document_id itself.
      create_document_revision: {
        Args: {
          p_document_id: string
        }
        Returns: DocumentRow
      }
      // Phase 6A: copies an APPROVED document into a new Draft of a
      // *different* document_type (customer/items/VAT mode/note/due_date/
      // totals copied verbatim, source_document_id set), only when
      // is_valid_document_conversion(source_type, target_type) allows it
      // — see supabase/migrations/20260712120000_document_conversion.sql.
      create_document_conversion: {
        Args: {
          p_document_id: string
          p_target_type: string
        }
        Returns: DocumentRow
      }
      // Pass 5C-B: soft-deletes a document (sets deleted_at/deleted_by
      // only — never touches status/document_number/paid fields/
      // conversion-or-revision lineage) — see
      // supabase/migrations/20260723120000_soft_delete_document_rpc.sql.
      soft_delete_document: {
        Args: {
          p_document_id: string
        }
        Returns: DocumentRow
      }
    }
    Enums: {
      member_role: MemberRole
      member_status: MemberStatus
      invitation_status: InvitationStatus
      document_template: DocumentTemplateEnum
      numbering_reset_policy: ResetPolicy
    }
  }
}
