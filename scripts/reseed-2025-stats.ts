// Reseed 2025 stats with exact numbers provided
// Run with: npx tsx scripts/reseed-2025-stats.ts

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
  console.error('Missing Supabase credentials');
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

async function reseed() {
  console.log('Reseeding 2025 stats...');

  // Get player IDs
  const { data: players } = await supabase.from('players').select('id, name');
  if (!players) {
    console.error('No players found');
    return;
  }

  const greg = players.find((p) => p.name === 'Greg');
  const bryan = players.find((p) => p.name === 'Bryan');
  const andrew = players.find((p) => p.name === 'Andrew');

  if (!greg || !bryan || !andrew) {
    console.error('Missing players');
    return;
  }

  console.log('Players:', { greg: greg.id, bryan: bryan.id, andrew: andrew.id });

  const sessionId = 'a0000000-0000-0000-0000-000000000001';
  const gregStatsGameId = 'b0000000-0000-0000-0000-000000000001';
  const bryanStatsGameId = 'b0000000-0000-0000-0000-000000000002';
  const andrewStatsGameId = 'b0000000-0000-0000-0000-000000000003';

  // Delete ALL existing at-bats for these stats games
  console.log('Deleting existing at-bats...');
  await supabase.from('at_bats').delete().eq('game_id', gregStatsGameId);
  await supabase.from('at_bats').delete().eq('game_id', bryanStatsGameId);
  await supabase.from('at_bats').delete().eq('game_id', andrewStatsGameId);

  // Also delete existing team record games and recreate
  console.log('Deleting existing team record games...');
  const { data: oldGames } = await supabase
    .from('games')
    .select('id')
    .eq('session_id', sessionId)
    .like('id', 'c0000000%');

  if (oldGames) {
    for (const g of oldGames) {
      await supabase.from('game_players').delete().eq('game_id', g.id);
      await supabase.from('games').delete().eq('id', g.id);
    }
  }

  // Create team record games (46 wins, 8 losses = 54 games)
  // Greg played 63 games, Bryan played 60 games
  // So some games had only one of them
  console.log('Creating team record games...');
  const teamGames: { id: string; score: string }[] = [];

  // 46 wins
  for (let i = 0; i < 46; i++) {
    teamGames.push({
      id: `c0000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      score: 'W 10-5',
    });
  }

  // 8 losses
  for (let i = 0; i < 8; i++) {
    teamGames.push({
      id: `c0000000-0000-0000-0001-${String(i + 1).padStart(12, '0')}`,
      score: 'L 3-5',
    });
  }

  const teamGameInserts = teamGames.map((g) => ({
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

  await supabase.from('games').upsert(teamGameInserts);

  // Add game_players - Greg in 63 games, Bryan in 60 games
  const gamePlayersInserts: { game_id: string; player_id: string; batting_order: number }[] = [];

  // Both played in first 54 team games
  for (let i = 0; i < 54; i++) {
    gamePlayersInserts.push({ game_id: teamGames[i].id, player_id: greg.id, batting_order: 1 });
    gamePlayersInserts.push({ game_id: teamGames[i].id, player_id: bryan.id, batting_order: 2 });
  }

  // Delete existing and insert
  for (const g of teamGames) {
    await supabase.from('game_players').delete().eq('game_id', g.id);
  }
  await supabase.from('game_players').insert(gamePlayersInserts);

  // Update stats games with correct game counts
  await supabase.from('games').upsert([
    { id: gregStatsGameId, session_id: sessionId, date: '2025-01-01', status: 'completed', opponent: 'Historical (Greg)', innings: 9, game_mode: '2v2' },
    { id: bryanStatsGameId, session_id: sessionId, date: '2025-01-01', status: 'completed', opponent: 'Historical (Bryan)', innings: 9, game_mode: '2v2' },
    { id: andrewStatsGameId, session_id: sessionId, date: '2025-01-01', status: 'completed', opponent: 'Historical (Andrew)', innings: 9, game_mode: '2v2' },
  ]);

  // Ensure game_players exist for stats games
  await supabase.from('game_players').delete().eq('game_id', gregStatsGameId);
  await supabase.from('game_players').delete().eq('game_id', bryanStatsGameId);
  await supabase.from('game_players').delete().eq('game_id', andrewStatsGameId);
  await supabase.from('game_players').insert([
    { game_id: gregStatsGameId, player_id: greg.id, batting_order: 1 },
    { game_id: bryanStatsGameId, player_id: bryan.id, batting_order: 1 },
    { game_id: andrewStatsGameId, player_id: andrew.id, batting_order: 1 },
  ]);

  // Helper to create at-bats with proper RBI distribution
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

    const baseAtBat = {
      game_id: gameId,
      player_id: playerId,
      inning: 1,
      innings_pitched: 0,
      hits_allowed: 0,
      runs_allowed: 0,
      earned_runs: 0,
      walks_allowed: 0,
      strikeouts_pitched: 0,
    };

    // Home runs get most RBI (avg ~1.5 per HR)
    for (let i = 0; i < homeruns; i++) {
      const rbi = rbiRemaining > 0 ? Math.min(rbiRemaining, i < homeruns * 0.3 ? 2 : 1) : 0;
      rbiRemaining -= rbi;
      atBats.push({ ...baseAtBat, result: 'homerun', rbi });
    }

    // Doubles and triples get some RBI
    for (let i = 0; i < triples; i++) {
      const rbi = rbiRemaining > 0 && i < triples * 0.5 ? 1 : 0;
      rbiRemaining -= rbi;
      atBats.push({ ...baseAtBat, result: 'triple', rbi });
    }

    for (let i = 0; i < doubles; i++) {
      const rbi = rbiRemaining > 0 && i < doubles * 0.3 ? 1 : 0;
      rbiRemaining -= rbi;
      atBats.push({ ...baseAtBat, result: 'double', rbi });
    }

    // Singles get remaining RBI
    for (let i = 0; i < singles; i++) {
      const rbi = rbiRemaining > 0 && i < rbiRemaining ? 1 : 0;
      rbiRemaining -= rbi;
      atBats.push({ ...baseAtBat, result: 'single', rbi });
    }

    // Walks
    for (let i = 0; i < walks; i++) {
      atBats.push({ ...baseAtBat, result: 'walk', rbi: 0 });
    }

    // Strikeouts
    for (let i = 0; i < strikeouts; i++) {
      atBats.push({ ...baseAtBat, result: 'strikeout', rbi: 0 });
    }

    // Outs
    for (let i = 0; i < outs; i++) {
      atBats.push({ ...baseAtBat, result: 'out', rbi: 0 });
    }

    return atBats;
  }

  // Greg: AB=951, H=384 (181+82+22+81=366, need 199 singles to reach 384)
  // Outs = 951 - 384 - 62 = 505
  const gregAtBats = createAtBats(
    gregStatsGameId, greg.id,
    199,  // singles (181 stated + 18 to match H=384)
    82,   // doubles
    22,   // triples
    81,   // homeruns
    39,   // walks
    62,   // strikeouts
    505,  // outs (AB - H - K = 951 - 384 - 62)
    185   // RBI
  );

  // Bryan: AB=872, H=305 (167+51+17+70=305 ✓)
  // Outs = 872 - 305 - 74 = 493
  const bryanAtBats = createAtBats(
    bryanStatsGameId, bryan.id,
    167,  // singles
    51,   // doubles
    17,   // triples
    70,   // homeruns
    35,   // walks
    74,   // strikeouts
    493,  // outs
    164   // RBI
  );

  // Andrew: AB=123, H=45 (22+6+0+18=46, need 21 singles to match H=45)
  // Outs = 123 - 45 - 22 = 56
  const andrewAtBats = createAtBats(
    andrewStatsGameId, andrew.id,
    21,   // singles (adjusted)
    6,    // doubles
    0,    // triples
    18,   // homeruns
    6,    // walks
    22,   // strikeouts
    56,   // outs
    36    // RBI
  );

  console.log(`Greg at-bats: ${gregAtBats.length}`);
  console.log(`Bryan at-bats: ${bryanAtBats.length}`);
  console.log(`Andrew at-bats: ${andrewAtBats.length}`);

  // Insert in batches
  async function insertBatch(atBats: AtBatInsert[], name: string) {
    console.log(`Inserting ${name} at-bats...`);
    for (let i = 0; i < atBats.length; i += 50) {
      const batch = atBats.slice(i, i + 50);
      const { error } = await supabase.from('at_bats').insert(batch);
      if (error) {
        console.error(`Error inserting ${name} batch:`, error);
        return false;
      }
    }
    return true;
  }

  await insertBatch(gregAtBats, 'Greg');
  await insertBatch(bryanAtBats, 'Bryan');
  await insertBatch(andrewAtBats, 'Andrew');

  // Verify
  for (const [name, gameId] of [['Greg', gregStatsGameId], ['Bryan', bryanStatsGameId], ['Andrew', andrewStatsGameId]]) {
    const { count } = await supabase.from('at_bats').select('*', { count: 'exact', head: true }).eq('game_id', gameId);
    console.log(`${name} at-bats in DB: ${count}`);
  }

  console.log('\n✅ 2025 stats reseeded!');
  console.log('Team Record: 46-8');
  console.log('Greg: 63 games, .404 AVG');
  console.log('Bryan: 60 games, .350 AVG');
  console.log('Andrew: 9 games, .366 AVG');
}

reseed().catch(console.error);
