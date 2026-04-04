create table if not exists public.user_trip_preferences (
  owner_user_id uuid primary key,
  today_trip_id text,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_trip_preferences_today_trip_idx
  on public.user_trip_preferences (today_trip_id);

alter table public.user_trip_preferences enable row level security;

create policy "Users can read their own trip preferences"
  on public.user_trip_preferences
  for select
  using (auth.uid() = owner_user_id);

create policy "Users can insert their own trip preferences"
  on public.user_trip_preferences
  for insert
  with check (auth.uid() = owner_user_id);

create policy "Users can update their own trip preferences"
  on public.user_trip_preferences
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create policy "Users can delete their own trip preferences"
  on public.user_trip_preferences
  for delete
  using (auth.uid() = owner_user_id);
