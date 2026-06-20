-- PlacePrep Supabase RLS policy record
-- Source of truth: live Supabase project nwjstaqudwpinfvmkcpp.
--
-- Applied migrations observed in Supabase:
--   20260614044132 enable_rls_and_policies_all_tables
--   20260619163613 add_placement_ops_rls_policies
--
-- This file documents the placement-operations policies added after the
-- original all-table RLS migration, so the repo reflects the live database
-- security posture.

alter table public.departments enable row level security;
alter table public.companies enable row level security;
alter table public.placement_drives enable row level security;
alter table public.drive_departments enable row level security;
alter table public.student_academics enable row level security;
alter table public.applications enable row level security;
alter table public.application_stages enable row level security;
alter table public.faculty_notes enable row level security;
alter table public.placement_offers enable row level security;
alter table public.audit_logs enable row level security;

alter function public.update_updated_at_column() set search_path = public;

drop policy if exists departments_select_authenticated on public.departments;
create policy departments_select_authenticated
on public.departments
for select
using (auth.role() = 'authenticated');

drop policy if exists departments_admin_manage on public.departments;
create policy departments_admin_manage
on public.departments
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists departments_service_manage on public.departments;
create policy departments_service_manage
on public.departments
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists companies_select_authenticated on public.companies;
create policy companies_select_authenticated
on public.companies
for select
using (auth.role() = 'authenticated');

drop policy if exists companies_admin_manage on public.companies;
create policy companies_admin_manage
on public.companies
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists companies_service_manage on public.companies;
create policy companies_service_manage
on public.companies
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists placement_drives_select_authenticated on public.placement_drives;
create policy placement_drives_select_authenticated
on public.placement_drives
for select
using (auth.role() = 'authenticated');

drop policy if exists placement_drives_admin_manage on public.placement_drives;
create policy placement_drives_admin_manage
on public.placement_drives
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists placement_drives_service_manage on public.placement_drives;
create policy placement_drives_service_manage
on public.placement_drives
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists drive_departments_select_authenticated on public.drive_departments;
create policy drive_departments_select_authenticated
on public.drive_departments
for select
using (auth.role() = 'authenticated');

drop policy if exists drive_departments_admin_manage on public.drive_departments;
create policy drive_departments_admin_manage
on public.drive_departments
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists drive_departments_service_manage on public.drive_departments;
create policy drive_departments_service_manage
on public.drive_departments
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists student_academics_select_own on public.student_academics;
create policy student_academics_select_own
on public.student_academics
for select
using (auth.uid() = user_id);

drop policy if exists student_academics_insert_own on public.student_academics;
create policy student_academics_insert_own
on public.student_academics
for insert
with check (auth.uid() = user_id);

drop policy if exists student_academics_update_own on public.student_academics;
create policy student_academics_update_own
on public.student_academics
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists student_academics_delete_own on public.student_academics;
create policy student_academics_delete_own
on public.student_academics
for delete
using (auth.uid() = user_id);

drop policy if exists student_academics_admin_manage on public.student_academics;
create policy student_academics_admin_manage
on public.student_academics
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists student_academics_service_manage on public.student_academics;
create policy student_academics_service_manage
on public.student_academics
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists applications_select_own on public.applications;
create policy applications_select_own
on public.applications
for select
using (auth.uid() = student_id);

drop policy if exists applications_insert_own on public.applications;
create policy applications_insert_own
on public.applications
for insert
with check (auth.uid() = student_id);

drop policy if exists applications_update_own on public.applications;
create policy applications_update_own
on public.applications
for update
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

drop policy if exists applications_delete_own on public.applications;
create policy applications_delete_own
on public.applications
for delete
using (auth.uid() = student_id);

drop policy if exists applications_admin_manage on public.applications;
create policy applications_admin_manage
on public.applications
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists applications_service_manage on public.applications;
create policy applications_service_manage
on public.applications
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists application_stages_select_own_application on public.application_stages;
create policy application_stages_select_own_application
on public.application_stages
for select
using (
  exists (
    select 1
    from public.applications a
    where a.id = application_stages.application_id
      and a.student_id = auth.uid()
  )
);

drop policy if exists application_stages_admin_manage on public.application_stages;
create policy application_stages_admin_manage
on public.application_stages
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists application_stages_service_manage on public.application_stages;
create policy application_stages_service_manage
on public.application_stages
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists faculty_notes_select_participant on public.faculty_notes;
create policy faculty_notes_select_participant
on public.faculty_notes
for select
using (auth.uid() = student_id or auth.uid() = faculty_id);

drop policy if exists faculty_notes_insert_own on public.faculty_notes;
create policy faculty_notes_insert_own
on public.faculty_notes
for insert
with check (auth.uid() = faculty_id);

drop policy if exists faculty_notes_update_own on public.faculty_notes;
create policy faculty_notes_update_own
on public.faculty_notes
for update
using (auth.uid() = faculty_id)
with check (auth.uid() = faculty_id);

drop policy if exists faculty_notes_delete_own on public.faculty_notes;
create policy faculty_notes_delete_own
on public.faculty_notes
for delete
using (auth.uid() = faculty_id);

drop policy if exists faculty_notes_admin_manage on public.faculty_notes;
create policy faculty_notes_admin_manage
on public.faculty_notes
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists faculty_notes_service_manage on public.faculty_notes;
create policy faculty_notes_service_manage
on public.faculty_notes
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists placement_offers_select_own on public.placement_offers;
create policy placement_offers_select_own
on public.placement_offers
for select
using (auth.uid() = student_id);

drop policy if exists placement_offers_admin_manage on public.placement_offers;
create policy placement_offers_admin_manage
on public.placement_offers
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists placement_offers_service_manage on public.placement_offers;
create policy placement_offers_service_manage
on public.placement_offers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists audit_logs_select_own_actor on public.audit_logs;
create policy audit_logs_select_own_actor
on public.audit_logs
for select
using (auth.uid() = actor_id);

drop policy if exists audit_logs_admin_manage on public.audit_logs;
create policy audit_logs_admin_manage
on public.audit_logs
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists audit_logs_service_manage on public.audit_logs;
create policy audit_logs_service_manage
on public.audit_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists billing_customers_select_own on public.billing_customers;
create policy billing_customers_select_own
on public.billing_customers
for select
using (auth.uid() = user_id);

drop policy if exists billing_customers_service_manage on public.billing_customers;
create policy billing_customers_service_manage
on public.billing_customers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists billing_subscriptions_select_own on public.billing_subscriptions;
create policy billing_subscriptions_select_own
on public.billing_subscriptions
for select
using (auth.uid() = user_id);

drop policy if exists billing_subscriptions_service_manage on public.billing_subscriptions;
create policy billing_subscriptions_service_manage
on public.billing_subscriptions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists billing_events_service_manage on public.billing_events;
create policy billing_events_service_manage
on public.billing_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
