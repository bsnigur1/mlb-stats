'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Circle, Radio, Users } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, Game, GamePlayer, AtBat } from '@/lib/types';
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
          setAtBats((prev) => [...prev, payload.new as AtBat]);
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

    return () => {
      supabase.removeChannel(gameChannel);
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
                    {stats.hits}-{stats.at_bats}, {stats.rbi} RBI
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
    </div>
  );
}
