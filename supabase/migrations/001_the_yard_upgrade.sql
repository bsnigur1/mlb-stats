-- Add sessions table
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  label text,
  mvp_player_id uuid references players(id),
  created_at timestamp with time zone default now()
);

-- Add columns to games table
alter table games add column if not exists session_id uuid references sessions(id);
alter table games add column if not exists opponent text;
alter table games add column if not exists score text;
alter table games add column if not exists innings int default 9;
alter table games add column if not exists game_type text default 'SOLO';
alter table games add column if not exists mvp_player_id uuid references players(id);

-- Add columns to players
alter table players add column if not exists handle text;
alter table players add column if not exists heat text default 'neutral';
alter table players add column if not exists streak int default 0;
alter table players add column if not exists streak_type text default 'W';

-- Add pitching columns to at_bats
alter table at_bats add column if not exists innings_pitched numeric(3,1) default 0;
alter table at_bats add column if not exists hits_allowed int default 0;
alter table at_bats add column if not exists runs_allowed int default 0;
alter table at_bats add column if not exists earned_runs int default 0;
alter table at_bats add column if not exists walks_allowed int default 0;
alter table at_bats add column if not exists strikeouts_pitched int default 0;

-- Awards table
create table if not exists awards (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references players(id),
  type text not null,
  label text,
  session_id uuid references sessions(id),
  game_id uuid references games(id),
  date date default current_date,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table sessions enable row level security;
alter table awards enable row level security;

-- Create policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'sessions') THEN
    CREATE POLICY "Allow all" ON sessions FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'awards') THEN
    CREATE POLICY "Allow all" ON awards FOR ALL USING (true);
  END IF;
END $$;

-- Update player handles
update players set handle = 'G-Money' where name = 'Greg';
update players set handle = 'B-Ry' where name = 'B';
update players set handle = 'Dre' where name = 'Andrew';
