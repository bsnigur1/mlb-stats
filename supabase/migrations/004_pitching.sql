-- Add pitching tracking fields to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS track_pitching BOOLEAN DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS batting_first BOOLEAN DEFAULT true;
ALTER TABLE games ADD COLUMN IF NOT EXISTS current_pitcher_id UUID REFERENCES players(id);

-- Add pitcher_id to at_bats to track who was pitching during each at-bat
ALTER TABLE at_bats ADD COLUMN IF NOT EXISTS pitcher_id UUID REFERENCES players(id);

-- Create pitching_stats table to track per-game pitching stats
CREATE TABLE IF NOT EXISTS pitching_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  outs_recorded INTEGER DEFAULT 0,
  strikeouts INTEGER DEFAULT 0,
  walks INTEGER DEFAULT 0,
  hits_allowed INTEGER DEFAULT 0,
  earned_runs INTEGER DEFAULT 0,
  inherited_runners_scored INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- Enable RLS
ALTER TABLE pitching_stats ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon users (same as other tables)
CREATE POLICY "Allow all for pitching_stats" ON pitching_stats FOR ALL USING (true) WITH CHECK (true);
