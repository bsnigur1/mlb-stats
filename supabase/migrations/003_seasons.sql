-- Migration: Add seasons support
-- 2025 season is locked (historical), 2026 is active

-- Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add season reference to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);

-- Insert 2025 season (locked - historical data)
INSERT INTO seasons (year, name, start_date, end_date, is_active, is_locked)
VALUES (2025, '2025 Season', '2025-01-01', '2025-12-31', false, true)
ON CONFLICT (year) DO NOTHING;

-- Insert 2026 season (active)
INSERT INTO seasons (year, name, start_date, is_active, is_locked)
VALUES (2026, '2026 Season', '2026-01-01', true, false)
ON CONFLICT (year) DO NOTHING;

-- Assign all existing games to 2025 season
UPDATE games
SET season_id = (SELECT id FROM seasons WHERE year = 2025)
WHERE season_id IS NULL;

-- Create index for faster season queries
CREATE INDEX IF NOT EXISTS idx_games_season_id ON games(season_id);

-- Enable RLS on seasons table
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- Allow read access to seasons for all authenticated users
CREATE POLICY "Seasons are viewable by everyone" ON seasons
  FOR SELECT USING (true);
