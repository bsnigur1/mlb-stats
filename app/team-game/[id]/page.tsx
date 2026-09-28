'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Undo2, Flag, Trash2, X } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Game, GamePlayer, AtBat, AtBatResult } from '@/lib/types';

// --- Pure baseball helpers (kept here so the logger has no hidden dependencies) ---

const HIT_RESULTS: AtBatResult[] = ['single', 'double', 'triple', 'homerun'];

function outsFor(result: AtBatResult): number {
  if (result === 'double_play') return 2;
  if (result === 'out' || result === 'strikeout' || result === 'baserunner_out') return 1;
  return 0;
}

function isHit(result: AtBatResult): boolean {
  return HIT_RESULTS.includes(result);
}

const T1 = '#F0B429';
const T2 = '#60A5FA';

// Batting result buttons (batter's perspective)
const RESULT_BUTTONS: { result: AtBatResult; label: string; color: string }[] = [
  { result: 'single', label: '1B', color: '#34D399' },
  { result: 'double', label: '2B', color: '#34D399' },
  { result: 'triple', label: '3B', color: '#34D399' },
  { result: 'homerun', label: 'HR', color: '#F0B429' },
  { result: 'walk', label: 'BB', color: '#60A5FA' },
  { result: 'error', label: 'ROE', color: '#60A5FA' },
  { result: 'out', label: 'OUT', color: '#8A9BBB' },
  { result: 'strikeout', label: 'K', color: '#F87171' },
  { result: 'double_play', label: 'DP', color: '#F87171' },
];

type TeamNum = 1 | 2;

interface DerivedState {
  inning: number;
  isTopHalf: boolean; // top = the team that bats first is up
  outs: number;
  battingTeam: TeamNum;
}

export default function TeamGamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [roster1, setRoster1] = useState<(GamePlayer & { player: Player })[]>([]);
  const [roster2, setRoster2] = useState<(GamePlayer & { player: Player })[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pendingResult, setPendingResult] = useState<AtBatResult | null>(null);
  const [rbiInput, setRbiInput] = useState(0);

  const [showEndModal, setShowEndModal] = useState(false);
  const [t1Final, setT1Final] = useState('');
  const [t2Final, setT2Final] = useState('');
  const [ending, setEnding] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const loadGame = useCallback(async () => {
    const { data: gameData } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (!gameData || gameData.game_mode !== '2v2_teams') {
      router.push('/');
      return;
    }
    setGame(gameData);

    const { data: gps } = await supabase
      .from('game_players')
      .select('*, player:players(*)')
      .eq('game_id', gameId)
      .order('batting_order');

    setRoster1((gps || []).filter((g) => g.team === 1));
    setRoster2((gps || []).filter((g) => g.team === 2));

    const { data: abs } = await supabase
      .from('at_bats')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at');
    setAtBats(abs || []);
    setLoading(false);
  }, [gameId, router]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // The team that bats first (top of each inning). Immutable for the game.
  const firstTeam: TeamNum = (game?.batting_team as TeamNum) || 1;
  const otherTeam = (t: TeamNum): TeamNum => (t === 1 ? 2 : 1);

  const teamOf = useCallback(
    (playerId: string): TeamNum | null => {
      if (roster1.some((g) => g.player_id === playerId)) return 1;
      if (roster2.some((g) => g.player_id === playerId)) return 2;
      return null;
    },
    [roster1, roster2]
  );

  // Replay at-bats to derive the exact live state — reload- and undo-safe.
  const derive = useCallback((): DerivedState => {
    let inning = 1;
    let isTopHalf = true;
    let outs = 0;
    let battingTeam: TeamNum = firstTeam;
    for (const ab of atBats) {
      outs += outsFor(ab.result);
      if (outs >= 3) {
        outs = 0;
        if (isTopHalf) {
          isTopHalf = false;
        } else {
          isTopHalf = true;
          inning += 1;
        }
        battingTeam = otherTeam(battingTeam);
      }
    }
    return { inning, isTopHalf, outs, battingTeam };
  }, [atBats, firstTeam]);

  const state = derive();
  const battingRoster = state.battingTeam === 1 ? roster1 : roster2;
  const fieldingTeam = otherTeam(state.battingTeam);
  const fieldingRoster = fieldingTeam === 1 ? roster1 : roster2;

  // Current batter: within a team, players alternate each plate appearance
  const teamAtBatCount = atBats.filter((ab) => teamOf(ab.player_id) === state.battingTeam).length;
  const currentBatter = battingRoster[teamAtBatCount % (battingRoster.length || 1)];

  // Fielding pitcher rotates by inning between the fielding team's two players
  const currentPitcher = fieldingRoster[(state.inning - 1) % (fieldingRoster.length || 1)];

  // Live run tally (RBI-based) per team
  const runsFor = (t: TeamNum) =>
    atBats.filter((ab) => teamOf(ab.player_id) === t).reduce((s, ab) => s + (ab.rbi || 0), 0);
  const t1Runs = runsFor(1);
  const t2Runs = runsFor(2);

  // Rebuild both pitchers' lines from at-bats and upsert. Idempotent → undo-safe.
  const syncPitchingStats = useCallback(async (abs: AtBat[]) => {
    const byPitcher: Record<string, AtBat[]> = {};
    for (const ab of abs) {
      if (!ab.pitcher_id) continue;
      (byPitcher[ab.pitcher_id] ||= []).push(ab);
    }
    const rows = Object.entries(byPitcher).map(([pid, faced]) => ({
      game_id: gameId,
      player_id: pid,
      outs_recorded: faced.reduce((s, ab) => s + outsFor(ab.result), 0),
      strikeouts: faced.filter((ab) => ab.result === 'strikeout').length,
      walks: faced.filter((ab) => ab.result === 'walk').length,
      hits_allowed: faced.filter((ab) => isHit(ab.result)).length,
      earned_runs: faced.reduce((s, ab) => s + (ab.rbi || 0), 0),
    }));
    if (rows.length > 0) {
      await supabase.from('pitching_stats').upsert(rows, { onConflict: 'game_id,player_id' });
    }
  }, [gameId]);

  const defaultRbi = (result: AtBatResult) => (result === 'homerun' ? 1 : 0);

  const selectResult = (result: AtBatResult) => {
    setPendingResult(result);
    setRbiInput(defaultRbi(result));
  };

  const confirmAtBat = async () => {
    if (!pendingResult || !currentBatter || saving) return;
    setSaving(true);
    try {
      await supabase.from('at_bats').insert({
        game_id: gameId,
        player_id: currentBatter.player_id,
        pitcher_id: currentPitcher?.player_id || null,
        inning: state.inning,
        result: pendingResult,
        rbi: rbiInput,
        innings_pitched: 0,
        hits_allowed: 0,
        runs_allowed: 0,
        earned_runs: 0,
        walks_allowed: 0,
        strikeouts_pitched: 0,
      });

      const { data: abs } = await supabase
        .from('at_bats')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at');
      const fresh = abs || [];
      setAtBats(fresh);
      await syncPitchingStats(fresh);

      // Keep the games row roughly in sync for the dashboard live card
      const next = deriveFrom(fresh);
      await supabase
        .from('games')
        .update({
          current_inning: next.inning,
          current_outs: next.outs,
          batting_team: next.battingTeam,
          current_pitcher_id: (next.battingTeam === 1 ? roster2 : roster1)[(next.inning - 1) % 2]?.player_id || null,
        })
        .eq('id', gameId);

      setPendingResult(null);
      setRbiInput(0);
    } finally {
      setSaving(false);
    }
  };

  // Standalone replay used right after a mutation (state var may be stale)
  const deriveFrom = useCallback(
    (abs: AtBat[]): DerivedState => {
      let inning = 1;
      let isTopHalf = true;
      let outs = 0;
      let battingTeam: TeamNum = firstTeam;
      for (const ab of abs) {
        outs += outsFor(ab.result);
        if (outs >= 3) {
          outs = 0;
          if (isTopHalf) isTopHalf = false;
          else {
            isTopHalf = true;
            inning += 1;
          }
          battingTeam = battingTeam === 1 ? 2 : 1;
        }
      }
      return { inning, isTopHalf, outs, battingTeam };
    },
    [firstTeam]
  );

  const undoLast = async () => {
    if (atBats.length === 0 || saving) return;
    setSaving(true);
    try {
      const last = atBats[atBats.length - 1];
      await supabase.from('at_bats').delete().eq('id', last.id);
      const { data: abs } = await supabase
        .from('at_bats')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at');
      const fresh = abs || [];
      setAtBats(fresh);
      await syncPitchingStats(fresh);
      setPendingResult(null);
    } finally {
      setSaving(false);
    }
  };

  const openEndModal = () => {
    setT1Final(String(t1Runs));
    setT2Final(String(t2Runs));
    setShowEndModal(true);
  };

  const endGame = async () => {
    if (ending || !game) return;
    setEnding(true);
    const s1 = parseInt(t1Final) || 0;
    const s2 = parseInt(t2Final) || 0;
    const winning_team = s1 > s2 ? 1 : s2 > s1 ? 2 : null;
    await supabase
      .from('games')
      .update({
        status: 'completed',
        score: `${s1}-${s2}`,
        winning_team,
        innings: state.inning,
      })
      .eq('id', gameId);
    router.push(`/recap/${gameId}`);
  };

  const leaveGame = async () => {
    await supabase.from('pitching_stats').delete().eq('game_id', gameId);
    await supabase.from('at_bats').delete().eq('game_id', gameId);
    await supabase.from('game_players').delete().eq('game_id', gameId);
    await supabase.from('games').delete().eq('id', gameId);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading game...</div>
      </div>
    );
  }

  const battingAccent = state.battingTeam === 1 ? T1 : T2;
  const t1Name = roster1.map((g) => g.player.name).join(' + ');
  const t2Name = roster2.map((g) => g.player.name).join(' + ');
  const teamAtBatsThisHalf = atBats.filter((ab) => teamOf(ab.player_id) === state.battingTeam);

  return (
    <div className="min-h-screen pb-28" style={{ background: '#080D18' }}>
      {/* Header / scoreboard */}
      <div
        className="sticky top-0 z-40 px-4 py-3"
        style={{ background: 'rgba(8,13,24,0.94)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setShowLeaveModal(true)} className="p-1 -m-1">
            <ArrowLeft size={20} color="#8A9BBB" />
          </button>
          <span className="text-[11px] uppercase tracking-widest text-[#4A5772] font-bold">2v2 Teams · Live</span>
          <div className="flex-1" />
          <button
            onClick={undoLast}
            disabled={atBats.length === 0 || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8A9BBB' }}
          >
            <Undo2 size={13} /> Undo
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <ScoreCard name={t1Name || 'Team 1'} runs={t1Runs} accent={T1} up={state.battingTeam === 1} />
          <div className="text-center px-2">
            <div className="text-[10px] text-[#4A5772] uppercase tracking-wider">
              {state.isTopHalf ? 'Top' : 'Bot'} {state.inning}
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: i < state.outs ? '#F87171' : 'rgba(255,255,255,0.12)' }}
                />
              ))}
            </div>
            <div className="text-[9px] text-[#4A5772] mt-0.5">{state.outs} out</div>
          </div>
          <ScoreCard name={t2Name || 'Team 2'} runs={t2Runs} accent={T2} up={state.battingTeam === 2} right />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4">
        {/* Now batting */}
        <div className="mt-5 rounded-xl p-4" style={{ background: '#0F1829', border: `1px solid ${battingAccent}44` }}>
          <div className="text-[10px] uppercase tracking-widest text-[#4A5772] mb-1">Now Batting · Team {state.battingTeam}</div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold" style={{ background: '#162035', color: battingAccent }}>
              {currentBatter?.player.name[0] || '?'}
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold text-[#EFF2FF]">{currentBatter?.player.name || '—'}</div>
              <div className="text-[11px] text-[#4A5772]">
                Pitching: {currentPitcher?.player.name || '—'} (Team {fieldingTeam})
              </div>
            </div>
          </div>
        </div>

        {/* Result buttons */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {RESULT_BUTTONS.map((b) => (
            <motion.button
              key={b.result}
              whileTap={{ scale: 0.95 }}
              onClick={() => selectResult(b.result)}
              className="py-4 rounded-lg text-base font-bold transition-colors"
              style={{
                background: pendingResult === b.result ? b.color : 'rgba(255,255,255,0.05)',
                color: pendingResult === b.result ? '#080D18' : b.color,
                border: `1px solid ${b.color}44`,
              }}
            >
              {b.label}
            </motion.button>
          ))}
        </div>

        {/* RBI + confirm */}
        <AnimatePresence>
          {pendingResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 rounded-xl p-4"
              style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#8A9BBB]">RBI on the play</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setRbiInput((v) => Math.max(0, v - 1))}
                    className="w-9 h-9 rounded-lg text-xl font-bold flex items-center justify-center"
                    style={{ background: '#162035', color: '#EFF2FF' }}
                  >
                    −
                  </button>
                  <span className="text-2xl font-bold text-[#EFF2FF] tabular-nums w-8 text-center">{rbiInput}</span>
                  <button
                    onClick={() => setRbiInput((v) => Math.min(4, v + 1))}
                    className="w-9 h-9 rounded-lg text-xl font-bold flex items-center justify-center"
                    style={{ background: '#162035', color: '#EFF2FF' }}
                  >
                    +
                  </button>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={confirmAtBat}
                disabled={saving}
                className="w-full mt-4 py-3.5 rounded-lg text-base font-bold disabled:opacity-50"
                style={{ background: battingAccent, color: '#080D18' }}
              >
                {saving ? 'Saving...' : `Log for ${currentBatter?.player.name || ''}`}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* This half-inning log */}
        {teamAtBatsThisHalf.length > 0 && (
          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-widest text-[#4A5772] mb-2">
              Team {state.battingTeam} — this game
            </div>
            <div className="space-y-1">
              {[...teamAtBatsThisHalf].slice(-6).reverse().map((ab) => {
                const p = battingRoster.find((g) => g.player_id === ab.player_id)?.player;
                return (
                  <div key={ab.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-[#8A9BBB] flex-1">{p?.name}</span>
                    <span className="text-[#EFF2FF] font-semibold uppercase">{ab.result.replace('_', ' ')}</span>
                    {ab.rbi > 0 && <span className="text-[#F0B429] text-xs">{ab.rbi} RBI</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* End game bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4" style={{ background: 'linear-gradient(to top, #080D18 60%, transparent)' }}>
        <div className="max-w-md mx-auto">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={openEndModal}
            className="w-full py-3.5 rounded-lg text-base font-bold flex items-center justify-center gap-2"
            style={{ background: '#162035', color: '#EFF2FF', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <Flag size={16} /> End Game
          </motion.button>
        </div>
      </div>

      {/* End modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-xl p-5" style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#EFF2FF]">Final Score</h2>
              <button onClick={() => setShowEndModal(false)}><X size={20} color="#8A9BBB" /></button>
            </div>
            <p className="text-[11px] text-[#4A5772] mb-4">Prefilled from RBIs. Adjust for any runs scored on errors/wild pitches, then confirm the winner.</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: T1 }}>{t1Name || 'Team 1'}</label>
                <input type="number" min="0" value={t1Final} onChange={(e) => setT1Final(e.target.value)} className="w-full px-3 py-3 rounded-lg text-center text-2xl font-bold text-[#EFF2FF]" style={{ background: '#162035', border: `1px solid ${T1}55` }} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider mb-1 block" style={{ color: T2 }}>{t2Name || 'Team 2'}</label>
                <input type="number" min="0" value={t2Final} onChange={(e) => setT2Final(e.target.value)} className="w-full px-3 py-3 rounded-lg text-center text-2xl font-bold text-[#EFF2FF]" style={{ background: '#162035', border: `1px solid ${T2}55` }} />
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.98 }} onClick={endGame} disabled={ending} className="w-full py-3.5 rounded-lg text-base font-bold disabled:opacity-50" style={{ background: '#F0B429', color: '#080D18' }}>
              {ending ? 'Saving...' : 'Finish & View Recap'}
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* Leave modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-xl p-5" style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-lg font-bold text-[#EFF2FF] mb-2">Leave this game?</h2>
            <p className="text-sm text-[#8A9BBB] mb-5">You can come back later to keep logging, or delete it entirely.</p>
            <div className="space-y-2">
              <button onClick={() => router.push('/')} className="w-full py-3 rounded-lg font-semibold" style={{ background: '#162035', color: '#EFF2FF' }}>
                Keep game, go home
              </button>
              <button onClick={leaveGame} className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2" style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                <Trash2 size={15} /> Delete game
              </button>
              <button onClick={() => setShowLeaveModal(false)} className="w-full py-3 rounded-lg font-semibold text-[#8A9BBB]">
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ name, runs, accent, up, right }: { name: string; runs: number; accent: string; up: boolean; right?: boolean }) {
  return (
    <div className={`flex-1 ${right ? 'text-right' : ''}`}>
      <div className="flex items-center gap-1.5" style={{ justifyContent: right ? 'flex-end' : 'flex-start' }}>
        {up && !right && <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />}
        <span className="text-[11px] font-semibold truncate" style={{ color: accent, maxWidth: 110 }}>{name}</span>
        {up && right && <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />}
      </div>
      <div className="text-3xl font-bold text-[#EFF2FF] tabular-nums leading-tight">{runs}</div>
    </div>
  );
}
