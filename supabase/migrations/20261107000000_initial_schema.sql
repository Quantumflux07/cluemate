-- =============================================================================
-- ClueMate Database Schema, RLS Policies, and Atomic RPC Functions
-- =============================================================================

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Profiles Table
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- -----------------------------------------------------------------------------
-- 2. Rooms Table
-- -----------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code varchar(6) unique not null,
  operator_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('active', 'ended')) default 'active',
  current_poll_version int not null default 1,
  current_question_number int not null default 1,
  timer_started_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- -----------------------------------------------------------------------------
-- 3. Room Members Table
-- -----------------------------------------------------------------------------
create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('operator', 'participant')) default 'participant',
  joined_at timestamptz default now() not null,
  constraint room_user_uniq unique (room_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 4. Poll Responses Table
-- -----------------------------------------------------------------------------
create table if not exists public.poll_responses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  poll_version int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response_type text not null check (response_type in ('allocation', 'dont_know')),
  allocation_a int not null default 0 check (allocation_a between 0 and 100 and allocation_a % 25 = 0),
  allocation_b int not null default 0 check (allocation_b between 0 and 100 and allocation_b % 25 = 0),
  allocation_c int not null default 0 check (allocation_c between 0 and 100 and allocation_c % 25 = 0),
  allocation_d int not null default 0 check (allocation_d between 0 and 100 and allocation_d % 25 = 0),
  committed_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint poll_responses_room_version_user_uniq unique (room_id, poll_version, user_id),
  constraint valid_allocation_rule check (
    (
      response_type = 'dont_know' and
      allocation_a = 0 and
      allocation_b = 0 and
      allocation_c = 0 and
      allocation_d = 0
    )
    or
    (
      response_type = 'allocation' and
      (allocation_a + allocation_b + allocation_c + allocation_d) = 100
    )
  )
);

-- -----------------------------------------------------------------------------
-- Indexes for Performance & Queries
-- -----------------------------------------------------------------------------
create index if not exists idx_rooms_room_code on public.rooms(room_code);
create index if not exists idx_room_members_user_id on public.room_members(user_id);
create index if not exists idx_room_members_room_id on public.room_members(room_id);
create index if not exists idx_poll_responses_lookup on public.poll_responses(room_id, poll_version);

-- -----------------------------------------------------------------------------
-- Helper Functions (Security Definer to prevent recursive RLS checks)
-- -----------------------------------------------------------------------------
create or replace function public.is_member_of_room(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

create or replace function public.is_room_operator(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rooms
    where id = p_room_id and operator_id = p_user_id
  );
$$;

-- -----------------------------------------------------------------------------
-- Automatic Profile Creation on auth.users insert
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1),
    'Teammate'
  );

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do update
  set display_name = excluded.display_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.poll_responses enable row level security;

-- Profiles Policies
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Rooms Policies
create policy "rooms_select_members_or_operator"
  on public.rooms for select
  to authenticated
  using (
    operator_id = auth.uid() or
    public.is_member_of_room(id, auth.uid())
  );

create policy "rooms_insert_operator"
  on public.rooms for insert
  to authenticated
  with check (operator_id = auth.uid());

create policy "rooms_update_operator_only"
  on public.rooms for update
  to authenticated
  using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

-- Room Members Policies
create policy "room_members_select"
  on public.room_members for select
  to authenticated
  using (
    public.is_member_of_room(room_id, auth.uid()) or
    public.is_room_operator(room_id, auth.uid())
  );

create policy "room_members_insert_self"
  on public.room_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "room_members_delete_self"
  on public.room_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Poll Responses Policies
create policy "poll_responses_select_members"
  on public.poll_responses for select
  to authenticated
  using (public.is_member_of_room(room_id, auth.uid()));

create policy "poll_responses_insert_own"
  on public.poll_responses for insert
  to authenticated
  with check (
    user_id = auth.uid() and
    public.is_member_of_room(room_id, auth.uid())
  );

create policy "poll_responses_update_own"
  on public.poll_responses for update
  to authenticated
  using (
    user_id = auth.uid() and
    public.is_member_of_room(room_id, auth.uid())
  )
  with check (
    user_id = auth.uid() and
    public.is_member_of_room(room_id, auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Server-Side Atomic RPC Functions
-- -----------------------------------------------------------------------------

-- 1. Create Room (Generates unambiguous code, creates room & operator membership)
create or replace function public.create_room(
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_room_id uuid;
  v_room_code text;
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_i int;
  v_exists boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Ensure profile exists
  if p_display_name is not null and trim(p_display_name) <> '' then
    insert into public.profiles (id, display_name)
    values (v_user_id, trim(p_display_name))
    on conflict (id) do update set display_name = excluded.display_name;
  end if;

  -- Generate unique 6-character room code
  loop
    v_room_code := '';
    for v_i in 1..6 loop
      v_room_code := v_room_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;

    select exists(select 1 from public.rooms where room_code = v_room_code) into v_exists;
    exit when not v_exists;
  end loop;

  -- Insert room
  insert into public.rooms (
    room_code,
    operator_id,
    status,
    current_poll_version,
    current_question_number,
    timer_started_at
  ) values (
    v_room_code,
    v_user_id,
    'active',
    1,
    1,
    now()
  ) returning id into v_room_id;

  -- Insert operator as room member
  insert into public.room_members (
    room_id,
    user_id,
    role
  ) values (
    v_room_id,
    v_user_id,
    'operator'
  ) on conflict (room_id, user_id) do update set role = 'operator';

  return jsonb_build_object(
    'room_id', v_room_id,
    'room_code', v_room_code,
    'role', 'operator',
    'current_poll_version', 1,
    'current_question_number', 1,
    'timer_started_at', now()
  );
end;
$$;

-- 2. Join Room (Validates code, room status, idempotently registers member)
create or replace function public.join_room(
  p_room_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_room record;
  v_role text := 'participant';
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_room
  from public.rooms
  where room_code = upper(trim(p_room_code)) and status = 'active';

  if not found then
    raise exception 'Room not found or no longer active';
  end if;

  if v_room.operator_id = v_user_id then
    v_role := 'operator';
  end if;

  -- Idempotently insert member record
  insert into public.room_members (
    room_id,
    user_id,
    role
  ) values (
    v_room.id,
    v_user_id,
    v_role
  ) on conflict (room_id, user_id) do nothing;

  return jsonb_build_object(
    'room_id', v_room.id,
    'room_code', v_room.room_code,
    'role', v_role,
    'current_poll_version', v_room.current_poll_version,
    'current_question_number', v_room.current_question_number,
    'timer_started_at', v_room.timer_started_at
  );
end;
$$;

-- 3. Commit Vote (Atomic upsert, validates room membership and poll version)
create or replace function public.commit_vote(
  p_room_id uuid,
  p_poll_version int,
  p_response_type text,
  p_a int default 0,
  p_b int default 0,
  p_c int default 0,
  p_d int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_room record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Validate room membership
  if not public.is_member_of_room(p_room_id, v_user_id) then
    raise exception 'Forbidden: You are not a member of this room';
  end if;

  -- Verify room status and active poll version
  select * into v_room
  from public.rooms
  where id = p_room_id;

  if not found or v_room.status <> 'active' then
    raise exception 'Room is no longer active';
  end if;

  if v_room.current_poll_version <> p_poll_version then
    raise exception 'Stale submission: Poll has already moved to version % (submitted version %)',
      v_room.current_poll_version, p_poll_version;
  end if;

  -- Validate allocation rules
  if p_response_type = 'dont_know' then
    p_a := 0;
    p_b := 0;
    p_c := 0;
    p_d := 0;
  elsif p_response_type = 'allocation' then
    if (p_a + p_b + p_c + p_d) <> 100 then
      raise exception 'Allocation percentages must total exactly 100';
    end if;
  else
    raise exception 'Invalid response type %', p_response_type;
  end if;

  -- Upsert vote atomically
  insert into public.poll_responses (
    room_id,
    poll_version,
    user_id,
    response_type,
    allocation_a,
    allocation_b,
    allocation_c,
    allocation_d,
    committed_at,
    updated_at
  ) values (
    p_room_id,
    p_poll_version,
    v_user_id,
    p_response_type,
    p_a,
    p_b,
    p_c,
    p_d,
    now(),
    now()
  )
  on conflict (room_id, poll_version, user_id)
  do update set
    response_type = excluded.response_type,
    allocation_a = excluded.allocation_a,
    allocation_b = excluded.allocation_b,
    allocation_c = excluded.allocation_c,
    allocation_d = excluded.allocation_d,
    committed_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'poll_version', p_poll_version,
    'committed_at', now()
  );
end;
$$;

-- 4. Refresh Poll (Operator-only atomic version increment and timer reset)
create or replace function public.refresh_poll(
  p_room_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_updated record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Only operator can refresh poll
  if not exists (select 1 from public.rooms where id = p_room_id and operator_id = v_user_id) then
    raise exception 'Forbidden: Only the room operator can refresh the poll';
  end if;

  update public.rooms
  set
    current_poll_version = current_poll_version + 1,
    current_question_number = current_question_number + 1,
    timer_started_at = now(),
    updated_at = now()
  where id = p_room_id and operator_id = v_user_id
  returning * into v_updated;

  return jsonb_build_object(
    'room_id', v_updated.id,
    'current_poll_version', v_updated.current_poll_version,
    'current_question_number', v_updated.current_question_number,
    'timer_started_at', v_updated.timer_started_at
  );
end;
$$;

-- 5. Get Aggregate Results for Active Poll
create or replace function public.get_room_aggregate(
  p_room_id uuid,
  p_poll_version int
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid;
  v_total_members int;
  v_total_votes int;
  v_dont_know_count int;
  v_allocation_count int;
  v_avg_a numeric := 0;
  v_avg_b numeric := 0;
  v_avg_c numeric := 0;
  v_avg_d numeric := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null or not public.is_member_of_room(p_room_id, v_user_id) then
    raise exception 'Forbidden';
  end if;

  select count(*) into v_total_members
  from public.room_members
  where room_id = p_room_id;

  select
    count(*),
    count(*) filter (where response_type = 'dont_know'),
    count(*) filter (where response_type = 'allocation'),
    coalesce(round(avg(allocation_a) filter (where response_type = 'allocation')), 0),
    coalesce(round(avg(allocation_b) filter (where response_type = 'allocation')), 0),
    coalesce(round(avg(allocation_c) filter (where response_type = 'allocation')), 0),
    coalesce(round(avg(allocation_d) filter (where response_type = 'allocation')), 0)
  into
    v_total_votes,
    v_dont_know_count,
    v_allocation_count,
    v_avg_a,
    v_avg_b,
    v_avg_c,
    v_avg_d
  from public.poll_responses
  where room_id = p_room_id and poll_version = p_poll_version;

  return jsonb_build_object(
    'room_id', p_room_id,
    'poll_version', p_poll_version,
    'total_members', v_total_members,
    'total_votes', v_total_votes,
    'dont_know_count', v_dont_know_count,
    'allocation_count', v_allocation_count,
    'mean_a', v_avg_a,
    'mean_b', v_avg_b,
    'mean_c', v_avg_c,
    'mean_d', v_avg_d
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Enable Realtime for Synchronized Tables
-- -----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when others then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.poll_responses;
exception when others then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when others then
  null;
end;
$$;
