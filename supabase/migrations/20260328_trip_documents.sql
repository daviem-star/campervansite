create table if not exists public.trip_documents (
  owner_user_id uuid not null,
  trip_id text not null,
  trip_name text not null,
  version integer not null default 1,
  trip_data jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_synced_at timestamptz,
  primary key (owner_user_id, trip_id)
);

create index if not exists trip_documents_owner_updated_idx
  on public.trip_documents (owner_user_id, updated_at desc);

alter table public.trip_documents enable row level security;

create policy "Users can read their own trip documents"
  on public.trip_documents
  for select
  using (auth.uid() = owner_user_id);

create policy "Users can insert their own trip documents"
  on public.trip_documents
  for insert
  with check (auth.uid() = owner_user_id);

create policy "Users can update their own trip documents"
  on public.trip_documents
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create policy "Users can delete their own trip documents"
  on public.trip_documents
  for delete
  using (auth.uid() = owner_user_id);
