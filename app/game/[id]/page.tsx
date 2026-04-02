'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Undo2, Flag, Circle, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AtBatResult, Player, Game, GamePlayer, AtBat, Baserunner } from '@/lib/types';
import { calculateStats, formatAvg } from '@/lib/stats';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

const AT_BAT_BUTTONS: { result: AtBatResult; label: string; color: string; needsRbi: boolean; outsRecorded?: number }[] = [
  { result: 'single', label: 'Single', color: '#22C55E', needsRbi: true },
  { result: 'double', label: 'Double', color: '#3B82F6', needsRbi: true },
  { result: 'triple', label: 'Triple', color: '#A855F7', needsRbi: true },
  { result: 'homerun', label: 'Homerun', color: '#F97316', needsRbi: true },
  { result: 'strikeout', label: 'Strikeout', color: '#EF4444', needsRbi: false },
  { result: 'out', label: 'In Play Out', color: '#6B7280', needsRbi: true, outsRecorded: 1 },
  { result: 'double_play', label: 'Double Play', color: '#6B7280', needsRbi: true, outsRecorded: 2 },
  { result: 'error', label: 'Reached on Error', color: '#8B5CF6', needsRbi: true },
  { result: 'walk', label: 'Walk', color: '#F0B429', needsRbi: false },
];

// Pitching event types
type PitchingResult = 'k' | 'bb' | 'single' | 'double' | 'triple' | 'hr' | 'out' | 'dp';
const PITCHING_BUTTONS: { result: PitchingResult; label: string; color: string; isOut: boolean; outsRecorded: number; bases: number }[] = [
  { result: 'k', label: 'Strikeout', color: '#22C55E', isOut: true, outsRecorded: 1, bases: 0 },
  { result: 'out', label: 'Out (In Play)', color: '#6B7280', isOut: true, outsRecorded: 1, bases: 0 },
  { result: 'dp', label: 'Double Play', color: '#6B7280', isOut: true, outsRecorded: 2, bases: 0 },
  { result: 'bb', label: 'Walk', color: '#F0B429', isOut: false, outsRecorded: 0, bases: 1 },
  { result: 'single', label: 'Single', color: '#EF4444', isOut: false, outsRecorded: 0, bases: 1 },
  { result: 'double', label: 'Double', color: '#EF4444', isOut: false, outsRecorded: 0, bases: 2 },
  { result: 'triple', label: 'Triple', color: '#EF4444', isOut: false, outsRecorded: 0, bases: 3 },
  { result: 'hr', label: 'Home Run', color: '#F97316', isOut: false, outsRecorded: 0, bases: 4 },
];

// Diamond component for showing baserunners - now interactive
function BaseDiamond({
  baserunners,
  gamePlayers,
  onRunnerClick,
  interactive = false
}: {
  baserunners: Baserunner[];
  gamePlayers: (GamePlayer & { player: Player })[];
  onRunnerClick?: (base: 1 | 2 | 3) => void;
  interactive?: boolean;
}) {
  const onFirst = baserunners.find(r => r.base === 1);
  const onSecond = baserunners.find(r => r.base === 2);
  const onThird = baserunners.find(r => r.base === 3);

  const getInitial = (pitcherId: string) => {
    const p = gamePlayers.find(gp => gp.player_id === pitcherId);
    return p?.player.name[0] || '?';
  };

  return (
    <div className="relative w-32 h-32 mx-auto">
      {/* Diamond shape */}
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path d="M50 10 L90 50 L50 90 L10 50 Z" fill="none" stroke="#374151" strokeWidth="2" />
      </svg>
      {/* Second base */}
      <div
        className={`absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all ${onSecond ? 'bg-[#F0B429] text-[#080D18]' : 'bg-[#162035] text-[#4A5772]'} ${interactive && onSecond ? 'cursor-pointer hover:ring-2 hover:ring-white/50 active:scale-95' : ''}`}
        onClick={() => {
          if (interactive && onSecond) onRunnerClick?.(2);
        }}
      >
        {onSecond ? getInitial(onSecond.pitcher_id) : '2B'}
      </div>
      {/* Third base */}
      <div
        className={`absolute top-1/2 left-1 -translate-y-1/2 w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all ${onThird ? 'bg-[#F0B429] text-[#080D18]' : 'bg-[#162035] text-[#4A5772]'} ${interactive && onThird ? 'cursor-pointer hover:ring-2 hover:ring-white/50 active:scale-95' : ''}`}
        onClick={() => {
          if (interactive && onThird) onRunnerClick?.(3);
        }}
      >
        {onThird ? getInitial(onThird.pitcher_id) : '3B'}
      </div>
      {/* First base */}
      <div
        className={`absolute top-1/2 right-1 -translate-y-1/2 w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all ${onFirst ? 'bg-[#F0B429] text-[#080D18]' : 'bg-[#162035] text-[#4A5772]'} ${interactive && onFirst ? 'cursor-pointer hover:ring-2 hover:ring-white/50 active:scale-95' : ''}`}
        onClick={() => {
          if (interactive && onFirst) onRunnerClick?.(1);
        }}
      >
        {onFirst ? getInitial(onFirst.pitcher_id) : '1B'}
      </div>
      {/* Home plate */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rotate-45" />
    </div>
  );
}

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<(GamePlayer & { player: Player })[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [currentBatterIndex, setCurrentBatterIndex] = useState(0);
  const [pendingResult, setPendingResult] = useState<AtBatResult | null>(null);
  const [rbiInput, setRbiInput] = useState(0);
  const [loading, setLoading] = useState(true);

  // End game modal state
  const [showEndModal, setShowEndModal] = useState(false);
  const [ourScore, setOurScore] = useState('');
  const [theirScore, setTheirScore] = useState('');
  const [inningsPlayed, setInningsPlayed] = useState('');
  const [ending, setEnding] = useState(false);

  // Leave game modal state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Pitching state
  const [isPitchingMode, setIsPitchingMode] = useState(false);
  const [currentPitcherId, setCurrentPitcherId] = useState<string | null>(null);
  const [baserunners, setBaserunners] = useState<Baserunner[]>([]);
  const [runsInput, setRunsInput] = useState(0);
  const [pendingPitchingResult, setPendingPitchingResult] = useState<PitchingResult | null>(null);
  const [pitchingStats, setPitchingStats] = useState<Record<string, { outs: number; k: number; bb: number; h: number; er: number }>>({});
  // Manual baserunner selection for hits
  const [manualRunners, setManualRunners] = useState<{ first: boolean; second: boolean; third: boolean }>({ first: false, second: false, third: false });
  // Runner action popup (for caught stealing, advancing, etc.)
  const [editingRunner, setEditingRunner] = useState<1 | 2 | 3 | null>(null);
  // Pitching event history for undo
  type PitchingEvent = {
    result: PitchingResult;
    pitcherId: string;
    outsRecorded: number;
    runsScored: number;
    runsByPitcher: Record<string, number>;
    prevBaserunners: Baserunner[];
    prevOuts: number;
    prevInning: number;
    statsChanges: { k: number; bb: number; h: number };
  };
  const [pitchingHistory, setPitchingHistory] = useState<PitchingEvent[]>([]);

  // Helper to calculate current batter for 1v1 based on total outs
  const calculateH2HBatterIndex = useCallback((atBatsData: AtBat[], numPlayers: number) => {
    if (numPlayers === 0) return 0;
    const totalOuts = atBatsData.filter(
      (ab) => ab.result === 'out' || ab.result === 'strikeout'
    ).length;
    // Every 3 outs, switch to next batter
    const halfInnings = Math.floor(totalOuts / 3);
    return halfInnings % numPlayers;
  }, []);

  const loadGame = useCallback(async () => {
    const { data: gameData } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!gameData) {
      router.push('/');
      return;
    }

    setGame(gameData);

    // Initialize pitching mode based on game settings
    if (gameData.track_pitching) {
      // If batting_first is true, we start batting (not pitching mode)
      // If batting_first is false, we start pitching
      setIsPitchingMode(!gameData.batting_first);
      setCurrentPitcherId(gameData.current_pitcher_id);
    }

    const { data: gamePlayersData } = await supabase
      .from('game_players')
      .select('*, player:players(*)')
      .eq('game_id', gameId)
      .order('batting_order');

    setGamePlayers(gamePlayersData || []);

    const { data: atBatsData } = await supabase
      .from('at_bats')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at');

    setAtBats(atBatsData || []);

    // Load pitching stats if tracking pitching
    if (gameData.track_pitching) {
      const { data: pitchingData } = await supabase
        .from('pitching_stats')
        .select('*')
        .eq('game_id', gameId);

      const stats: Record<string, { outs: number; k: number; bb: number; h: number; er: number }> = {};
      pitchingData?.forEach(ps => {
        stats[ps.player_id] = {
          outs: ps.outs_recorded,
          k: ps.strikeouts,
          bb: ps.walks,
          h: ps.hits_allowed,
          er: ps.earned_runs,
        };
      });
      setPitchingStats(stats);
    }

    // Calculate current batter
    if (atBatsData && gamePlayersData && gamePlayersData.length > 0) {
      if (gameData.game_mode === '1v1') {
        // For 1v1, switch every 3 outs
        const batterIndex = calculateH2HBatterIndex(atBatsData, gamePlayersData.length);
        setCurrentBatterIndex(batterIndex);
      } else {
        // For co-op, rotate every at-bat
        const batterIndex = atBatsData.length % gamePlayersData.length;
        setCurrentBatterIndex(batterIndex);
      }
    }

    setLoading(false);
  }, [gameId, router, calculateH2HBatterIndex]);

  useEffect(() => {
    loadGame();

    // Set up real-time subscriptions for live updates
    const gameChannel = supabase
      .channel(`game-updates-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updatedGame = payload.new as Game;
          setGame(updatedGame);
          if (updatedGame.track_pitching) {
            setCurrentPitcherId(updatedGame.current_pitcher_id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'at_bats',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newAtBat = payload.new as AtBat;
          setAtBats((prev) => {
            // Avoid duplicates
            if (prev.some(ab => ab.id === newAtBat.id)) return prev;
            const updated = [...prev, newAtBat];
            // Recalculate batter index
            if (game?.game_mode === '1v1') {
              setCurrentBatterIndex(calculateH2HBatterIndex(updated, gamePlayers.length));
            } else {
              setCurrentBatterIndex(updated.length % gamePlayers.length);
            }
            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'at_bats',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          // Reload on delete (undo)
          loadGame();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pitching_stats',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const ps = payload.new as { player_id: string; outs_recorded: number; strikeouts: number; walks: number; hits_allowed: number; earned_runs: number };
            setPitchingStats((prev) => ({
              ...prev,
              [ps.player_id]: {
                outs: ps.outs_recorded,
                k: ps.strikeouts,
                bb: ps.walks,
                h: ps.hits_allowed,
                er: ps.earned_runs,
              },
            }));
          } else if (payload.eventType === 'DELETE') {
            loadGame();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [loadGame, gameId, game?.game_mode, gamePlayers.length, calculateH2HBatterIndex]);

  const recordAtBat = async () => {
    if (!pendingResult || !game) return;

    const currentPlayer = gamePlayers[currentBatterIndex];
    const buttonInfo = AT_BAT_BUTTONS.find(b => b.result === pendingResult);

    // Record the at-bat
    const { data: newAtBat } = await supabase
      .from('at_bats')
      .insert({
        game_id: gameId,
        player_id: currentPlayer.player_id,
        inning: game.current_inning,
        result: pendingResult,
        rbi: rbiInput,
      })
      .select()
      .single();

    if (newAtBat) {
      const updatedAtBats = [...atBats, newAtBat];
      setAtBats(updatedAtBats);

      // Check if this was an out (including double play)
      const isOut = pendingResult === 'out' || pendingResult === 'strikeout' || pendingResult === 'double_play';
      const outsRecorded = buttonInfo?.outsRecorded || (isOut ? 1 : 0);
      let newOuts = game.current_outs;
      let newInning = game.current_inning;

      if (isOut) {
        newOuts += outsRecorded;
        if (newOuts >= 3) {
          newOuts = newOuts % 3; // Handle overflow for double play at 2 outs
          newInning++;
        }
      }

      // Update game state
      await supabase
        .from('games')
        .update({ current_outs: newOuts, current_inning: newInning })
        .eq('id', gameId);

      setGame({ ...game, current_outs: newOuts, current_inning: newInning });

      // Update batter index
      if (game.game_mode === '1v1') {
        // For 1v1, switch batter when outs reset to 0 (every 3 outs)
        if (isOut && newOuts === 0) {
          setCurrentBatterIndex((prev) => (prev + 1) % gamePlayers.length);
        }
      } else {
        // For co-op modes, rotate every at-bat
        setCurrentBatterIndex((prev) => (prev + 1) % gamePlayers.length);
      }

      // Auto-switch to pitching mode after 3 outs (if tracking pitching)
      if (game.track_pitching && isOut && newOuts === 0) {
        setIsPitchingMode(true);
        setBaserunners([]);
      }
    }

    // Reset input state
    setPendingResult(null);
    setRbiInput(0);
  };

  const handleButtonClick = (result: AtBatResult, needsRbi: boolean) => {
    if (needsRbi) {
      setPendingResult(result);
    } else {
      setPendingResult(result);
    }
  };

  // Quick record hit when bases empty - no confirmation needed
  const recordQuickHit = async (hitType: PitchingResult) => {
    if (!game || !currentPitcherId) return;

    const buttonInfo = PITCHING_BUTTONS.find(b => b.result === hitType);
    if (!buttonInfo) return;

    // Place batter on the appropriate base
    const newBaserunners: Baserunner[] = [];
    if (buttonInfo.bases <= 3) {
      newBaserunners.push({ base: buttonInfo.bases as 1 | 2 | 3, pitcher_id: currentPitcherId });
    }

    // Update current pitcher's stats
    const { data: currentStats } = await supabase
      .from('pitching_stats')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', currentPitcherId)
      .single();

    const statsUpdate = {
      outs_recorded: currentStats?.outs_recorded || 0,
      strikeouts: currentStats?.strikeouts || 0,
      walks: currentStats?.walks || 0,
      hits_allowed: (currentStats?.hits_allowed || 0) + 1,
    };

    if (currentStats) {
      await supabase.from('pitching_stats').update(statsUpdate).eq('id', currentStats.id);
    } else {
      await supabase.from('pitching_stats').insert({
        game_id: gameId,
        player_id: currentPitcherId,
        ...statsUpdate,
        earned_runs: 0,
      });
    }

    // Update local pitching stats
    const newPitchingStats = { ...pitchingStats };
    if (!newPitchingStats[currentPitcherId]) {
      newPitchingStats[currentPitcherId] = { outs: 0, k: 0, bb: 0, h: 0, er: 0 };
    }
    newPitchingStats[currentPitcherId].h += 1;
    setPitchingStats(newPitchingStats);

    setBaserunners(newBaserunners);
  };

  // Handle runner actions (move to different base or mark out)
  const handleRunnerAction = async (action: 'out' | 'advance' | 'score', targetBase?: 2 | 3) => {
    if (!editingRunner || !game) return;

    const runner = baserunners.find(r => r.base === editingRunner);
    if (!runner) return;

    let newBaserunners = baserunners.filter(r => r.base !== editingRunner);
    let newOuts = game.current_outs;
    let newInning = game.current_inning;

    if (action === 'out') {
      // Runner caught stealing / picked off
      newOuts++;
      if (newOuts >= 3) {
        newOuts = 0;
        newInning++;
        newBaserunners = [];
        // Auto-switch to batting after 3 outs
        setIsPitchingMode(false);
      }

      // Update game state
      await supabase
        .from('games')
        .update({ current_outs: newOuts, current_inning: newInning })
        .eq('id', gameId);

      setGame({ ...game, current_outs: newOuts, current_inning: newInning });
    } else if (action === 'advance' && targetBase) {
      // Move runner to target base (if not occupied)
      const targetOccupied = baserunners.some(r => r.base === targetBase);
      if (!targetOccupied) {
        newBaserunners.push({ base: targetBase, pitcher_id: runner.pitcher_id });
      }
    } else if (action === 'score') {
      // Runner scored - attribute to pitcher who put them on
      if (currentPitcherId) {
        const { data: existingStats } = await supabase
          .from('pitching_stats')
          .select('*')
          .eq('game_id', gameId)
          .eq('player_id', runner.pitcher_id)
          .single();

        if (existingStats) {
          await supabase
            .from('pitching_stats')
            .update({ earned_runs: existingStats.earned_runs + 1 })
            .eq('id', existingStats.id);
        } else {
          await supabase.from('pitching_stats').insert({
            game_id: gameId,
            player_id: runner.pitcher_id,
            earned_runs: 1,
          });
        }

        // Update local stats
        const newPitchingStats = { ...pitchingStats };
        if (!newPitchingStats[runner.pitcher_id]) {
          newPitchingStats[runner.pitcher_id] = { outs: 0, k: 0, bb: 0, h: 0, er: 0 };
        }
        newPitchingStats[runner.pitcher_id].er += 1;
        setPitchingStats(newPitchingStats);
      }
    }

    setBaserunners(newBaserunners);
    setEditingRunner(null);
  };

  // Calculate runs scored based on hit type and runners on base
  const calculateRunsFromHit = (hitType: PitchingResult, runners: Baserunner[]): { runsScored: number; runsByPitcher: Record<string, number>; newRunners: Baserunner[] } => {
    const buttonInfo = PITCHING_BUTTONS.find(b => b.result === hitType);
    if (!buttonInfo || buttonInfo.isOut) {
      return { runsScored: 0, runsByPitcher: {}, newRunners: runners };
    }

    const bases = buttonInfo.bases;
    let runsScored = 0;
    const runsByPitcher: Record<string, number> = {};
    let newRunners: Baserunner[] = [];

    if (bases === 4) {
      // Home run - everyone scores
      runsScored = runners.length + 1; // runners + batter
      runners.forEach(r => {
        runsByPitcher[r.pitcher_id] = (runsByPitcher[r.pitcher_id] || 0) + 1;
      });
      // Batter scores too - attribute to current pitcher
      runsByPitcher[currentPitcherId!] = (runsByPitcher[currentPitcherId!] || 0) + 1;
      newRunners = [];
    } else {
      // Advance runners by hit bases
      const sortedRunners = [...runners].sort((a, b) => b.base - a.base);

      for (const runner of sortedRunners) {
        const newBase = runner.base + bases;
        if (newBase > 3) {
          // Runner scores
          runsScored++;
          runsByPitcher[runner.pitcher_id] = (runsByPitcher[runner.pitcher_id] || 0) + 1;
        } else {
          newRunners.push({ base: newBase as 1 | 2 | 3, pitcher_id: runner.pitcher_id });
        }
      }

      // Add batter to appropriate base
      if (bases <= 3) {
        newRunners.push({ base: bases as 1 | 2 | 3, pitcher_id: currentPitcherId! });
      }
    }

    return { runsScored, runsByPitcher, newRunners };
  };

  // Record pitching event
  const recordPitchingEvent = async () => {
    if (!pendingPitchingResult || !game || !currentPitcherId) return;

    const buttonInfo = PITCHING_BUTTONS.find(b => b.result === pendingPitchingResult);
    const isOut = buttonInfo?.isOut || false;
    const outsToRecord = buttonInfo?.outsRecorded || 0;
    const isHit = ['single', 'double', 'triple', 'hr'].includes(pendingPitchingResult);
    const isWalk = pendingPitchingResult === 'bb';

    // Save state for undo
    const prevBaserunners = [...baserunners];
    const prevOuts = game.current_outs;
    const prevInning = game.current_inning;

    let newOuts = game.current_outs;
    let newInning = game.current_inning;
    let newBaserunners = [...baserunners];

    // Calculate runs and new baserunner positions
    let totalRuns = runsInput;
    let runsByPitcher: Record<string, number> = {};

    if (isHit) {
      if (pendingPitchingResult === 'hr') {
        // Home run - everyone scores, bases cleared
        newBaserunners = [];
        totalRuns = baserunners.length + 1; // All runners + batter
        // Attribute runs to each pitcher
        baserunners.forEach(r => {
          runsByPitcher[r.pitcher_id] = (runsByPitcher[r.pitcher_id] || 0) + 1;
        });
        // Batter scores too
        runsByPitcher[currentPitcherId] = (runsByPitcher[currentPitcherId] || 0) + 1;
      } else {
        // Use manual runner positions
        newBaserunners = [];
        if (manualRunners.first) {
          newBaserunners.push({ base: 1, pitcher_id: currentPitcherId });
        }
        if (manualRunners.second) {
          // Find who was closest to second (runner from 1st or batter)
          const runnerFrom1st = baserunners.find(r => r.base === 1);
          newBaserunners.push({ base: 2, pitcher_id: runnerFrom1st?.pitcher_id || currentPitcherId });
        }
        if (manualRunners.third) {
          // Find who was closest to third
          const runnerFrom2nd = baserunners.find(r => r.base === 2);
          const runnerFrom1st = baserunners.find(r => r.base === 1);
          newBaserunners.push({ base: 3, pitcher_id: runnerFrom2nd?.pitcher_id || runnerFrom1st?.pitcher_id || currentPitcherId });
        }

        // Attribute runs to pitchers who put runners on base
        if (totalRuns > 0) {
          // Sort by base descending (3rd scores first, then 2nd, then 1st)
          const sortedRunners = [...baserunners].sort((a, b) => b.base - a.base);
          for (let i = 0; i < Math.min(totalRuns, sortedRunners.length); i++) {
            const runner = sortedRunners[i];
            runsByPitcher[runner.pitcher_id] = (runsByPitcher[runner.pitcher_id] || 0) + 1;
          }
          // If more runs than runners on base, batter also scored
          if (totalRuns > baserunners.length) {
            runsByPitcher[currentPitcherId] = (runsByPitcher[currentPitcherId] || 0) + (totalRuns - baserunners.length);
          }
        }
      }
    } else if (isWalk) {
      // Walk - advance runners if forced
      const onFirst = baserunners.find(r => r.base === 1);
      const onSecond = baserunners.find(r => r.base === 2);
      const onThird = baserunners.find(r => r.base === 3);

      if (onFirst && onSecond && onThird) {
        // Bases loaded - runner on 3rd scores
        totalRuns = runsInput > 0 ? runsInput : 1;
        runsByPitcher[onThird.pitcher_id] = 1;
        newBaserunners = [
          { base: 1, pitcher_id: currentPitcherId },
          { base: 2, pitcher_id: onFirst.pitcher_id },
          { base: 3, pitcher_id: onSecond.pitcher_id },
        ];
      } else if (onFirst && onSecond) {
        newBaserunners = [
          { base: 1, pitcher_id: currentPitcherId },
          { base: 2, pitcher_id: onFirst.pitcher_id },
          { base: 3, pitcher_id: onSecond.pitcher_id },
        ];
      } else if (onFirst) {
        newBaserunners = [
          { base: 1, pitcher_id: currentPitcherId },
          { base: 2, pitcher_id: onFirst.pitcher_id },
          ...(onThird ? [onThird] : []),
        ];
      } else {
        newBaserunners = [
          { base: 1, pitcher_id: currentPitcherId },
          ...(onSecond ? [onSecond] : []),
          ...(onThird ? [onThird] : []),
        ];
      }
    } else if (isOut) {
      // Handle outs (including double play)
      newOuts += outsToRecord;

      // Use manual runner positions if there were runners
      if (baserunners.length > 0) {
        newBaserunners = [];
        if (manualRunners.first) {
          // Keep closest runner to first
          const runnerFrom1st = baserunners.find(r => r.base === 1);
          newBaserunners.push({ base: 1, pitcher_id: runnerFrom1st?.pitcher_id || currentPitcherId });
        }
        if (manualRunners.second) {
          const runnerFrom2nd = baserunners.find(r => r.base === 2);
          const runnerFrom1st = baserunners.find(r => r.base === 1);
          newBaserunners.push({ base: 2, pitcher_id: runnerFrom2nd?.pitcher_id || runnerFrom1st?.pitcher_id || currentPitcherId });
        }
        if (manualRunners.third) {
          const runnerFrom3rd = baserunners.find(r => r.base === 3);
          const runnerFrom2nd = baserunners.find(r => r.base === 2);
          newBaserunners.push({ base: 3, pitcher_id: runnerFrom3rd?.pitcher_id || runnerFrom2nd?.pitcher_id || currentPitcherId });
        }
      }

      // Check for inning end
      if (newOuts >= 3) {
        newOuts = 0;
        newInning++;
        newBaserunners = [];
      }

      // Attribute runs to the pitchers who put runners on
      if (totalRuns > 0) {
        const sortedRunners = [...baserunners].sort((a, b) => b.base - a.base);
        for (let i = 0; i < Math.min(totalRuns, sortedRunners.length); i++) {
          const runner = sortedRunners[i];
          runsByPitcher[runner.pitcher_id] = (runsByPitcher[runner.pitcher_id] || 0) + 1;
        }
      }
    }

    // Update pitching stats for each pitcher who gave up runs
    for (const [pitcherId, runs] of Object.entries(runsByPitcher)) {
      const { data: existingStats } = await supabase
        .from('pitching_stats')
        .select('*')
        .eq('game_id', gameId)
        .eq('player_id', pitcherId)
        .single();

      if (existingStats) {
        await supabase
          .from('pitching_stats')
          .update({ earned_runs: existingStats.earned_runs + runs })
          .eq('id', existingStats.id);
      } else {
        await supabase.from('pitching_stats').insert({
          game_id: gameId,
          player_id: pitcherId,
          earned_runs: runs,
        });
      }
    }

    // Update current pitcher's stats (K, BB, hits, outs)
    const { data: currentStats } = await supabase
      .from('pitching_stats')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', currentPitcherId)
      .single();

    const statsChanges = {
      k: pendingPitchingResult === 'k' ? 1 : 0,
      bb: isWalk ? 1 : 0,
      h: isHit ? 1 : 0,
    };

    const statsUpdate = {
      outs_recorded: (currentStats?.outs_recorded || 0) + outsToRecord,
      strikeouts: (currentStats?.strikeouts || 0) + statsChanges.k,
      walks: (currentStats?.walks || 0) + statsChanges.bb,
      hits_allowed: (currentStats?.hits_allowed || 0) + statsChanges.h,
    };

    if (currentStats) {
      await supabase.from('pitching_stats').update(statsUpdate).eq('id', currentStats.id);
    } else {
      await supabase.from('pitching_stats').insert({
        game_id: gameId,
        player_id: currentPitcherId,
        ...statsUpdate,
        earned_runs: runsByPitcher[currentPitcherId] || 0,
      });
    }

    // Save to history for undo
    setPitchingHistory(prev => [...prev, {
      result: pendingPitchingResult,
      pitcherId: currentPitcherId,
      outsRecorded: outsToRecord,
      runsScored: totalRuns,
      runsByPitcher,
      prevBaserunners,
      prevOuts,
      prevInning,
      statsChanges,
    }]);

    // Update game state
    await supabase
      .from('games')
      .update({ current_outs: newOuts, current_inning: newInning, current_pitcher_id: currentPitcherId })
      .eq('id', gameId);

    setGame({ ...game, current_outs: newOuts, current_inning: newInning, current_pitcher_id: currentPitcherId });
    setBaserunners(newBaserunners);

    // Update local pitching stats for display
    const newPitchingStats = { ...pitchingStats };

    // Update current pitcher's stats
    if (!newPitchingStats[currentPitcherId]) {
      newPitchingStats[currentPitcherId] = { outs: 0, k: 0, bb: 0, h: 0, er: 0 };
    }
    newPitchingStats[currentPitcherId] = {
      outs: newPitchingStats[currentPitcherId].outs + outsToRecord,
      k: newPitchingStats[currentPitcherId].k + statsChanges.k,
      bb: newPitchingStats[currentPitcherId].bb + statsChanges.bb,
      h: newPitchingStats[currentPitcherId].h + statsChanges.h,
      er: newPitchingStats[currentPitcherId].er + (runsByPitcher[currentPitcherId] || 0),
    };

    // Update earned runs for other pitchers
    for (const [pitcherId, runs] of Object.entries(runsByPitcher)) {
      if (pitcherId !== currentPitcherId) {
        if (!newPitchingStats[pitcherId]) {
          newPitchingStats[pitcherId] = { outs: 0, k: 0, bb: 0, h: 0, er: 0 };
        }
        newPitchingStats[pitcherId].er += runs;
      }
    }

    setPitchingStats(newPitchingStats);

    // Auto-switch to batting mode after 3 outs
    if (isOut && newOuts === 0) {
      setIsPitchingMode(false);
    }

    // Reset
    setPendingPitchingResult(null);
    setRunsInput(0);
    setManualRunners({ first: false, second: false, third: false });
  };

  const undoLastAtBat = async () => {
    if (atBats.length === 0) return;

    const lastAtBat = atBats[atBats.length - 1];

    await supabase.from('at_bats').delete().eq('id', lastAtBat.id);

    // Recalculate game state
    const remainingAtBats = atBats.slice(0, -1);
    const outs = remainingAtBats.filter(
      (ab) => ab.result === 'out' || ab.result === 'strikeout'
    ).length;

    const newInning = Math.floor(outs / 3) + 1;
    const newOuts = outs % 3;

    await supabase
      .from('games')
      .update({ current_outs: newOuts, current_inning: newInning })
      .eq('id', gameId);

    loadGame();
  };

  const undoLastPitchingEvent = async () => {
    if (pitchingHistory.length === 0 || !game) return;

    const lastEvent = pitchingHistory[pitchingHistory.length - 1];

    // Restore game state
    await supabase
      .from('games')
      .update({
        current_outs: lastEvent.prevOuts,
        current_inning: lastEvent.prevInning,
      })
      .eq('id', gameId);

    // Restore pitcher stats
    const { data: currentStats } = await supabase
      .from('pitching_stats')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', lastEvent.pitcherId)
      .single();

    if (currentStats) {
      await supabase.from('pitching_stats').update({
        outs_recorded: Math.max(0, currentStats.outs_recorded - lastEvent.outsRecorded),
        strikeouts: Math.max(0, currentStats.strikeouts - lastEvent.statsChanges.k),
        walks: Math.max(0, currentStats.walks - lastEvent.statsChanges.bb),
        hits_allowed: Math.max(0, currentStats.hits_allowed - lastEvent.statsChanges.h),
        earned_runs: Math.max(0, currentStats.earned_runs - (lastEvent.runsByPitcher[lastEvent.pitcherId] || 0)),
      }).eq('id', currentStats.id);
    }

    // Restore earned runs for other pitchers
    for (const [pitcherId, runs] of Object.entries(lastEvent.runsByPitcher)) {
      if (pitcherId !== lastEvent.pitcherId) {
        const { data: pitcherStats } = await supabase
          .from('pitching_stats')
          .select('*')
          .eq('game_id', gameId)
          .eq('player_id', pitcherId)
          .single();

        if (pitcherStats) {
          await supabase.from('pitching_stats').update({
            earned_runs: Math.max(0, pitcherStats.earned_runs - runs),
          }).eq('id', pitcherStats.id);
        }
      }
    }

    // Update local state
    setGame({ ...game, current_outs: lastEvent.prevOuts, current_inning: lastEvent.prevInning });
    setBaserunners(lastEvent.prevBaserunners);

    // Update local pitching stats
    const newPitchingStats = { ...pitchingStats };
    if (newPitchingStats[lastEvent.pitcherId]) {
      newPitchingStats[lastEvent.pitcherId] = {
        outs: Math.max(0, newPitchingStats[lastEvent.pitcherId].outs - lastEvent.outsRecorded),
        k: Math.max(0, newPitchingStats[lastEvent.pitcherId].k - lastEvent.statsChanges.k),
        bb: Math.max(0, newPitchingStats[lastEvent.pitcherId].bb - lastEvent.statsChanges.bb),
        h: Math.max(0, newPitchingStats[lastEvent.pitcherId].h - lastEvent.statsChanges.h),
        er: Math.max(0, newPitchingStats[lastEvent.pitcherId].er - (lastEvent.runsByPitcher[lastEvent.pitcherId] || 0)),
      };
    }
    for (const [pitcherId, runs] of Object.entries(lastEvent.runsByPitcher)) {
      if (pitcherId !== lastEvent.pitcherId && newPitchingStats[pitcherId]) {
        newPitchingStats[pitcherId].er = Math.max(0, newPitchingStats[pitcherId].er - runs);
      }
    }
    setPitchingStats(newPitchingStats);

    // Remove from history
    setPitchingHistory(prev => prev.slice(0, -1));
  };

  const endGame = async () => {
    if (ending || !game) return;
    setEnding(true);

    const us = parseInt(ourScore) || 0;
    const them = parseInt(theirScore) || 0;
    const innings = parseInt(inningsPlayed) || 0;
    const result = us > them ? 'W' : us < them ? 'L' : 'T';
    const score = `${result} ${us}-${them}`;

    // For co-op games, create or find a session now that the game is complete
    let sessionId: string | null = null;
    if (game.game_mode !== '1v1') {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];

      // Check for an active session (activity within last 2 hours)
      const { data: recentSessions } = await supabase
        .from('sessions')
        .select('*')
        .neq('id', 'a0000000-0000-0000-0000-000000000001')
        .gte('last_activity', twoHoursAgo)
        .order('last_activity', { ascending: false })
        .limit(1);

      if (recentSessions && recentSessions.length > 0) {
        // Use existing active session
        sessionId = recentSessions[0].id;
        await supabase
          .from('sessions')
          .update({ last_activity: now.toISOString() })
          .eq('id', sessionId);
      } else {
        // Create new session
        const { data: newSession } = await supabase
          .from('sessions')
          .insert({
            date: today,
            label: `Game Night ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            last_activity: now.toISOString(),
            is_active: true,
          })
          .select()
          .single();
        sessionId = newSession?.id || null;
      }
    }

    await supabase
      .from('games')
      .update({ status: 'completed', score, innings, session_id: sessionId })
      .eq('id', gameId);

    router.push(`/recap/${gameId}`);
  };

  const leaveGame = async () => {
    if (leaving) return;
    setLeaving(true);

    // Delete all at-bats for this game
    await supabase.from('at_bats').delete().eq('game_id', gameId);

    // Delete game_players
    await supabase.from('game_players').delete().eq('game_id', gameId);

    // Delete the game
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

  if (!game || gamePlayers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4" style={{ background: '#080D18' }}>
        <p className="text-[#4A5772]">Game not found</p>
        <button onClick={() => router.push('/')} className="text-[#60A5FA] hover:underline">
          Go home
        </button>
      </div>
    );
  }

  const currentPlayer = gamePlayers[currentBatterIndex];
  const pendingButton = AT_BAT_BUTTONS.find(b => b.result === pendingResult);
  const needsRbi = pendingButton?.needsRbi || false;

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080D18' }}>
      {/* Leave Game Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-xl p-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.15)' }}
              >
                <AlertTriangle size={20} color="#EF4444" />
              </div>
              <h2 className="text-lg font-bold text-[#EFF2FF]">Leave Game?</h2>
            </div>

            <p className="text-sm text-[#8A9BBB] mb-6">
              Are you sure you want to leave this game? All stats won&apos;t be saved and the game will be deleted.
            </p>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                No, Continue
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={leaveGame}
                disabled={leaving}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#EF4444', color: '#FFF' }}
              >
                {leaving ? 'Leaving...' : 'Yes, Leave'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* End Game Modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-xl p-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#EFF2FF]">Final Score</h2>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowEndModal(false)}
                className="p-1"
              >
                <X size={20} color="#8A9BBB" />
              </motion.button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                  {game.game_mode === '1v1' ? gamePlayers[0]?.player.name || 'Player 1' : 'Snigurs'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={ourScore}
                  onChange={(e) => setOurScore(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-lg text-xl font-bold text-center text-[#EFF2FF] placeholder-[#4A5772]"
                  style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                  {game.game_mode === '1v1' ? gamePlayers[1]?.player.name || 'Player 2' : 'Opponents'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={theirScore}
                  onChange={(e) => setTheirScore(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-lg text-xl font-bold text-center text-[#EFF2FF] placeholder-[#4A5772]"
                  style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 block">
                  Innings
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={inningsPlayed}
                  onChange={(e) => setInningsPlayed(e.target.value)}
                  placeholder="9"
                  className="w-full px-4 py-3 rounded-lg text-xl font-bold text-center text-[#EFF2FF] placeholder-[#4A5772]"
                  style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowEndModal(false)}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={endGame}
                disabled={ending}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#22C55E', color: '#080D18' }}
              >
                {ending ? 'Saving...' : 'Save & End'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Header */}
      <div
        className="sticky top-0 z-50 flex items-center gap-3 px-5 py-4"
        style={{
          background: 'rgba(8,13,24,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowLeaveModal(true)}
          className="p-2 -m-2"
        >
          <ArrowLeft size={20} color="#8A9BBB" />
        </motion.button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">LIVE GAME</h1>
          <div className="text-[11px] text-[#4A5772]">
            Inning {game.current_inning}
            {game.game_mode === '1v1' && ' · Head to Head'}
            {game.track_pitching && (isPitchingMode ? ' · Pitching' : ' · Batting')}
          </div>
        </div>

        {/* Mode toggle for pitching games */}
        {game.track_pitching && (
          <div className="flex rounded-lg overflow-hidden mr-3" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setIsPitchingMode(false)}
              className="px-3 py-1.5 text-xs font-semibold"
              style={{
                background: !isPitchingMode ? '#60A5FA' : 'transparent',
                color: !isPitchingMode ? '#080D18' : '#8A9BBB',
              }}
            >
              BAT
            </button>
            <button
              onClick={() => setIsPitchingMode(true)}
              className="px-3 py-1.5 text-xs font-semibold"
              style={{
                background: isPitchingMode ? '#EF4444' : 'transparent',
                color: isPitchingMode ? '#FFF' : '#8A9BBB',
              }}
            >
              PITCH
            </button>
          </div>
        )}

        {/* Outs indicator in header */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#4A5772] uppercase tracking-wider">Outs</span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <Circle
                key={i}
                size={12}
                fill={i < game.current_outs ? '#EF4444' : 'transparent'}
                color={i < game.current_outs ? '#EF4444' : '#4A5772'}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-5">
        {/* Pitching Mode: Pitcher Selector + Diamond */}
        {isPitchingMode && game.track_pitching ? (
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl p-5"
            style={{ background: '#0F1829', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <div className="flex gap-5">
              {/* Pitcher selector */}
              <div className="flex-1">
                <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3">Pitching</div>
                <div className="flex flex-col gap-2">
                  {gamePlayers.map((gp) => (
                    <motion.button
                      key={gp.player_id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentPitcherId(gp.player_id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                      style={{
                        background: currentPitcherId === gp.player_id ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${currentPitcherId === gp.player_id ? '#EF4444' : 'rgba(255,255,255,0.1)'}`,
                        color: currentPitcherId === gp.player_id ? '#EF4444' : '#8A9BBB',
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                        style={{ background: '#162035', color: currentPitcherId === gp.player_id ? '#EF4444' : '#8A9BBB' }}
                      >
                        {gp.player.name[0]}
                      </div>
                      {gp.player.name}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Diamond showing baserunners - tap to manage */}
              <div className="flex-shrink-0 relative">
                <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2 text-center">
                  {baserunners.length > 0 ? 'Tap runner' : 'Bases'}
                </div>
                <BaseDiamond
                  baserunners={baserunners}
                  gamePlayers={gamePlayers}
                  interactive={true}
                  onRunnerClick={(base) => setEditingRunner(base)}
                />
                <div className="text-center mt-2 text-xs text-[#4A5772]">
                  {baserunners.length === 0 ? 'Empty' : `${baserunners.length} on`}
                </div>

                {/* Runner action popup */}
                {editingRunner && (
                  <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center z-10">
                    <div
                      className="rounded-lg p-3 shadow-xl"
                      style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.2)' }}
                    >
                      <div className="text-xs text-[#8A9BBB] mb-2 text-center">
                        Runner on {editingRunner === 1 ? '1st' : editingRunner === 2 ? '2nd' : '3rd'}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {/* Move options */}
                        {editingRunner === 1 && !baserunners.some(r => r.base === 2) && (
                          <button
                            onClick={() => handleRunnerAction('advance', 2)}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-[#60A5FA]/20 text-[#60A5FA] hover:bg-[#60A5FA]/30"
                          >
                            → 2nd (Steal)
                          </button>
                        )}
                        {editingRunner === 1 && !baserunners.some(r => r.base === 3) && (
                          <button
                            onClick={() => handleRunnerAction('advance', 3)}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-[#60A5FA]/20 text-[#60A5FA] hover:bg-[#60A5FA]/30"
                          >
                            → 3rd
                          </button>
                        )}
                        {editingRunner === 2 && !baserunners.some(r => r.base === 3) && (
                          <button
                            onClick={() => handleRunnerAction('advance', 3)}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-[#60A5FA]/20 text-[#60A5FA] hover:bg-[#60A5FA]/30"
                          >
                            → 3rd (Steal)
                          </button>
                        )}
                        {editingRunner === 2 && (
                          <button
                            onClick={() => handleRunnerAction('score')}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/30"
                          >
                            Scored
                          </button>
                        )}
                        {editingRunner === 3 && (
                          <button
                            onClick={() => handleRunnerAction('score')}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/30"
                          >
                            Scored / Steal Home
                          </button>
                        )}
                        <button
                          onClick={() => handleRunnerAction('out')}
                          className="px-3 py-1.5 rounded text-xs font-medium bg-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/30"
                        >
                          Out (CS/PO)
                        </button>
                        <button
                          onClick={() => setEditingRunner(null)}
                          className="px-3 py-1.5 rounded text-xs font-medium bg-[#4A5772]/20 text-[#8A9BBB] hover:bg-[#4A5772]/30"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Current Batter */
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-center py-8 rounded-xl"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2">Now Batting</div>
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold mx-auto mb-3"
              style={{ background: '#162035', color: '#F0B429' }}
            >
              {currentPlayer.player.name[0]}
            </div>
            <div className="text-3xl font-bold text-[#EFF2FF]">{currentPlayer.player.name}</div>
            <div className="text-sm text-[#4A5772] mt-2">
              {(() => {
                const stats = calculateStats(
                  currentPlayer.player_id,
                  currentPlayer.player.name,
                  atBats
                );
                return `${stats.hits}-${stats.at_bats} (${formatAvg(stats.avg)}) this game`;
              })()}
            </div>
          </motion.div>
        )}

        {/* Pitching Buttons or At-Bat Buttons */}
        {isPitchingMode && game.track_pitching ? (
          /* Pitching Mode Buttons */
          !pendingPitchingResult ? (
            <motion.div
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {/* Outs row */}
              <div className="grid grid-cols-3 gap-3">
                {PITCHING_BUTTONS.filter(b => b.isOut).map(({ result, label, color }) => (
                  <motion.button
                    key={result}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (!currentPitcherId) {
                        alert('Select a pitcher first');
                        return;
                      }
                      // If no runners, record immediately (except DP which needs runners)
                      if (baserunners.length === 0 && result !== 'dp') {
                        setManualRunners({ first: false, second: false, third: false });
                        setRunsInput(0);
                        setPendingPitchingResult(result);
                      } else if (result === 'dp' && baserunners.length === 0) {
                        alert('Double play requires runners on base');
                        return;
                      } else {
                        // Has runners - need to confirm runner positions
                        setManualRunners({ first: false, second: false, third: false });
                        setRunsInput(0);
                        setPendingPitchingResult(result);
                      }
                    }}
                    className="py-4 rounded-xl font-bold text-sm transition-all"
                    style={{
                      background: `${color}20`,
                      border: `1px solid ${color}50`,
                      color: color,
                      opacity: currentPitcherId ? 1 : 0.5,
                    }}
                  >
                    {label}
                  </motion.button>
                ))}
              </div>
              {/* Hits row */}
              <div className="grid grid-cols-4 gap-2">
                {PITCHING_BUTTONS.filter(b => !b.isOut && b.result !== 'bb').map(({ result, label, color, bases }) => (
                  <motion.button
                    key={result}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (!currentPitcherId) {
                        alert('Select a pitcher first');
                        return;
                      }
                      // If bases empty and not HR, just record it immediately
                      if (baserunners.length === 0 && result !== 'hr') {
                        recordQuickHit(result);
                      } else {
                        // Has runners or HR - need confirmation
                        // Pre-select batter's base position
                        if (result !== 'hr') {
                          setManualRunners({
                            first: bases === 1,
                            second: bases === 2,
                            third: bases === 3,
                          });
                        }
                        setRunsInput(0);
                        setPendingPitchingResult(result);
                      }
                    }}
                    className="py-3 rounded-lg font-semibold text-sm transition-all"
                    style={{
                      background: `${color}20`,
                      border: `1px solid ${color}50`,
                      color: color,
                      opacity: currentPitcherId ? 1 : 0.5,
                    }}
                  >
                    {label.replace(' ', '\n')}
                  </motion.button>
                ))}
              </div>
              {/* Walk button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (!currentPitcherId) {
                    alert('Select a pitcher first');
                    return;
                  }
                  setPendingPitchingResult('bb');
                }}
                className="w-full py-3 rounded-xl font-bold text-base transition-all"
                style={{
                  background: '#F0B42920',
                  border: '1px solid #F0B42950',
                  color: '#F0B429',
                  opacity: currentPitcherId ? 1 : 0.5,
                }}
              >
                Walk (BB)
              </motion.button>
            </motion.div>
          ) : (
            /* Confirm pitching event */
            <motion.div
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="rounded-xl p-5 space-y-4"
              style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="text-center">
                <div
                  className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3"
                  style={{
                    background: `${PITCHING_BUTTONS.find(b => b.result === pendingPitchingResult)?.color}30`,
                    color: PITCHING_BUTTONS.find(b => b.result === pendingPitchingResult)?.color,
                  }}
                >
                  {PITCHING_BUTTONS.find(b => b.result === pendingPitchingResult)?.label}
                </div>

                {/* For HR: just confirm, all runs auto-calculated */}
                {pendingPitchingResult === 'hr' && (
                  <div className="text-sm text-[#22C55E] font-medium">
                    {baserunners.length + 1} run{baserunners.length > 0 ? 's' : ''} will score
                  </div>
                )}

                {/* For hits with runners: ask runs scored and where runners ended up */}
                {['single', 'double', 'triple'].includes(pendingPitchingResult!) && baserunners.length > 0 && (
                  <>
                    {/* Runs scored */}
                    <div className="text-sm text-[#EFF2FF] font-medium mb-2">How many scored?</div>
                    <div className="flex justify-center gap-2 mb-4">
                      {[0, 1, 2, 3].slice(0, baserunners.length + 1).map((num) => (
                        <motion.button
                          key={num}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setRunsInput(num)}
                          className="w-12 h-12 rounded-lg font-bold text-lg transition-all"
                          style={{
                            background: runsInput === num ? '#EF4444' : '#162035',
                            color: runsInput === num ? '#FFF' : '#8A9BBB',
                            border: `1px solid ${runsInput === num ? '#EF4444' : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          {num}
                        </motion.button>
                      ))}
                    </div>

                    {/* Baserunner positions after the play */}
                    <div className="text-sm text-[#EFF2FF] font-medium mb-2">Who&apos;s on base now?</div>
                    <div className="flex justify-center gap-3">
                      {[
                        { key: 'first', label: '1B' },
                        { key: 'second', label: '2B' },
                        { key: 'third', label: '3B' },
                      ].map(({ key, label }) => (
                        <motion.button
                          key={key}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setManualRunners(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                          className="w-14 h-14 rounded-lg font-bold text-sm transition-all"
                          style={{
                            background: manualRunners[key as keyof typeof manualRunners] ? '#F0B429' : '#162035',
                            color: manualRunners[key as keyof typeof manualRunners] ? '#080D18' : '#8A9BBB',
                            border: `1px solid ${manualRunners[key as keyof typeof manualRunners] ? '#F0B429' : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          {label}
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}

                {/* For outs with runners: ask runs scored AND where runners are now */}
                {PITCHING_BUTTONS.find(b => b.result === pendingPitchingResult)?.isOut && baserunners.length > 0 && (
                  <>
                    {/* Runs scored */}
                    <div className="text-sm text-[#EFF2FF] font-medium mb-2">Runs scored on the play?</div>
                    <div className="flex justify-center gap-2 mb-4">
                      {[0, 1, 2, 3].slice(0, baserunners.length + 1).map((num) => (
                        <motion.button
                          key={num}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setRunsInput(num)}
                          className="w-12 h-12 rounded-lg font-bold text-lg transition-all"
                          style={{
                            background: runsInput === num ? '#EF4444' : '#162035',
                            color: runsInput === num ? '#FFF' : '#8A9BBB',
                            border: `1px solid ${runsInput === num ? '#EF4444' : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          {num}
                        </motion.button>
                      ))}
                    </div>

                    {/* Baserunner positions after the play */}
                    <div className="text-sm text-[#EFF2FF] font-medium mb-2">Who&apos;s on base now?</div>
                    <div className="flex justify-center gap-3">
                      {[
                        { key: 'first', label: '1B' },
                        { key: 'second', label: '2B' },
                        { key: 'third', label: '3B' },
                      ].map(({ key, label }) => (
                        <motion.button
                          key={key}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setManualRunners(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                          className="w-14 h-14 rounded-lg font-bold text-sm transition-all"
                          style={{
                            background: manualRunners[key as keyof typeof manualRunners] ? '#F0B429' : '#162035',
                            color: manualRunners[key as keyof typeof manualRunners] ? '#080D18' : '#8A9BBB',
                            border: `1px solid ${manualRunners[key as keyof typeof manualRunners] ? '#F0B429' : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          {label}
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setPendingPitchingResult(null);
                    setRunsInput(0);
                    setManualRunners({ first: false, second: false, third: false });
                  }}
                  className="flex-1 py-3 rounded-xl font-semibold"
                  style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={recordPitchingEvent}
                  className="flex-1 py-3 rounded-xl font-semibold"
                  style={{ background: '#22C55E', color: '#080D18' }}
                >
                  Confirm
                </motion.button>
              </div>
            </motion.div>
          )
        ) : !pendingResult ? (
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 gap-3"
          >
            {AT_BAT_BUTTONS.map(({ result, label, color, needsRbi }) => (
              <motion.button
                key={result}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleButtonClick(result, needsRbi)}
                className="py-5 rounded-xl font-bold text-lg transition-all"
                style={{
                  background: `${color}20`,
                  border: `1px solid ${color}50`,
                  color: color,
                }}
              >
                {label}
              </motion.button>
            ))}
          </motion.div>
        ) : needsRbi ? (
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl p-5 space-y-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-center">
              <div
                className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3"
                style={{ background: `${pendingButton?.color}30`, color: pendingButton?.color }}
              >
                {pendingButton?.label}
              </div>
              <div className="text-lg text-[#EFF2FF] font-semibold">How many RBIs?</div>
            </div>
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3, 4].map((num) => (
                <motion.button
                  key={num}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRbiInput(num)}
                  className="w-14 h-14 rounded-xl font-bold text-xl transition-all"
                  style={{
                    background: rbiInput === num ? '#F0B429' : '#162035',
                    color: rbiInput === num ? '#080D18' : '#8A9BBB',
                    border: `1px solid ${rbiInput === num ? '#F0B429' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {num}
                </motion.button>
              ))}
            </div>
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setPendingResult(null);
                  setRbiInput(0);
                }}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={recordAtBat}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#22C55E', color: '#080D18' }}
              >
                Confirm
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl p-5 space-y-4"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="text-center">
              <div
                className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
                style={{ background: `${pendingButton?.color}30`, color: pendingButton?.color }}
              >
                {pendingButton?.label}
              </div>
            </div>
            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setPendingResult(null)}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={recordAtBat}
                className="flex-1 py-3 rounded-xl font-semibold"
                style={{ background: '#22C55E', color: '#080D18' }}
              >
                Confirm
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Batting Stats Summary */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl p-4"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h3 className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3">Batting</h3>
          <div className="space-y-2">
            {gamePlayers.map((gp) => {
              const stats = calculateStats(gp.player_id, gp.player.name, atBats);
              return (
                <div key={gp.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                      style={{ background: '#162035', color: '#8A9BBB' }}
                    >
                      {gp.player.name[0]}
                    </div>
                    <span className="text-sm font-medium text-[#EFF2FF]">{gp.player.name}</span>
                  </div>
                  <span className="text-sm text-[#8A9BBB] tabular-nums">
                    {stats.hits}-{stats.at_bats}, {stats.rbi} RBI
                    {stats.homeruns > 0 && `, ${stats.homeruns} HR`}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Pitching Stats Summary */}
        {game.track_pitching && (
          <motion.div
            custom={2.5}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl p-4"
            style={{ background: '#0F1829', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <h3 className="text-[11px] text-[#EF4444] uppercase tracking-widest mb-3">Pitching</h3>
            <div className="space-y-2">
              {gamePlayers.map((gp) => {
                const ps = pitchingStats[gp.player_id] || { outs: 0, k: 0, bb: 0, h: 0, er: 0 };
                const innings = Math.floor(ps.outs / 3);
                const partialOuts = ps.outs % 3;
                const ipDisplay = partialOuts > 0 ? `${innings}.${partialOuts}` : `${innings}.0`;
                // ERA = (earned runs / outs) * 27 (for 9 innings * 3 outs)
                const era = ps.outs > 0 ? (ps.er / ps.outs) * 27 : 0;

                // Only show if pitcher has recorded any stats
                if (ps.outs === 0 && ps.k === 0 && ps.bb === 0 && ps.h === 0) return null;

                return (
                  <div key={gp.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
                      >
                        {gp.player.name[0]}
                      </div>
                      <span className="text-sm font-medium text-[#EFF2FF]">{gp.player.name}</span>
                    </div>
                    <span className="text-sm text-[#8A9BBB] tabular-nums">
                      {ipDisplay} IP, {ps.k} K, {ps.bb} BB, {ps.h} H, {ps.er} ER
                      <span className="text-[#EF4444] ml-2">({era.toFixed(2)} ERA)</span>
                    </span>
                  </div>
                );
              })}
              {Object.keys(pitchingStats).length === 0 && (
                <div className="text-sm text-[#4A5772] text-center py-2">
                  No pitching stats yet
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Recent At-Bats */}
        {atBats.length > 0 && (
          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-xl p-4"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <h3 className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3">Recent At-Bats</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {[...atBats].reverse().slice(0, 10).map((ab) => {
                const player = gamePlayers.find((gp) => gp.player_id === ab.player_id);
                const buttonInfo = AT_BAT_BUTTONS.find(b => b.result === ab.result);
                return (
                  <div
                    key={ab.id}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-[#8A9BBB]">{player?.player.name}</span>
                    <span style={{ color: buttonInfo?.color || '#8A9BBB' }}>
                      {buttonInfo?.label || ab.result}
                      {ab.rbi > 0 && <span className="text-[#4A5772]"> ({ab.rbi} RBI)</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex gap-3 pt-4"
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={isPitchingMode && game.track_pitching ? undoLastPitchingEvent : undoLastAtBat}
            disabled={isPitchingMode && game.track_pitching ? pitchingHistory.length === 0 : atBats.length === 0}
            className="flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#162035', color: '#8A9BBB', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Undo2 size={16} />
            Undo Last
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowEndModal(true)}
            className="flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
            style={{ background: '#EF4444', color: '#FFF' }}
          >
            <Flag size={16} />
            End Game
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
