// Script to fix Bryan and Andrew's historical stats
// Run with: npx tsx scripts/fix-bryan-andrew-stats.ts

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

async function fixBryanAndrewStats() {
  console.log('Fixing Bryan and Andrew historical stats...');

  // Get player IDs
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name');

  if (playersError || !players) {
    console.error('Error fetching players:', playersError);
    return;
  }

  const bryan = players.find((p) => p.name === 'Bryan');
  const andrew = players.find((p) => p.name === 'Andrew');

  if (!bryan || !andrew) {
    console.error('Could not find Bryan or Andrew');
    return;
  }

  console.log('Found players:', { bryan: bryan.id, andrew: andrew.id });

  const bryanStatsGameId = 'b0000000-0000-0000-0000-000000000002';
  const andrewStatsGameId = 'b0000000-0000-0000-0000-000000000003';

  // Delete existing at-bats for Bryan and Andrew stats games
  console.log('Deleting existing at-bats...');
  await supabase.from('at_bats').delete().eq('game_id', bryanStatsGameId);
  await supabase.from('at_bats').delete().eq('game_id', andrewStatsGameId);

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

  // Bryan: AB=872, H=305 (167 1B + 51 2B + 17 3B + 70 HR = 305)
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

  // Andrew: AB=123, H=45 (21 1B + 6 2B + 0 3B + 18 HR = 45)
  // BB=6, K=22, RBI=36
  // Outs = 123 - 45 = 78, regular outs = 78 - 22 = 56
  const andrewAtBats = createAtBats(
    andrewStatsGameId,
    andrew.id,
    21, // singles
    6, // doubles
    0, // triples
    18, // homeruns
    6, // walks
    22, // strikeouts
    56, // outs
    36 // RBI
  );

  console.log(`Total Bryan at-bats to insert: ${bryanAtBats.length}`);
  console.log(`Total Andrew at-bats to insert: ${andrewAtBats.length}`);

  // Insert Bryan at-bats in smaller batches of 50
  console.log('Inserting Bryan at-bats...');
  let bryanInserted = 0;
  for (let i = 0; i < bryanAtBats.length; i += 50) {
    const batch = bryanAtBats.slice(i, i + 50);
    const { error } = await supabase.from('at_bats').insert(batch);
    if (error) {
      console.error(`Error inserting Bryan at-bats batch ${i / 50 + 1}:`, error);
      return;
    }
    bryanInserted += batch.length;
    console.log(`  Inserted ${bryanInserted}/${bryanAtBats.length} Bryan at-bats`);
  }

  // Insert Andrew at-bats in smaller batches of 50
  console.log('Inserting Andrew at-bats...');
  let andrewInserted = 0;
  for (let i = 0; i < andrewAtBats.length; i += 50) {
    const batch = andrewAtBats.slice(i, i + 50);
    const { error } = await supabase.from('at_bats').insert(batch);
    if (error) {
      console.error(`Error inserting Andrew at-bats batch ${i / 50 + 1}:`, error);
      return;
    }
    andrewInserted += batch.length;
    console.log(`  Inserted ${andrewInserted}/${andrewAtBats.length} Andrew at-bats`);
  }

  // Verify the counts
  const { count: bryanCount } = await supabase
    .from('at_bats')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', bryanStatsGameId);

  const { count: andrewCount } = await supabase
    .from('at_bats')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', andrewStatsGameId);

  console.log('\n✅ Fix completed!');
  console.log(`Bryan at-bats in DB: ${bryanCount}`);
  console.log(`Andrew at-bats in DB: ${andrewCount}`);
}

fixBryanAndrewStats().catch(console.error);
