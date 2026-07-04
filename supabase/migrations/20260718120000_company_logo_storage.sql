-- Production readiness pass 2: Company Logo Storage
--
-- companies.logo_url already exists (Phase 1B) but nothing ever wrote to
-- it. Public-read bucket (a logo isn't sensitive data), owner-write-only,
-- scoped by path: files live at `${company_id}/logo.<ext>` so the write
-- policy can authorize from the path alone, without needing a lookup into
-- companies for the write policy. insert into storage.buckets in a plain
-- SQL migration is the standard, documented Supabase pattern --
-- storage.buckets is an ordinary table owned by the storage extension,
-- present in every project; no CLI/dashboard step is required for bucket
-- creation itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

-- Public read (the bucket's public=true flag already covers anon/CDN GET,
-- but storage.objects has RLS enabled by default on every project, so an
-- explicit SELECT policy is still needed for authenticated in-app reads,
-- e.g. a settings page fetching the current logo to preview it).
create policy "company_logos_public_select"
on storage.objects
for select
to public
using (bucket_id = 'company-logos');

-- Write access: only an ACTIVE OWNER of the company whose id is the first
-- path segment (storage.foldername splits the object name on '/', so
-- foldername(name)[1] is the company_id prefix every upload must use,
-- e.g. '11111111-.../logo.png').
create policy "company_logos_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-logos'
  and public.is_company_owner((storage.foldername(name))[1]::uuid)
);

create policy "company_logos_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-logos'
  and public.is_company_owner((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'company-logos'
  and public.is_company_owner((storage.foldername(name))[1]::uuid)
);

create policy "company_logos_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-logos'
  and public.is_company_owner((storage.foldername(name))[1]::uuid)
);
