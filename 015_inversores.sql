-- Belfast Desarrollos · Inversores (V+V Supabase)
create table if not exists inv_admins (email text primary key);
insert into inv_admins(email) values ('vvconstrucciones@yahoo.com.ar'),('nexoentorno@gmail.com') on conflict do nothing;

create or replace function inv_soy_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from inv_admins where lower(email)=lower(coalesce(auth.jwt()->>'email','')));
$$;
grant execute on function inv_soy_admin() to anon, authenticated;

create table if not exists inv_content (id int primary key, content jsonb not null, updated_at timestamptz not null default now(), updated_by text not null default '');
create table if not exists inv_media (id bigserial primary key, object_key text not null, file_name text not null, content_type text not null, size bigint not null default 0, category text not null default 'Proyecto', title text not null default '', caption text not null default '', sort_order bigint not null default 0, created_at timestamptz not null default now());
create table if not exists inv_surveys (id bigserial primary key, answers jsonb not null, created_at timestamptz not null default now(), constraint inv_surveys_chk check (answers->>'consent'='true' and length(answers::text) < 9000));

alter table inv_admins enable row level security;
alter table inv_content enable row level security;
alter table inv_media enable row level security;
alter table inv_surveys enable row level security;

drop policy if exists inv_content_read on inv_content; create policy inv_content_read on inv_content for select using (true);
drop policy if exists inv_content_write on inv_content; create policy inv_content_write on inv_content for all using (inv_soy_admin()) with check (inv_soy_admin());
drop policy if exists inv_media_read on inv_media; create policy inv_media_read on inv_media for select using (true);
drop policy if exists inv_media_write on inv_media; create policy inv_media_write on inv_media for all using (inv_soy_admin()) with check (inv_soy_admin());
drop policy if exists inv_surveys_insert on inv_surveys; create policy inv_surveys_insert on inv_surveys for insert with check (true);
drop policy if exists inv_surveys_read on inv_surveys; create policy inv_surveys_read on inv_surveys for select using (inv_soy_admin());

insert into storage.buckets (id, name, public, file_size_limit) values ('inversores','inversores',true,31457280) on conflict (id) do update set public=true;
drop policy if exists inv_obj_read on storage.objects; create policy inv_obj_read on storage.objects for select using (bucket_id='inversores');
drop policy if exists inv_obj_ins on storage.objects; create policy inv_obj_ins on storage.objects for insert with check (bucket_id='inversores' and inv_soy_admin());
drop policy if exists inv_obj_del on storage.objects; create policy inv_obj_del on storage.objects for delete using (bucket_id='inversores' and inv_soy_admin());
