-- 2v2 Teams mode: two real duos face off in one game (e.g. Bryan+Greg vs Noah+Yager).
-- All four players' batting + pitching roll into overall/season stats.

-- Which side of a 2v2 Teams game a player is on (1 or 2). NULL for all other game modes.
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS team INTEGER;

-- Winning side for a 2v2 Teams game (1 or 2). NULL until the game is completed / for other modes.
ALTER TABLE games ADD COLUMN IF NOT EXISTS winning_team INTEGER;

-- The team that is currently batting in a live 2v2 Teams game (1 or 2). Flips each half-inning.
ALTER TABLE games ADD COLUMN IF NOT EXISTS batting_team INTEGER DEFAULT 1;

-- Each team's current pitcher (the fielding team pitches to the batting team).
ALTER TABLE games ADD COLUMN IF NOT EXISTS team1_pitcher_id UUID REFERENCES players(id);
ALTER TABLE games ADD COLUMN IF NOT EXISTS team2_pitcher_id UUID REFERENCES players(id);

-- game_mode already exists as free-text; '2v2_teams' is a new allowed value. No constraint change needed.
