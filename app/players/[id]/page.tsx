'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Zap,
  Minus,
  TrendingUp,
  TrendingDown,
  Target,
  Home,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, Game, AtBat, Award, Session, HotStreak } from '@/lib/types';
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

// Stat block component
function StatBlock({
  label,
  value,
  size = 'standard',
  trend,
}: {
  label: string;
  value: string | number;
  size?: 'micro' | 'standard' | 'hero';
  trend?: 'up' | 'down' | null;
}) {
  const sizeClasses = {
    micro: 'text-sm',
    standard: 'text-2xl',
    hero: 'font-display text-5xl',
  };

  return (
    <div className="text-center">
      <div className={`font-bold text-[#EFF2FF] tabular-nums ${sizeClasses[size]} leading-none`}>
        {value}
        {trend && (
          <span className="ml-1">
            {trend === 'up' ? (
              <TrendingUp size={14} className="inline text-[#34D399]" />
            ) : (
              <TrendingDown size={14} className="inline text-[#F87171]" />
            )}
          </span>
        )}
      </div>
      <div className="text-[10px] text-[#4A5772] uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}

// Heat badge
function HeatBadge({ heat, streak, streakType }: { heat: string; streak: number; streakType: string }) {
  if (heat === 'neutral' && streak <= 1) return null;

  const config = {
    hot: {
      bg: 'rgba(240,180,41,0.12)',
      color: '#F0B429',
      border: 'rgba(240,180,41,0.25)',
      icon: <Zap size={12} fill="#F0B429" />,
      text: `${streak} W STREAK`,
    },
    cold: {
      bg: 'rgba(248,113,113,0.1)',
      color: '#F87171',
      border: 'rgba(248,113,113,0.2)',
      icon: <Minus size={12} />,
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
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      {config.icon}
      {config.text}
    </span>
  );
}

// Result dot
function ResultDot({ result }: { result: 'W' | 'L' }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: result === 'W' ? '#34D399' : '#F87171' }}
    />
  );
}

// Game row
function GameRow({ game, playerStats, index }: { game: Game; playerStats: { hits: number; hr: number; rbi: number }; index: number }) {
  const result = game.score?.includes('W') ? 'W' : 'L';

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex items-center gap-3 p-3 rounded-lg"
      style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <ResultDot result={result as 'W' | 'L'} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#EFF2FF]">
          {result}{' '}
          <span style={{ color: result === 'W' ? '#34D399' : '#F87171' }}>
            {game.score?.replace(/^[WL]\s*/, '') || '0-0'}
          </span>
        </div>
        <div className="text-xs text-[#4A5772]">vs {game.opponent || 'Unknown'}</div>
      </div>
      <div className="text-right text-xs">
        <div className="text-[#EFF2FF] font-medium tabular-nums">
          {playerStats.hits}H · {playerStats.hr}HR · {playerStats.rbi}RBI
        </div>
        <div className="text-[#4A5772]">
          {new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </motion.div>
  );
}

export default function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [hotStreaks, setHotStreaks] = useState<HotStreak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [playerRes, gamesRes, atBatsRes, awardsRes, playersRes, sessionsRes] = await Promise.all([
        supabase.from('players').select('*').eq('id', id).single(),
        supabase
          .from('games')
          .select('*, game_players!inner(*), at_bats(*)')
          .eq('game_players.player_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('at_bats').select('*').eq('player_id', id),
        supabase.from('awards').select('*').eq('player_id', id).order('date', { ascending: false }),
        supabase.from('players').select('*'),
        supabase.from('sessions').select('*').order('date', { ascending: false }).limit(5),
      ]);

      setPlayer(playerRes.data);
      setGames(gamesRes.data || []);
      setAtBats(atBatsRes.data || []);
      setAwards(awardsRes.data || []);
      setAllPlayers(playersRes.data || []);
      setSessions(sessionsRes.data || []);

      // Calculate hot streaks
      const completedGames = (gamesRes.data || []).filter((g: Game) => g.status === 'completed');
      const lastSession = sessionsRes.data?.[0] || null;
      const lastSessionGames = lastSession
        ? completedGames.filter((g: Game) => g.session_id === lastSession.id)
        : [];

      const streaks = calculateHotStreaks(
        id,
        completedGames.slice(0, 3) as any,
        lastSession,
        lastSessionGames as any
      );
      setHotStreaks(streaks);

      setLoading(false);
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Player not found</div>
      </div>
    );
  }

  // Calculate batting stats
  const singles = atBats.filter((ab) => ab.result === 'single').length;
  const doubles = atBats.filter((ab) => ab.result === 'double').length;
  const triples = atBats.filter((ab) => ab.result === 'triple').length;
  const homeruns = atBats.filter((ab) => ab.result === 'homerun').length;
  const walks = atBats.filter((ab) => ab.result === 'walk').length;
  const strikeouts = atBats.filter((ab) => ab.result === 'strikeout').length;
  const outs = atBats.filter((ab) => ab.result === 'out').length;
  const errors = atBats.filter((ab) => ab.result === 'error').length;
  const rbi = atBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);

  const hits = singles + doubles + triples + homeruns;
  const ab = hits + strikeouts + outs;
  const pa = ab + walks + errors;
  const avg = ab > 0 ? hits / ab : 0;
  const slg = ab > 0 ? (singles + doubles * 2 + triples * 3 + homeruns * 4) / ab : 0;
  const obp = ab + walks > 0 ? (hits + walks) / (ab + walks) : 0;
  const ops = obp + slg;
  const kPercent = pa > 0 ? (strikeouts / pa) * 100 : 0;
  const abPerHr = homeruns > 0 ? ab / homeruns : null;

  // Calculate pitching stats
  const inningsPitched = atBats.reduce((sum, ab) => sum + (ab.innings_pitched || 0), 0);
  const earnedRuns = atBats.reduce((sum, ab) => sum + (ab.earned_runs || 0), 0);
  const hitsAllowed = atBats.reduce((sum, ab) => sum + (ab.hits_allowed || 0), 0);
  const walksAllowed = atBats.reduce((sum, ab) => sum + (ab.walks_allowed || 0), 0);
  const strikeoutsPitched = atBats.reduce((sum, ab) => sum + (ab.strikeouts_pitched || 0), 0);
  const era = inningsPitched > 0 ? (earnedRuns / inningsPitched) * 9 : 0;
  const whip = inningsPitched > 0 ? (walksAllowed + hitsAllowed) / inningsPitched : 0;

  // Win/loss record
  const wins = games.filter((g) => g.score?.includes('W')).length;
  const losses = games.filter((g) => g.score?.includes('L')).length;

  // Get stats per game for recent games display
  const getGameStats = (gameId: string) => {
    const gameAtBats = atBats.filter((ab) => ab.game_id === gameId);
    return {
      hits: gameAtBats.filter((ab) => ['single', 'double', 'triple', 'homerun'].includes(ab.result)).length,
      hr: gameAtBats.filter((ab) => ab.result === 'homerun').length,
      rbi: gameAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0),
    };
  };

  // H2H records
  const h2hRecords = allPlayers
    .filter((p) => p.id !== player.id)
    .map((opponent) => {
      // This is a simplified version - in a real app you'd track this in the database
      return {
        player: opponent,
        wins: 0,
        losses: 0,
      };
    });

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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">{player.name.toUpperCase()}</h1>
          {player.handle && <div className="text-xs text-[#4A5772]">{player.handle}</div>}
        </div>
        {hotStreaks.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
            style={{
              background: 'rgba(240,180,41,0.12)',
              color: '#F0B429',
              border: '1px solid rgba(240,180,41,0.25)',
            }}
          >
            <Zap size={12} fill="#F0B429" />
            {formatHotStreak(hotStreaks[0])}
          </span>
        )}
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        {/* Hero stats */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-lg p-6 pinstripe relative overflow-hidden"
          style={{
            background: '#0F1829',
            border: `1px solid ${player.heat === 'hot' ? 'rgba(240,180,41,0.2)' : 'rgba(255,255,255,0.07)'}`,
            boxShadow: player.heat === 'hot' ? '0 0 20px rgba(240,180,41,0.08)' : 'none',
          }}
        >
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-1">Season Record</div>
              <div className="font-display font-bold text-4xl text-[#EFF2FF]">
                {wins}W – {losses}L
              </div>
            </div>
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg, #162035 0%, #1A2640 100%)', color: '#8A9BBB' }}
            >
              {player.name[0]}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <StatBlock label="AVG" value={`.${String(Math.round(avg * 1000)).padStart(3, '0')}`} size="hero" />
            <StatBlock label="OPS" value={ops.toFixed(3)} size="standard" />
            <StatBlock label="HR" value={homeruns} size="standard" />
            <StatBlock label="RBI" value={rbi} size="standard" />
          </div>
        </motion.div>

        {/* Awards */}
        {awards.length > 0 && (
          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
            <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Trophy size={11} color="#F0B429" />
              Awards
            </div>
            <div className="flex gap-2 flex-wrap">
              {awards.slice(0, 5).map((award) => (
                <div
                  key={award.id}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(240,180,41,0.12)',
                    color: '#F0B429',
                    border: '1px solid rgba(240,180,41,0.25)',
                  }}
                >
                  {award.label || award.type.replace('_', ' ')}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Batting stats */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3">Batting</div>
          <div
            className="rounded-lg p-4"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="grid grid-cols-6 gap-4">
              <StatBlock label="G" value={games.length} size="micro" />
              <StatBlock label="AB" value={ab} size="micro" />
              <StatBlock label="H" value={hits} size="micro" />
              <StatBlock label="2B" value={doubles} size="micro" />
              <StatBlock label="3B" value={triples} size="micro" />
              <StatBlock label="HR" value={homeruns} size="micro" />
            </div>
            <div className="border-t border-white/5 my-3" />
            <div className="grid grid-cols-6 gap-4">
              <StatBlock label="RBI" value={rbi} size="micro" />
              <StatBlock label="BB" value={walks} size="micro" />
              <StatBlock label="K" value={strikeouts} size="micro" />
              <StatBlock label="OBP" value={obp.toFixed(3)} size="micro" />
              <StatBlock label="SLG" value={slg.toFixed(3)} size="micro" />
              <StatBlock label="K%" value={`${kPercent.toFixed(1)}%`} size="micro" />
            </div>
            {abPerHr && (
              <>
                <div className="border-t border-white/5 my-3" />
                <div className="grid grid-cols-3 gap-4">
                  <StatBlock label="AB/HR" value={abPerHr.toFixed(1)} size="micro" />
                  <StatBlock label="RBI/AB" value={(rbi / (ab || 1)).toFixed(2)} size="micro" />
                  <StatBlock label="PA" value={pa} size="micro" />
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Pitching stats (if any) */}
        {inningsPitched > 0 && (
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3">Pitching</div>
            <div
              className="rounded-lg p-4"
              style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="grid grid-cols-5 gap-4">
                <StatBlock label="IP" value={inningsPitched.toFixed(1)} size="micro" />
                <StatBlock label="ERA" value={era.toFixed(2)} size="micro" />
                <StatBlock label="WHIP" value={whip.toFixed(2)} size="micro" />
                <StatBlock label="K" value={strikeoutsPitched} size="micro" />
                <StatBlock label="BB" value={walksAllowed} size="micro" />
              </div>
            </div>
          </motion.div>
        )}

        {/* H2H Records */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
          <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Target size={11} />
            Head-to-Head
          </div>
          <div className="space-y-2">
            {h2hRecords.map((record) => (
              <Link key={record.player.id} href={`/h2h?p1=${player.id}&p2=${record.player.id}`}>
                <div
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                  style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: '#162035', color: '#8A9BBB' }}
                  >
                    {record.player.name[0]}
                  </div>
                  <div className="flex-1 text-sm font-medium text-[#EFF2FF]">{record.player.name}</div>
                  <div className="text-xs text-[#4A5772]">
                    {record.wins}W – {record.losses}L
                  </div>
                  <ChevronRight size={14} color="#4A5772" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent games */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
          <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Home size={11} />
            Recent Games
          </div>
          <div className="space-y-2">
            {games.slice(0, 10).map((game, i) => (
              <GameRow key={game.id} game={game} playerStats={getGameStats(game.id)} index={i} />
            ))}
            {games.length === 0 && (
              <div className="text-center py-8 text-[#4A5772] text-sm">No games played yet</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
