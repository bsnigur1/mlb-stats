'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Zap, Minus, ChevronRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, AtBat, Game, Session, HotStreak } from '@/lib/types';
import { calculateHotStreaks, formatHotStreak } from '@/lib/hot-streaks';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

// Heat badge
function HeatBadge({ heat, streak, streakType }: { heat: string; streak: number; streakType: string }) {
  if (heat === 'neutral' && streak <= 1) return null;

  const config = {
    hot: {
      bg: 'rgba(240,180,41,0.12)',
      color: '#F0B429',
      border: 'rgba(240,180,41,0.25)',
      icon: <Zap size={10} fill="#F0B429" />,
      text: `${streak} W STREAK`,
    },
    cold: {
      bg: 'rgba(248,113,113,0.1)',
      color: '#F87171',
      border: 'rgba(248,113,113,0.2)',
      icon: <Minus size={10} />,
      text: `${streak} L STREAK`,
    },
    neutral: {
      bg: 'rgba(96,165,250,0.1)',
      color: '#60A5FA',
      border: 'rgba(96,165,250,0.2)',
      icon: null,
      text: `${streak} ${streakType}`,
    },
  }[heat as 'hot' | 'cold' | 'neutral'] || { bg: '', color: '', border: '', icon: null, text: '' };

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      {config.icon}
      {config.text}
    </span>
  );
}

// Player card
function PlayerCard({
  player,
  stats,
  rank,
  index,
  hotStreaks,
}: {
  player: Player;
  stats: { avg: number; hr: number; rbi: number; games: number };
  rank: number;
  index: number;
  hotStreaks: HotStreak[];
}) {
  const isHot = hotStreaks.length > 0;
  const topStreak = hotStreaks[0];

  return (
    <Link href={`/players/${player.id}`}>
      <motion.div
        custom={index}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        whileHover={{ x: 2 }}
        className="flex items-center gap-4 p-4 rounded-lg cursor-pointer pinstripe relative overflow-hidden"
        style={{
          background: '#0F1829',
          border: `1px solid ${isHot ? 'rgba(240,180,41,0.2)' : 'rgba(255,255,255,0.07)'}`,
          borderLeft: `3px solid ${isHot ? '#F0B429' : 'rgba(255,255,255,0.07)'}`,
          boxShadow: isHot ? '0 0 16px rgba(240,180,41,0.08)' : 'none',
        }}
      >
        <span
          className="text-lg font-bold w-6 text-center"
          style={{ color: rank === 1 ? '#F0B429' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#4A5772' }}
        >
          {rank}
        </span>

        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{
            background: isHot ? 'rgba(240,180,41,0.15)' : 'linear-gradient(135deg, #162035 0%, #1A2640 100%)',
            color: isHot ? '#F0B429' : '#8A9BBB',
          }}
        >
          {player.name[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-semibold text-[#EFF2FF]">{player.name}</span>
          </div>
          {topStreak ? (
            <div className="flex items-center gap-1 text-xs">
              <Zap size={10} color="#F0B429" fill="#F0B429" />
              <span className="font-semibold text-[#F0B429]">{formatHotStreak(topStreak)}</span>
            </div>
          ) : (
            <div className="text-xs text-[#4A5772]">{stats.games} games</div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-[#EFF2FF] tabular-nums">
              .{String(Math.round(stats.avg * 1000)).padStart(3, '0')}
            </div>
            <div className="text-[9px] text-[#4A5772] uppercase">AVG</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#EFF2FF] tabular-nums">{stats.hr}</div>
            <div className="text-[9px] text-[#4A5772] uppercase">HR</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-[#EFF2FF] tabular-nums">{stats.rbi}</div>
            <div className="text-[9px] text-[#4A5772] uppercase">RBI</div>
          </div>
        </div>

        <ChevronRight size={16} color="#4A5772" />
      </motion.div>
    </Link>
  );
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'avg' | 'hr' | 'rbi'>('avg');

  useEffect(() => {
    async function loadData() {
      const [playersRes, atBatsRes, gamesRes, sessionsRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('at_bats').select('*'),
        supabase.from('games').select('*, game_players(*), at_bats(*)'),
        supabase.from('sessions').select('*').order('date', { ascending: false }).limit(5),
      ]);

      setPlayers(playersRes.data || []);
      setAtBats(atBatsRes.data || []);
      setGames(gamesRes.data || []);
      setSessions(sessionsRes.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  // Get data for hot streaks
  const completedGames = games.filter(g => g.status === 'completed');
  const lastSession = sessions[0] || null;
  const lastSessionGames = lastSession
    ? completedGames.filter(g => g.session_id === lastSession.id)
    : [];

  // Calculate stats for each player
  const playerStats = players.map((player) => {
    const playerAtBats = atBats.filter((ab) => ab.player_id === player.id);
    const singles = playerAtBats.filter((ab) => ab.result === 'single').length;
    const doubles = playerAtBats.filter((ab) => ab.result === 'double').length;
    const triples = playerAtBats.filter((ab) => ab.result === 'triple').length;
    const homeruns = playerAtBats.filter((ab) => ab.result === 'homerun').length;
    const strikeouts = playerAtBats.filter((ab) => ab.result === 'strikeout').length;
    const outs = playerAtBats.filter((ab) => ab.result === 'out').length;
    const rbi = playerAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);

    const hits = singles + doubles + triples + homeruns;
    const ab = hits + strikeouts + outs;
    const avg = ab > 0 ? hits / ab : 0;

    const playerGames = games.filter((g) =>
      g.game_players?.some((gp) => gp.player_id === player.id)
    ).length;

    // Calculate hot streaks
    const recentGamesForPlayer = completedGames
      .filter(g => g.game_players?.some(gp => gp.player_id === player.id))
      .slice(0, 3);
    const lastSessionGamesForPlayer = lastSessionGames.filter(g =>
      g.game_players?.some(gp => gp.player_id === player.id)
    );

    const hotStreaks = calculateHotStreaks(
      player.id,
      recentGamesForPlayer as any,
      lastSession,
      lastSessionGamesForPlayer as any
    );

    return { player, avg, hr: homeruns, rbi, games: playerGames, hotStreaks };
  });

  // Sort players
  const sortedPlayers = [...playerStats].sort((a, b) => {
    switch (sortBy) {
      case 'hr':
        return b.hr - a.hr;
      case 'rbi':
        return b.rbi - a.rbi;
      default:
        return b.avg - a.avg;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">PLAYERS</h1>
          <div className="text-xs text-[#4A5772]">{players.length} players</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-4">
        {/* Sort tabs */}
        <div className="flex gap-2">
          {(['avg', 'hr', 'rbi'] as const).map((key) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSortBy(key)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide"
              style={{
                background: sortBy === key ? 'rgba(240,180,41,0.15)' : 'rgba(255,255,255,0.05)',
                color: sortBy === key ? '#F0B429' : '#8A9BBB',
                border: `1px solid ${sortBy === key ? 'rgba(240,180,41,0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {key}
            </motion.button>
          ))}
        </div>

        {/* Player list */}
        <div className="space-y-2">
          {sortedPlayers.map((ps, i) => (
            <PlayerCard
              key={ps.player.id}
              player={ps.player}
              stats={ps}
              rank={i + 1}
              index={i}
              hotStreaks={ps.hotStreaks}
            />
          ))}
        </div>

        {players.length === 0 && (
          <div
            className="text-center py-12 rounded-lg"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <User size={32} color="#4A5772" className="mx-auto mb-3" />
            <div className="text-[#4A5772] text-sm">No players yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
