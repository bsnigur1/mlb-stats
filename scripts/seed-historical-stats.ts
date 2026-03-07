// Script to seed historical stats
// Run with: npx tsx scripts/seed-historical-stats.ts

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface AtBatInsert {
  game_id: string;
  player_id: string;
  inning: number;
  result: string;
  rbi: number;
  innings_pitched: number;
  hits_allowed: number;
  runs_allowed: number;
  earned_runs: number;
  walks_allowed: number;
  strikeouts_pitched: number;
}

async function seedHistoricalStats() {
  console.log('Starting historical stats seed...');

  // Get player IDs
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name');

  if (playersError || !players) {
    console.error('Error fetching players:', playersError);
    return;
  }

  const greg = players.find((p) => p.name === 'Greg');
  const bryan = players.find((p) => p.name === 'Bryan');
  const andrew = players.find((p) => p.name === 'Andrew');

  if (!greg || !bryan || !andrew) {
    console.error('Could not find all players');
    return;
  }

  console.log('Found players:', { greg: greg.id, bryan: bryan.id, andrew: andrew.id });

  // Create historical session
  const sessionId = 'a0000000-0000-0000-0000-000000000001';
  const { error: sessionError } = await supabase.from('sessions').upsert({
    id: sessionId,
    date: '2025-01-01',
    label: 'Season 2025 (Pre-App)',
    is_active: false,
    last_activity: '2025-03-01T00:00:00Z',
  });

  if (sessionError) {
    console.error('Error creating session:', sessionError);
    return;
  }
  console.log('Created historical session');

  // Create games for team record (46 wins, 8 losses)
  const games: { id: string; score: string }[] = [];

  // 46 wins
  for (let i = 0; i < 46; i++) {
    games.push({
      id: `c0000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      score: 'W 10-5',
    });
  }

  // 8 losses
  for (let i = 0; i < 8; i++) {
    games.push({
      id: `c0000000-0000-0000-0001-${String(i + 1).padStart(12, '0')}`,
      score: 'L 3-5',
    });
  }

  // Insert games
  const gameInserts = games.map((g) => ({
    id: g.id,
    session_id: sessionId,
    date: '2025-01-01',
    status: 'completed',
    current_inning: 9,
    current_outs: 0,
    opponent: 'Various',
    score: g.score,
    innings: 9,
    game_mode: '2v2',
  }));

  const { error: gamesError } = await supabase.from('games').upsert(gameInserts);
  if (gamesError) {
    console.error('Error creating games:', gamesError);
    return;
  }
  console.log('Created 54 historical games');

  // Add game_players for all games (Greg and Bryan played in all)
  const gamePlayersInserts = games.flatMap((g) => [
    { game_id: g.id, player_id: greg.id, batting_order: 1 },
    { game_id: g.id, player_id: bryan.id, batting_order: 2 },
  ]);

  // Delete existing game_players for these games first
  for (const g of games) {
    await supabase.from('game_players').delete().eq('game_id', g.id);
  }

  const { error: gpError } = await supabase.from('game_players').insert(gamePlayersInserts);
  if (gpError) {
    console.error('Error creating game_players:', gpError);
    return;
  }
  console.log('Added game_players');

  // Create stats games for at-bats
  const gregStatsGameId = 'b0000000-0000-0000-0000-000000000001';
  const bryanStatsGameId = 'b0000000-0000-0000-0000-000000000002';
  const andrewStatsGameId = 'b0000000-0000-0000-0000-000000000003';

  const statsGames = [
    { id: gregStatsGameId, opponent: 'Historical (Greg)' },
    { id: bryanStatsGameId, opponent: 'Historical (Bryan)' },
    { id: andrewStatsGameId, opponent: 'Historical (Andrew)' },
  ];

  const statsGameInserts = statsGames.map((g) => ({
    id: g.id,
    session_id: sessionId,
    date: '2025-01-01',
    status: 'completed',
    current_inning: 9,
    current_outs: 0,
    opponent: g.opponent,
    score: 'W 0-0',
    innings: 9,
    game_mode: '2v2',
  }));

  const { error: statsGamesError } = await supabase.from('games').upsert(statsGameInserts);
  if (statsGamesError) {
    console.error('Error creating stats games:', statsGamesError);
    return;
  }

  // Delete existing at_bats for these games
  for (const g of statsGames) {
    await supabase.from('at_bats').delete().eq('game_id', g.id);
    await supabase.from('game_players').delete().eq('game_id', g.id);
  }

  // Add game_players for stats games
  await supabase.from('game_players').insert([
    { game_id: gregStatsGameId, player_id: greg.id, batting_order: 1 },
    { game_id: bryanStatsGameId, player_id: bryan.id, batting_order: 1 },
    { game_id: andrewStatsGameId, player_id: andrew.id, batting_order: 1 },
  ]);

  console.log('Created stats games');

  // Helper to create at-bats
  function createAtBats(
    gameId: string,
    playerId: string,
    singles: number,
    doubles: number,
    triples: number,
    homeruns: number,
    walks: number,
    strikeouts: number,
    outs: number,
    totalRbi: number
  ): AtBatInsert[] {
    const atBats: AtBatInsert[] = [];
    let rbiRemaining = totalRbi;

    // Singles
    for (let i = 0; i < singles; i++) {
      const rbi = rbiRemaining > 0 && i < Math.min(singles, Math.ceil(totalRbi * 0.2)) ? 1 : 0;
      rbiRemaining -= rbi;
      atBats.push({
        game_id: gameId,
        player_id: playerId,
        inning: 1,
        result: 'single',
        rbi,
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        walks_allowed: 0,
        strikeouts_pitched: 0,
      });
    }

    // Doubles
    for (let i = 0; i < doubles; i++) {
      const rbi = rbiRemaining > 0 && i < Math.min(doubles, Math.ceil(totalRbi * 0.15)) ? 1 : 0;
      rbiRemaining -= rbi;
      atBats.push({
        game_id: gameId,
        player_id: playerId,
        inning: 1,
        result: 'double',
        rbi,
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        walks_allowed: 0,
        strikeouts_pitched: 0,
      });
    }

    // Triples
    for (let i = 0; i < triples; i++) {
      const rbi = rbiRemaining > 0 && i < Math.min(triples, Math.ceil(totalRbi * 0.1)) ? 1 : 0;
      rbiRemaining -= rbi;
      atBats.push({
        game_id: gameId,
        player_id: playerId,
        inning: 1,
        result: 'triple',
        rbi,
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        walks_allowed: 0,
        strikeouts_pitched: 0,
      });
    }

    // Home runs - distribute remaining RBI
    for (let i = 0; i < homeruns; i++) {
      const rbi = rbiRemaining > 0 ? Math.min(rbiRemaining, i < homeruns / 2 ? 2 : 1) : 0;
      rbiRemaining -= rbi;
      atBats.push({
        game_id: gameId,
        player_id: playerId,
        inning: 1,
        result: 'homerun',
        rbi,
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        walks_allowed: 0,
        strikeouts_pitched: 0,
      });
    }

    // Walks
    for (let i = 0; i < walks; i++) {
      atBats.push({
        game_id: gameId,
        player_id: playerId,
        inning: 1,
        result: 'walk',
        rbi: 0,
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        walks_allowed: 0,
        strikeouts_pitched: 0,
      });
    }

    // Strikeouts
    for (let i = 0; i < strikeouts; i++) {
      atBats.push({
        game_id: gameId,
        player_id: playerId,
        inning: 1,
        result: 'strikeout',
        rbi: 0,
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        walks_allowed: 0,
        strikeouts_pitched: 0,
      });
    }

    // Outs
    for (let i = 0; i < outs; i++) {
      atBats.push({
        game_id: gameId,
        player_id: playerId,
        inning: 1,
        result: 'out',
        rbi: 0,
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        walks_allowed: 0,
        strikeouts_pitched: 0,
      });
    }

    return atBats;
  }

  // Greg: AB=951, H=384 (181 1B + 82 2B + 22 3B + 81 HR = 366, need 18 more singles = 199)
  // BB=39, K=62, RBI=185
  // Outs = 951 - 384 = 567, regular outs = 567 - 62 = 505
  const gregAtBats = createAtBats(
    gregStatsGameId,
    greg.id,
    199, // singles (181 + 18 to reach H=384)
    82, // doubles
    22, // triples
    81, // homeruns
    39, // walks
    62, // strikeouts
    505, // outs
    185 // RBI
  );

  // Bryan: AB=872, H=305 (167 1B + 51 2B + 17 3B + 70 HR = 305 ✓)
  // BB=35, K=74, RBI=164
  // Outs = 872 - 305 = 567, regular outs = 567 - 74 = 493
  const bryanAtBats = createAtBats(
    bryanStatsGameId,
    bryan.id,
    167, // singles
    51, // doubles
    17, // triples
    70, // homeruns
    35, // walks
    74, // strikeouts
    493, // outs
    164 // RBI
  );

  // Andrew: AB=123, H=45 (22 1B + 6 2B + 0 3B + 18 HR = 46, need 21 singles for H=45)
  // BB=6, K=22, RBI=36
  // Outs = 123 - 45 = 78, regular outs = 78 - 22 = 56
  const andrewAtBats = createAtBats(
    andrewStatsGameId,
    andrew.id,
    21, // singles (adjusted to make H=45)
    6, // doubles
    0, // triples
    18, // homeruns
    6, // walks
    22, // strikeouts
    56, // outs
    36 // RBI
  );

  // Insert at-bats in batches
  console.log(`Inserting ${gregAtBats.length} at-bats for Greg...`);
  for (let i = 0; i < gregAtBats.length; i += 100) {
    const batch = gregAtBats.slice(i, i + 100);
    const { error } = await supabase.from('at_bats').insert(batch);
    if (error) {
      console.error('Error inserting Greg at-bats:', error);
      return;
    }
  }

  console.log(`Inserting ${bryanAtBats.length} at-bats for Bryan...`);
  for (let i = 0; i < bryanAtBats.length; i += 100) {
    const batch = bryanAtBats.slice(i, i + 100);
    const { error } = await supabase.from('at_bats').insert(batch);
    if (error) {
      console.error('Error inserting Bryan at-bats:', error);
      return;
    }
  }

  console.log(`Inserting ${andrewAtBats.length} at-bats for Andrew...`);
  const { error: andrewError } = await supabase.from('at_bats').insert(andrewAtBats);
  if (andrewError) {
    console.error('Error inserting Andrew at-bats:', andrewError);
    return;
  }

  console.log('✅ Historical stats seeded successfully!');
  console.log('Summary:');
  console.log('- Team Record: 46-8');
  console.log('- Greg: 63 games worth of stats');
  console.log('- Bryan: 60 games worth of stats');
  console.log('- Andrew: 9 games worth of stats');
}

seedHistoricalStats().catch(console.error);
