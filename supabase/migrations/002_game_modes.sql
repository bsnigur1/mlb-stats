-- Update player names
UPDATE players SET name = 'Bryan' WHERE name = 'B';
UPDATE players SET name = 'Andrew' WHERE name = 'Andres' OR name = 'Dre';

-- Add game mode column (replacing game_type)
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT '2v2';

-- Add H2H tracking columns for 1v1 games
ALTER TABLE games ADD COLUMN IF NOT EXISTS h2h_player1_id UUID REFERENCES players(id);
ALTER TABLE games ADD COLUMN IF NOT EXISTS h2h_player2_id UUID REFERENCES players(id);
ALTER TABLE games ADD COLUMN IF NOT EXISTS h2h_winner_id UUID REFERENCES players(id);

-- Add session activity tracking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Migrate existing game_type to game_mode
UPDATE games SET game_mode =
  CASE
    WHEN game_type = 'CO-OP' THEN '2v2'
    WHEN game_type = 'SOLO' THEN '1v1'
    ELSE '2v2'
  END
WHERE game_mode IS NULL OR game_mode = '2v2';

-- Update player handles
UPDATE players SET handle = 'B-Ry' WHERE name = 'Bryan';
UPDATE players SET handle = 'G-Money' WHERE name = 'Greg';
UPDATE players SET handle = 'Dre' WHERE name = 'Andrew';
