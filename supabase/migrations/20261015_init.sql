-- AI Film Studio initial schema
-- Tables: profiles, shows, characters, worlds, episodes, scenes, generation_jobs, waitlist
-- Storage buckets: covers (public), character-refs (private), episode-videos (public)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- shows
create table public.shows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  logline text,
  genre text,
  status text not null default 'draft'
    check (status in ('draft', 'in_production', 'published')),
  cover_image_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shows_touch on public.shows;
create trigger shows_touch
  before update on public.shows
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- characters (the series bible: locked cast)
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  name text not null,
  description text,
  reference_image_url text,
  created_at timestamptz default now() not null
);

-- ---------------------------------------------------------------- worlds (the series bible: locked locations)
create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  name text not null,
  description text,
  reference_image_url text,
  created_at timestamptz default now() not null
);

-- ---------------------------------------------------------------- episodes
create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  episode_number int not null,
  title text not null,
  synopsis text,
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'published')),
  video_url text,
  thumbnail_url text,
  created_at timestamptz default now() not null,
  unique (show_id, episode_number)
);

-- ---------------------------------------------------------------- scenes
create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  scene_number int not null,
  prompt text not null,
  character_ids uuid[] not null default '{}',
  world_id uuid references public.worlds(id) on delete set null,
  reference_image_url text,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'processing', 'ready', 'failed')),
  video_url text,
  created_at timestamptz default now() not null,
  unique (episode_id, scene_number)
);

-- ---------------------------------------------------------------- generation_jobs
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  provider_task_id text,
  model text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  error text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

drop trigger if exists generation_jobs_touch on public.generation_jobs;
create trigger generation_jobs_touch
  before update on public.generation_jobs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- waitlist (Phase 0 validation)
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role text not null default 'creator' check (role in ('creator', 'viewer')),
  created_at timestamptz default now() not null
);

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.shows enable row level security;
alter table public.characters enable row level security;
alter table public.worlds enable row level security;
alter table public.episodes enable row level security;
alter table public.scenes enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.waitlist enable row level security;

-- profiles: public read, owners update their own
create policy "profiles readable by everyone"
  on public.profiles for select using (true);
create policy "owners update own profile"
  on public.profiles for update using (auth.uid() = id);

-- shows: owners full access, everyone reads published
create policy "owners manage own shows"
  on public.shows for all using (auth.uid() = owner_id);
create policy "published shows are public"
  on public.shows for select using (status = 'published');

-- characters: owner access via show, public when show published
create policy "owners manage show characters"
  on public.characters for all using (
    exists (select 1 from public.shows s where s.id = characters.show_id and s.owner_id = auth.uid())
  );
create policy "characters of published shows are public"
  on public.characters for select using (
    exists (select 1 from public.shows s where s.id = characters.show_id and s.status = 'published')
  );

-- worlds: same pattern
create policy "owners manage show worlds"
  on public.worlds for all using (
    exists (select 1 from public.shows s where s.id = worlds.show_id and s.owner_id = auth.uid())
  );
create policy "worlds of published shows are public"
  on public.worlds for select using (
    exists (select 1 from public.shows s where s.id = worlds.show_id and s.status = 'published')
  );

-- episodes: owner access, public reads published
create policy "owners manage show episodes"
  on public.episodes for all using (
    exists (select 1 from public.shows s where s.id = episodes.show_id and s.owner_id = auth.uid())
  );
create policy "published episodes are public"
  on public.episodes for select using (status = 'published');

-- scenes: owner access via episode -> show, public when episode published
create policy "owners manage episode scenes"
  on public.scenes for all using (
    exists (
      select 1 from public.episodes e
      join public.shows s on s.id = e.show_id
      where e.id = scenes.episode_id and s.owner_id = auth.uid()
    )
  );
create policy "scenes of published episodes are public"
  on public.scenes for select using (
    exists (select 1 from public.episodes e where e.id = scenes.episode_id and e.status = 'published')
  );

-- generation_jobs: owner only, via scene -> episode -> show
create policy "owners manage own generation jobs"
  on public.generation_jobs for all using (
    exists (
      select 1 from public.scenes sc
      join public.episodes e on e.id = sc.episode_id
      join public.shows s on s.id = e.show_id
      where sc.id = generation_jobs.scene_id and s.owner_id = auth.uid()
    )
  );

-- waitlist: anyone can join, nobody reads (service_role bypasses RLS)
create policy "anyone can join the waitlist"
  on public.waitlist for insert with check (true);

-- ---------------------------------------------------------------- storage buckets
insert into storage.buckets (id, name, public)
values
  ('covers', 'covers', true),
  ('character-refs', 'character-refs', false),
  ('episode-videos', 'episode-videos', true)
on conflict (id) do nothing;

-- covers: public read, authenticated write
create policy "covers public read"
  on storage.objects for select using (bucket_id = 'covers');
create policy "authenticated write covers"
  on storage.objects for insert with check (bucket_id = 'covers' and auth.role() = 'authenticated');
create policy "authenticated update covers"
  on storage.objects for update using (bucket_id = 'covers' and auth.role() = 'authenticated');

-- character-refs: owner-only read/write (private bucket)
create policy "owners read character refs"
  on storage.objects for select using (bucket_id = 'character-refs' and auth.role() = 'authenticated');
create policy "owners write character refs"
  on storage.objects for insert with check (bucket_id = 'character-refs' and auth.role() = 'authenticated');
create policy "owners delete character refs"
  on storage.objects for delete using (bucket_id = 'character-refs' and auth.role() = 'authenticated');

-- episode-videos: public read, authenticated write
create policy "episode videos public read"
  on storage.objects for select using (bucket_id = 'episode-videos');
create policy "authenticated write episode videos"
  on storage.objects for insert with check (bucket_id = 'episode-videos' and auth.role() = 'authenticated');

-- ---------------------------------------------------------------- indexes
create index if not exists shows_owner_idx on public.shows (owner_id);
create index if not exists characters_show_idx on public.characters (show_id);
create index if not exists worlds_show_idx on public.worlds (show_id);
create index if not exists episodes_show_idx on public.episodes (show_id);
create index if not exists scenes_episode_idx on public.scenes (episode_id);
create index if not exists jobs_scene_idx on public.generation_jobs (scene_id);
create index if not exists jobs_task_idx on public.generation_jobs (provider_task_id);
