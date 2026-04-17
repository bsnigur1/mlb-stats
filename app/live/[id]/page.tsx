'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Circle, Radio, Users, Timer, Trophy } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

// Format elapsed seconds as mm:ss or h:mm:ss
function formatGameTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, Game, GamePlayer, AtBat } from '@/lib/types';
import { calculateStats, formatAvg } from '@/lib/stats';

// Milestone thresholds
const MILESTONES = {
  rbi: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  hr: [50, 100, 200, 300, 400, 500, 600, 700, 750, 800, 900, 1000],
  hits: [100, 500, 1000, 1500, 2000, 2500, 3000],
  k: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  pitching_k: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
};

interface MilestoneAlert {
  playerName: string;
  stat: string;
  value: number;
  isSeason?: boolean;
}

// Milestone celebration popup
function MilestoneCelebration({ milestone, onClose }: { milestone: MilestoneAlert; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 50 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <motion.div
        initial={{ rotate: -5 }}
        animate={{ rotate: [-5, 5, -5, 5, 0] }}
        transition={{ duration: 0.5 }}
        className="relative p-8 rounded-2xl text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(240,180,41,0.2) 0%, rgba(240,180,41,0.05) 100%)',
          border: '2px solid #F0B429',
          boxShadow: '0 0 60px rgba(240,180,41,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.5, repeat: 3 }}
        >
          <Trophy size={64} color="#F0B429" className="mx-auto mb-4" />
        </motion.div>
        <div className="text-[#F0B429] text-sm font-semibold uppercase tracking-widest mb-2">
          Milestone!
        </div>
        <div className="text-3xl font-bold text-[#EFF2FF] mb-2">
          {milestone.playerName}'s
        </div>
        <div className="text-4xl font-bold text-[#F0B429]">
          {milestone.value}{milestone.value === 1 ? 'st' : milestone.value === 2 ? 'nd' : milestone.value === 3 ? 'rd' : 'th'} {milestone.stat} {milestone.isSeason ? 'This Season' : 'Career'}
        </div>
        <div className="text-sm text-[#4A5772] mt-4">Tap to dismiss</div>
      </motion.div>
    </motion.div>
  );
}

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

const pulse = {
  scale: [1, 1.2, 1],
  transition: { duration: 1.5, repeat: Infinity },
};

const AT_BAT_LABELS: Record<string, { label: string; color: string }> = {
  single: { label: 'Single', color: '#22C55E' },
  double: { label: 'Double', color: '#3B82F6' },
  triple: { label: 'Triple', color: '#A855F7' },
  homerun: { label: 'Homerun', color: '#F97316' },
  strikeout: { label: 'Strikeout', color: '#EF4444' },
  out: { label: 'In Play Out', color: '#6B7280' },
  double_play: { label: 'Double Play', color: '#6B7280' },
  error: { label: 'Reached on Error', color: '#8B5CF6' },
  walk: { label: 'Walk', color: '#F0B429' },
};

export default function LiveGamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<(GamePlayer & { player: Player })[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [pitchingStats, setPitchingStats] = useState<Record<string, { outs: number; k: number; bb: number; h: number; er: number }>>({});
  const [loading, setLoading] = useState(true);
  const [careerStats, setCareerStats] = useState<Record<string, { hr: number; rbi: number; hits: number; k: number }>>({});
  const [seasonStats, setSeasonStats] = useState<Record<string, { hr: number; rbi: number; hits: number; k: number }>>({});
  const [careerPitchingK, setCareerPitchingK] = useState<Record<string, number>>({});
  const [seasonPitchingK, setSeasonPitchingK] = useState<Record<string, number>>({});
  const [milestoneAlert, setMilestoneAlert] = useState<MilestoneAlert | null>(null);

  // Track previous atBats count for milestone detection
  const prevAtBatsCount = useRef(0);
  // Track previous pitching K's for milestone detection
  const prevPitchingK = useRef<Record<string, number>>({});

  // Check for milestones when atBats changes
  useEffect(() => {
    if (atBats.length > prevAtBatsCount.current && gamePlayers.length > 0 && Object.keys(careerStats).length > 0) {
      const newAtBat = atBats[atBats.length - 1];
      const playerId = newAtBat.player_id;
      const player = gamePlayers.find(gp => gp.player_id === playerId);

      if (player && careerStats[playerId]) {
        const career = careerStats[playerId];
        const season = seasonStats[playerId] || { hr: 0, rbi: 0, hits: 0, k: 0 };
        const gameHr = atBats.filter(ab => ab.player_id === playerId && ab.result === 'homerun').length;
        const gameRbi = atBats.filter(ab => ab.player_id === playerId).reduce((sum, ab) => sum + (ab.rbi || 0), 0);
        const gameHits = atBats.filter(ab => ab.player_id === playerId && ['single', 'double', 'triple', 'homerun'].includes(ab.result)).length;
        const gameK = atBats.filter(ab => ab.player_id === playerId && ab.result === 'strikeout').length;

        const totalHr = career.hr + gameHr;
        const totalRbi = career.rbi + gameRbi;
        const totalHits = career.hits + gameHits;
        const totalK = career.k + gameK;

        const seasonTotalHr = season.hr + gameHr;
        const seasonTotalRbi = season.rbi + gameRbi;
        const seasonTotalHits = season.hits + gameHits;
        const seasonTotalK = season.k + gameK;

        let milestoneTriggered = false;

        // Career milestones
        if (newAtBat.result === 'homerun' && MILESTONES.hr.includes(totalHr)) {
          setMilestoneAlert({ playerName: player.player.name, stat: 'Homerun', value: totalHr, isSeason: false });
          milestoneTriggered = true;
        } else if ((newAtBat.rbi || 0) > 0 && !milestoneTriggered) {
          const prevRbi = totalRbi - (newAtBat.rbi || 0);
          const crossedMilestone = MILESTONES.rbi.find(m => prevRbi < m && totalRbi >= m);
          if (crossedMilestone) {
            setMilestoneAlert({ playerName: player.player.name, stat: 'RBI', value: crossedMilestone, isSeason: false });
            milestoneTriggered = true;
          }
        }
        if (['single', 'double', 'triple', 'homerun'].includes(newAtBat.result) && MILESTONES.hits.includes(totalHits) && !milestoneTriggered) {
          setMilestoneAlert({ playerName: player.player.name, stat: 'Hit', value: totalHits, isSeason: false });
          milestoneTriggered = true;
        }
        if (newAtBat.result === 'strikeout' && MILESTONES.k.includes(totalK) && !milestoneTriggered) {
          setMilestoneAlert({ playerName: player.player.name, stat: 'Strikeout', value: totalK, isSeason: false });
          milestoneTriggered = true;
        }

        // Season milestones (only if no career milestone was triggered)
        if (!milestoneTriggered) {
          if (newAtBat.result === 'homerun' && MILESTONES.hr.includes(seasonTotalHr)) {
            setMilestoneAlert({ playerName: player.player.name, stat: 'Homerun', value: seasonTotalHr, isSeason: true });
          } else if ((newAtBat.rbi || 0) > 0) {
            const prevSeasonRbi = seasonTotalRbi - (newAtBat.rbi || 0);
            const crossedSeasonMilestone = MILESTONES.rbi.find(m => prevSeasonRbi < m && seasonTotalRbi >= m);
            if (crossedSeasonMilestone) {
              setMilestoneAlert({ playerName: player.player.name, stat: 'RBI', value: crossedSeasonMilestone, isSeason: true });
            }
          }
          if (['single', 'double', 'triple', 'homerun'].includes(newAtBat.result) && MILESTONES.hits.includes(seasonTotalHits)) {
            setMilestoneAlert({ playerName: player.player.name, stat: 'Hit', value: seasonTotalHits, isSeason: true });
          }
          if (newAtBat.result === 'strikeout' && MILESTONES.k.includes(seasonTotalK)) {
            setMilestoneAlert({ playerName: player.player.name, stat: 'Strikeout', value: seasonTotalK, isSeason: true });
          }
        }
      }
    }
    prevAtBatsCount.current = atBats.length;
  }, [atBats, gamePlayers, careerStats, seasonStats]);

  // Check for pitching K milestones when pitchingStats changes
  useEffect(() => {
    if (Object.keys(pitchingStats).length === 0 || gamePlayers.length === 0) return;

    for (const playerId of Object.keys(pitchingStats)) {
      const currentK = pitchingStats[playerId]?.k || 0;
      const prevK = prevPitchingK.current[playerId] || 0;

      if (currentK > prevK) {
        const player = gamePlayers.find(gp => gp.player_id === playerId);
        if (player) {
          const playerName = player.player.name;
          const careerK = (careerPitchingK[playerId] || 0) + currentK;
          const seasonK = (seasonPitchingK[playerId] || 0) + currentK;

          // Check career milestone first
          if (MILESTONES.pitching_k.includes(careerK)) {
            setMilestoneAlert({ playerName, stat: 'Pitching K', value: careerK, isSeason: false });
          } else if (MILESTONES.pitching_k.includes(seasonK)) {
            // Check season milestone
            setMilestoneAlert({ playerName, stat: 'Pitching K', value: seasonK, isSeason: true });
          }
        }
      }
    }

    // Update previous pitching K tracking
    const newPrevK: Record<string, number> = {};
    for (const playerId of Object.keys(pitchingStats)) {
      newPrevK[playerId] = pitchingStats[playerId]?.k || 0;
    }
    prevPitchingK.current = newPrevK;
  }, [pitchingStats, gamePlayers, careerPitchingK, seasonPitchingK]);

  // Game timer - synced to game's created_at
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Calculate current batter index
  const calculateCurrentBatter = useCallback((atBatsData: AtBat[], gameData: Game | null, numPlayers: number) => {
    if (!gameData || numPlayers === 0) return 0;

    if (gameData.game_mode === '1v1') {
      const totalOuts = atBatsData.filter(
        (ab) => ab.result === 'out' || ab.result === 'strikeout'
      ).length;
      const halfInnings = Math.floor(totalOuts / 3);
      return halfInnings % numPlayers;
    } else {
      return atBatsData.length % numPlayers;
    }
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

    // If game is completed, redirect to recap
    if (gameData.status === 'completed') {
      router.push(`/recap/${gameId}`);
      return;
    }

    setGame(gameData);

    const { data: gamePlayersData } = await supabase
      .from('game_players')
      .select('*, player:players(*)')
      .eq('game_id', gameId)
      .order('batting_order');

    setGamePlayers(gamePlayersData || []);

    // Load career stats for milestone tracking (excluding this game)
    if (gamePlayersData && gamePlayersData.length > 0) {
      const playerIds = gamePlayersData.map((gp: GamePlayer) => gp.player_id);

      // Fetch all career at-bats with pagination (may be more than 1000)
      let allCareerAtBats: AtBat[] = [];
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch } = await supabase
          .from('at_bats')
          .select('*')
          .in('player_id', playerIds)
          .neq('game_id', gameId)
          .range(offset, offset + batchSize - 1);
        if (!batch || batch.length === 0) break;
        allCareerAtBats = [...allCareerAtBats, ...batch];
        if (batch.length < batchSize) break;
        offset += batchSize;
      }

      const stats: Record<string, { hr: number; rbi: number; hits: number; k: number }> = {};
      playerIds.forEach((pid: string) => {
        const playerAbs = allCareerAtBats.filter((ab: AtBat) => ab.player_id === pid);
        const hr = playerAbs.filter((ab: AtBat) => ab.result === 'homerun').length;
        const rbi = playerAbs.reduce((sum: number, ab: AtBat) => sum + (ab.rbi || 0), 0);
        const hits = playerAbs.filter((ab: AtBat) => ['single', 'double', 'triple', 'homerun'].includes(ab.result)).length;
        const k = playerAbs.filter((ab: AtBat) => ab.result === 'strikeout').length;
        stats[pid] = { hr, rbi, hits, k };
      });
      setCareerStats(stats);

      // Load season stats (same season, excluding this game)
      if (gameData.season_id) {
        // First get all game IDs in this season (excluding current game)
        const { data: seasonGames } = await supabase
          .from('games')
          .select('id')
          .eq('season_id', gameData.season_id)
          .neq('id', gameId);

        const seasonGameIds = seasonGames?.map(g => g.id) || [];

        if (seasonGameIds.length > 0) {
          // Fetch season at-bats with pagination
          let allSeasonAtBats: AtBat[] = [];
          let seasonOffset = 0;
          while (true) {
            const { data: batch } = await supabase
              .from('at_bats')
              .select('*')
              .in('player_id', playerIds)
              .in('game_id', seasonGameIds)
              .range(seasonOffset, seasonOffset + batchSize - 1);
            if (!batch || batch.length === 0) break;
            allSeasonAtBats = [...allSeasonAtBats, ...batch];
            if (batch.length < batchSize) break;
            seasonOffset += batchSize;
          }

          const sStats: Record<string, { hr: number; rbi: number; hits: number; k: number }> = {};
          playerIds.forEach((pid: string) => {
            const playerAbs = allSeasonAtBats.filter((ab: AtBat) => ab.player_id === pid);
            const hr = playerAbs.filter((ab: AtBat) => ab.result === 'homerun').length;
            const rbi = playerAbs.reduce((sum: number, ab: AtBat) => sum + (ab.rbi || 0), 0);
            const hits = playerAbs.filter((ab: AtBat) => ['single', 'double', 'triple', 'homerun'].includes(ab.result)).length;
            const k = playerAbs.filter((ab: AtBat) => ab.result === 'strikeout').length;
            sStats[pid] = { hr, rbi, hits, k };
          });
          setSeasonStats(sStats);
        } else {
          // No other games in season yet
          const emptyStats: Record<string, { hr: number; rbi: number; hits: number; k: number }> = {};
          playerIds.forEach((pid: string) => {
            emptyStats[pid] = { hr: 0, rbi: 0, hits: 0, k: 0 };
          });
          setSeasonStats(emptyStats);
        }
      }

      // Load career pitching K stats (excluding this game)
      const { data: careerPitchingData } = await supabase
        .from('pitching_stats')
        .select('player_id, strikeouts')
        .in('player_id', playerIds)
        .neq('game_id', gameId);

      const careerPK: Record<string, number> = {};
      playerIds.forEach((pid: string) => {
        const playerPitching = careerPitchingData?.filter(ps => ps.player_id === pid) || [];
        careerPK[pid] = playerPitching.reduce((sum, ps) => sum + (ps.strikeouts || 0), 0);
      });
      setCareerPitchingK(careerPK);

      // Load season pitching K stats (same season, excluding this game)
      if (gameData.season_id) {
        const { data: seasonGamesForPitching } = await supabase
          .from('games')
          .select('id')
          .eq('season_id', gameData.season_id)
          .neq('id', gameId);

        const seasonGameIdsForPitching = seasonGamesForPitching?.map(g => g.id) || [];

        if (seasonGameIdsForPitching.length > 0) {
          const { data: seasonPitchingData } = await supabase
            .from('pitching_stats')
            .select('player_id, strikeouts')
            .in('player_id', playerIds)
            .in('game_id', seasonGameIdsForPitching);

          const seasonPK: Record<string, number> = {};
          playerIds.forEach((pid: string) => {
            const playerPitching = seasonPitchingData?.filter(ps => ps.player_id === pid) || [];
            seasonPK[pid] = playerPitching.reduce((sum, ps) => sum + (ps.strikeouts || 0), 0);
          });
          setSeasonPitchingK(seasonPK);
        } else {
          const emptyPK: Record<string, number> = {};
          playerIds.forEach((pid: string) => {
            emptyPK[pid] = 0;
          });
          setSeasonPitchingK(emptyPK);
        }
      }
    }

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
      pitchingData?.forEach((ps: { player_id: string; outs_recorded: number; strikeouts: number; walks: number; hits_allowed: number; earned_runs: number }) => {
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

    setLoading(false);
  }, [gameId, router]);

  // Game timer - synced to game's created_at timestamp
  useEffect(() => {
    if (!game?.created_at) return;

    const updateTimer = () => {
      const startTime = new Date(game.created_at).getTime();
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startTime) / 1000));
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [game?.created_at]);

  useEffect(() => {
    loadGame();

    // Set up real-time subscriptions
    const gameChannel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedGame = payload.new as Game;
            if (updatedGame.status === 'completed') {
              router.push(`/recap/${gameId}`);
            } else {
              setGame(updatedGame);
            }
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
          setAtBats((prev) => [...prev, newAtBat]);
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
          // Reload at-bats on delete (undo)
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
          // Update pitching stats on any change
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
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    // Polling fallback - refresh every 10s in case realtime drops
    const pollInterval = setInterval(() => {
      loadGame();
    }, 1000);

    return () => {
      supabase.removeChannel(gameChannel);
      clearInterval(pollInterval);
    };
  }, [gameId, loadGame, router]);

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
        <Link href="/" className="text-[#60A5FA] hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  const currentBatterIndex = calculateCurrentBatter(atBats, game, gamePlayers.length);
  const currentPlayer = gamePlayers[currentBatterIndex];

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080D18' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-50 flex items-center gap-3 px-5 py-4"
        style={{
          background: 'rgba(8,13,24,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <Link href="/">
          <motion.div whileTap={{ scale: 0.95 }} className="p-2 -m-2">
            <ArrowLeft size={20} color="#8A9BBB" />
          </motion.div>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-lg text-[#EFF2FF]">LIVE GAME</h1>
            <motion.div animate={pulse}>
              <Radio size={14} color="#EF4444" fill="#EF4444" />
            </motion.div>
          </div>
          <div className="text-[11px] text-[#4A5772]">
            Inning {game.current_inning} · Spectator Mode
          </div>
        </div>

        {/* Game timer */}
        <div className="flex items-center gap-1.5 mr-3">
          <Timer size={12} color="#4A5772" />
          <span className="text-sm font-mono text-[#8A9BBB] tabular-nums">
            {formatGameTime(elapsedSeconds)}
          </span>
        </div>

        {/* Outs indicator */}
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
        {/* Live indicator banner */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-center gap-2 py-2 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <motion.div animate={pulse}>
            <Radio size={12} color="#EF4444" fill="#EF4444" />
          </motion.div>
          <span className="text-xs font-semibold text-[#EF4444] uppercase tracking-wider">
            Live Updates
          </span>
        </motion.div>

        {/* Current Batter */}
        <motion.div
          custom={1}
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
            {currentPlayer?.player.name[0]}
          </div>
          <div className="text-3xl font-bold text-[#EFF2FF]">{currentPlayer?.player.name}</div>
          <div className="text-sm text-[#4A5772] mt-2">
            {(() => {
              const stats = calculateStats(
                currentPlayer?.player_id,
                currentPlayer?.player.name || '',
                atBats
              );
              return `${stats.hits}-${stats.at_bats} (${formatAvg(stats.avg)}) this game`;
            })()}
          </div>
        </motion.div>

        {/* Game Stats Summary */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl p-4"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h3 className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-2">
            <Users size={12} />
            Player Stats
          </h3>
          <div className="space-y-2">
            {gamePlayers.map((gp) => {
              const stats = calculateStats(gp.player_id, gp.player.name, atBats);
              const isBatting = gp.player_id === currentPlayer?.player_id;
              return (
                <div
                  key={gp.id}
                  className="flex justify-between items-center p-2 rounded-lg"
                  style={{
                    background: isBatting ? 'rgba(240,180,41,0.1)' : 'transparent',
                    border: isBatting ? '1px solid rgba(240,180,41,0.2)' : '1px solid transparent',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                      style={{ background: '#162035', color: isBatting ? '#F0B429' : '#8A9BBB' }}
                    >
                      {gp.player.name[0]}
                    </div>
                    <span className={`text-sm font-medium ${isBatting ? 'text-[#F0B429]' : 'text-[#EFF2FF]'}`}>
                      {gp.player.name}
                      {isBatting && <span className="text-[10px] ml-2 text-[#4A5772]">AT BAT</span>}
                    </span>
                  </div>
                  <span className="text-sm text-[#8A9BBB] tabular-nums">
                    {stats.hits}-{stats.at_bats} ({formatAvg(stats.avg)}), {stats.rbi} RBI
                    {stats.homeruns > 0 && `, ${stats.homeruns} HR`}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Pitching Stats Summary */}
        {game.track_pitching && Object.keys(pitchingStats).length > 0 && (
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
                const era = ps.outs > 0 ? (ps.er / ps.outs) * 27 : 0;

                if (ps.outs === 0 && ps.k === 0 && ps.bb === 0 && ps.h === 0) return null;

                return (
                  <div key={`pitch-${gp.id}`} className="flex justify-between items-center">
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
            </div>
          </motion.div>
        )}

        {/* Recent At-Bats Feed */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl p-4"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h3 className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3">
            Live Feed
          </h3>
          {atBats.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...atBats].reverse().map((ab, index) => {
                const player = gamePlayers.find((gp) => gp.player_id === ab.player_id);
                const resultInfo = AT_BAT_LABELS[ab.result] || { label: ab.result, color: '#8A9BBB' };
                return (
                  <motion.div
                    key={ab.id}
                    initial={index === 0 ? { opacity: 0, x: -20 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex justify-between items-center py-2 border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                        style={{ background: '#162035', color: '#8A9BBB' }}
                      >
                        {player?.player.name[0]}
                      </div>
                      <span className="text-sm text-[#EFF2FF]">{player?.player.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: resultInfo.color }}>
                        {resultInfo.label}
                      </span>
                      {ab.rbi > 0 && (
                        <span className="text-[11px] text-[#4A5772]">
                          {ab.rbi} RBI
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-[#4A5772] text-sm">
              Waiting for at-bats...
            </div>
          )}
        </motion.div>

        {/* Spectator notice */}
        <div className="text-center text-xs text-[#4A5772]">
          You&apos;re watching this game live. Stats update automatically.
        </div>
      </div>

      {/* Milestone Celebration */}
      <AnimatePresence>
        {milestoneAlert && (
          <MilestoneCelebration
            milestone={milestoneAlert}
            onClose={() => setMilestoneAlert(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
