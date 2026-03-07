'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Zap,
  Award,
  Plus,
  Calendar,
  BarChart2,
  ArrowLeftRight,
  ChevronRight,
  Home,
  BookOpen,
  Trophy,
  Settings,
  Minus,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, Session, Game, GamePlayer, AtBat } from '@/lib/types';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.3, ease: 'easeOut' as const },
  }),
};

// Logo component
function YardLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={compact ? 18 : 22} height={compact ? 18 : 22} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" transform="rotate(45 12 12)" fill="#F0B429" />
        <rect x="5.5" y="5.5" width="13" height="13" rx="2" transform="rotate(45 12 12)" fill="none" stroke="rgba(8,13,24,0.5)" strokeWidth="1.5" />
      </svg>
      {!compact && (
        <span className="font-display font-bold text-xl tracking-widest text-[#EFF2FF]">
          THE YARD
        </span>
      )}
    </div>
  );
}

// Heat badge component
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

// Result dot
function ResultDot({ result }: { result: 'W' | 'L' }) {
  return (
    <span
      className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0"
      style={{ background: result === 'W' ? '#34D399' : '#F87171' }}
    />
  );
}

// Type badge for game modes
function TypeBadge({ type }: { type: string }) {
  const config = {
    '2v2': { bg: 'rgba(96,165,250,0.1)', color: '#60A5FA', border: 'rgba(96,165,250,0.2)', label: '2v2' },
    '3v3': { bg: 'rgba(52,211,153,0.1)', color: '#34D399', border: 'rgba(52,211,153,0.2)', label: '3v3' },
    '1v1': { bg: 'rgba(240,180,41,0.1)', color: '#F0B429', border: 'rgba(240,180,41,0.2)', label: 'H2H' },
  }[type] || { bg: 'rgba(96,165,250,0.1)', color: '#60A5FA', border: 'rgba(96,165,250,0.2)', label: type };

  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
      style={{
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}

// Player row component
function PlayerRow({ player, rank, index, stats }: { player: Player; rank: number; index: number; stats: { avg: number; wins: number; losses: number } }) {
  const isHot = player.heat === 'hot';
  const isCold = player.heat === 'cold';

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex items-center gap-3 p-3.5 rounded-lg relative overflow-hidden pinstripe"
      style={{
        background: '#0F1829',
        border: `1px solid ${isHot ? 'rgba(240,180,41,0.2)' : 'rgba(255,255,255,0.07)'}`,
        borderLeft: `3px solid ${isHot ? '#F0B429' : isCold ? '#374151' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isHot ? '0 0 12px rgba(240,180,41,0.08)' : 'none',
      }}
    >
      <span className="text-xs font-bold tabular-nums min-w-4" style={{ color: rank === 1 ? '#F0B429' : '#4A5772' }}>
        {rank}
      </span>

      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #162035 0%, #1A2640 100%)', color: '#8A9BBB' }}
      >
        {player.name[0]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-[#EFF2FF]">{player.name}</span>
          <HeatBadge heat={player.heat} streak={player.streak} streakType={player.streak_type} />
        </div>
        <span className="text-xs text-[#4A5772]">
          {stats.wins}W–{stats.losses}L
        </span>
      </div>

      <div className="text-right">
        <div className="text-xl font-bold text-[#EFF2FF] tabular-nums leading-none">
          .{String(Math.round(stats.avg * 1000)).padStart(3, '0')}
        </div>
        <div className="text-[10px] text-[#4A5772] uppercase tracking-wide mt-0.5">AVG</div>
      </div>
    </motion.div>
  );
}

// Session card
function SessionCard({ session, index, games }: { session: Session; index: number; games: Game[] }) {
  const [expanded, setExpanded] = useState(false);
  const sessionGames = games.filter(g => g.session_id === session.id);
  const wins = sessionGames.filter(g => g.status === 'completed' && g.score?.startsWith('W')).length;
  const losses = sessionGames.length - wins;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-lg overflow-hidden"
      style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="min-w-10 text-[11px] font-medium text-[#4A5772] uppercase tracking-wide">
          {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#EFF2FF] mb-1">
            {session.label || 'Game Night'}
          </div>
          <div className="flex items-center gap-1.5">
            {sessionGames.slice(0, 5).map((g, i) => (
              <ResultDot key={i} result={g.score?.includes('W') ? 'W' : 'L'} />
            ))}
            <span className="text-[11px] text-[#4A5772] ml-1">
              {wins}W {losses}L · {sessionGames.length} games
            </span>
          </div>
        </div>

        {session.mvp_player_id && (
          <div className="flex items-center gap-1.5">
            <Award size={12} color="#F0B429" />
            <span className="text-xs text-[#F0B429] font-semibold">MVP</span>
          </div>
        )}

        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={14} color="#4A5772" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' as const }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 py-2">
              {sessionGames.map((game) => (
                <Link key={game.id} href={`/game/${game.id}`}>
                  <div className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                    <ResultDot result={game.score?.includes('W') ? 'W' : 'L'} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[13px] font-semibold text-[#EFF2FF]">
                          {game.score?.includes('W') ? 'W' : 'L'}{' '}
                          <span style={{ color: game.score?.includes('W') ? '#34D399' : '#F87171' }}>
                            {game.score?.replace(/^[WL]\s*/, '') || '0-0'}
                          </span>
                        </span>
                        <span className="text-xs text-[#4A5772]">vs {game.opponent || 'Unknown'}</span>
                        <TypeBadge type={game.game_mode} />
                      </div>
                    </div>
                    <div className="text-[11px] text-[#4A5772]">{game.innings} inn</div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Leader card
function LeaderCard({ label, player, value, index }: { label: string; player: string; value: string; index: number }) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2 }}
      className="flex-1 p-4 rounded-lg relative overflow-hidden pinstripe min-w-0"
      style={{
        background: '#0F1829',
        border: '1px solid rgba(240,180,41,0.15)',
        boxShadow: '0 0 20px rgba(240,180,41,0.04)',
      }}
    >
      <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-2">{label}</div>
      <div className="font-display font-bold text-4xl text-[#EFF2FF] tabular-nums leading-none">{value}</div>
      <div className="text-xs text-[#8A9BBB] mt-1.5 font-medium">{player}</div>
    </motion.div>
  );
}

// Nav items
const NAV_ITEMS = [
  { icon: Home, label: 'Dashboard', href: '/', active: true },
  { icon: BookOpen, label: 'Sessions', href: '/sessions', active: false },
  { icon: BarChart2, label: 'Stats', href: '/stats', active: false },
  { icon: ArrowLeftRight, label: 'Head-to-Head', href: '/h2h', active: false },
  { icon: Trophy, label: 'Awards', href: '/awards', active: false },
];

// Sidebar
function Sidebar() {
  return (
    <div className="sidebar w-[220px] flex-shrink-0 h-screen sticky top-0 flex flex-col py-6" style={{ background: '#080D18', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-5 pb-7">
        <YardLogo />
      </div>

      <nav className="flex-1">
        {NAV_ITEMS.map((item) => (
          <Link key={item.label} href={item.href}>
            <motion.div
              whileHover={{ x: 2 }}
              className="flex items-center gap-2.5 w-full px-5 py-2.5 text-sm"
              style={{
                borderLeft: `3px solid ${item.active ? '#F0B429' : 'transparent'}`,
                fontWeight: item.active ? 600 : 400,
                color: item.active ? '#EFF2FF' : '#4A5772',
              }}
            >
              <item.icon size={16} />
              {item.label}
            </motion.div>
          </Link>
        ))}
      </nav>

      <Link href="/settings">
        <div className="flex items-center gap-2.5 px-5 py-2.5 text-[13px] text-[#4A5772]">
          <Settings size={15} />
          Settings
        </div>
      </Link>
    </div>
  );
}

// Bottom nav (mobile)
function BottomNav() {
  return (
    <div className="bottom-nav fixed bottom-0 left-0 right-0 flex z-50" style={{ background: '#0F1829', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 0 max(8px, env(safe-area-inset-bottom))' }}>
      {NAV_ITEMS.slice(0, 5).map((item) => (
        <Link key={item.label} href={item.href} className="flex-1">
          <div className="flex flex-col items-center gap-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: item.active ? '#F0B429' : '#4A5772' }}>
            <item.icon size={18} />
            {item.label}
          </div>
        </Link>
      ))}
    </div>
  );
}

// Log Game dropdown
function LogGameDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const gameModes = [
    { mode: '2v2', label: '2v2 Co-Op', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
    { mode: '3v3', label: '3v3 Co-Op', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
    { mode: '1v1', label: 'H2H', color: '#F0B429', bg: 'rgba(240,180,41,0.1)' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
        style={{ background: '#F0B429', color: '#080D18' }}
      >
        <Plus size={15} />
        Log Game
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-44 rounded-lg overflow-hidden z-50"
            style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
          >
            {gameModes.map((gm) => (
              <Link key={gm.mode} href={`/log?mode=${gm.mode}`}>
                <motion.div
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setOpen(false)}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: gm.color }}
                  />
                  <span className="text-sm font-medium text-[#EFF2FF]">{gm.label}</span>
                </motion.div>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main dashboard
export default function Dashboard() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [playersRes, sessionsRes, gamesRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('sessions').select('*').order('date', { ascending: false }).limit(5),
        supabase.from('games').select('*').order('created_at', { ascending: false }).limit(500),
      ]);

      // Fetch all at-bats (may be more than 1000)
      let allAtBats: AtBat[] = [];
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch } = await supabase
          .from('at_bats')
          .select('*')
          .range(offset, offset + batchSize - 1);
        if (!batch || batch.length === 0) break;
        allAtBats = [...allAtBats, ...batch];
        if (batch.length < batchSize) break;
        offset += batchSize;
      }

      setPlayers(playersRes.data || []);
      setSessions(sessionsRes.data || []);
      setGames(gamesRes.data || []);
      setAtBats(allAtBats);
      setLoading(false);
    }
    loadData();
  }, []);

  // Calculate stats for each player
  const playerStats = players.map((player) => {
    const playerAtBats = atBats.filter((ab) => ab.player_id === player.id);
    const singles = playerAtBats.filter((ab) => ab.result === 'single').length;
    const doubles = playerAtBats.filter((ab) => ab.result === 'double').length;
    const triples = playerAtBats.filter((ab) => ab.result === 'triple').length;
    const homeruns = playerAtBats.filter((ab) => ab.result === 'homerun').length;
    const walks = playerAtBats.filter((ab) => ab.result === 'walk').length;
    const strikeouts = playerAtBats.filter((ab) => ab.result === 'strikeout').length;
    const outs = playerAtBats.filter((ab) => ab.result === 'out').length;

    const hits = singles + doubles + triples + homeruns;
    const ab = hits + strikeouts + outs;
    const avg = ab > 0 ? hits / ab : 0;

    // Calculate wins/losses from games
    const playerGames = games.filter(g =>
      g.game_players?.some(gp => gp.player_id === player.id)
    );
    const wins = playerGames.filter(g => g.score?.includes('W')).length;
    const losses = playerGames.filter(g => g.score?.includes('L')).length;

    return { player, avg, hits, homeruns, wins, losses };
  });

  // Sort by avg for leaderboard
  const sortedByAvg = [...playerStats].sort((a, b) => b.avg - a.avg);
  const sortedByHr = [...playerStats].sort((a, b) => b.homeruns - a.homeruns);
  const sortedByWins = [...playerStats].sort((a, b) => b.wins - a.wins);

  const leader = sortedByAvg[0];
  const hrLeader = sortedByHr[0];
  const winsLeader = sortedByWins[0];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="flex min-h-screen" style={{ background: '#080D18' }}>
      <Sidebar />

      {/* Mobile top bar */}
      <div className="top-bar fixed top-0 left-0 right-0 z-50 hidden items-center justify-between px-5 py-3.5" style={{ background: 'rgba(8,13,24,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <YardLogo compact />
        <span className="font-display font-bold text-base tracking-widest text-[#EFF2FF]">THE YARD</span>
        <Link href="/log">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(240,180,41,0.12)', border: '1px solid rgba(240,180,41,0.2)' }}>
            <Plus size={16} color="#F0B429" />
          </div>
        </Link>
      </div>

      {/* Main content */}
      <div className="main-content flex-1 overflow-y-auto p-7 max-w-[900px]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-7 flex-wrap gap-3"
        >
          <div>
            <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-1">
              {today} · Season 2025
            </div>
            <h1 className="font-display font-bold text-[28px] tracking-wide text-[#EFF2FF]">
              TONIGHT AT THE YARD
            </h1>
          </div>

<LogGameDropdown />
        </motion.div>

        {/* Season leaders */}
        {leader && (
          <section className="mb-7">
            <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Trophy size={11} color="#F0B429" />
              Season Leaders
            </div>
            <div className="leader-row flex gap-3">
              <LeaderCard
                label="Batting Avg"
                player={leader.player.name}
                value={`.${String(Math.round(leader.avg * 1000)).padStart(3, '0')}`}
                index={0}
              />
              <LeaderCard
                label="Home Runs"
                player={hrLeader?.player.name || '-'}
                value={String(hrLeader?.homeruns || 0)}
                index={1}
              />
              <LeaderCard
                label="Season Wins"
                player={winsLeader?.player.name || '-'}
                value={String(winsLeader?.wins || 0)}
                index={2}
              />
            </div>
          </section>
        )}

        {/* Two column layout */}
        <div className="player-stats-row flex gap-5 items-start">
          {/* Sessions */}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Calendar size={11} />
              Recent Sessions
            </div>
            <div className="flex flex-col gap-2.5">
              {sessions.length > 0 ? (
                sessions.map((session, i) => (
                  <SessionCard key={session.id} session={session} index={i} games={games} />
                ))
              ) : (
                <div className="text-center py-8 text-[#4A5772] text-sm">
                  No sessions yet. Start logging games!
                </div>
              )}
            </div>
            <Link href="/sessions">
              <motion.div whileHover={{ x: 2 }} className="flex items-center gap-1.5 mt-3 text-[13px] text-[#60A5FA] font-medium">
                View all sessions <ChevronRight size={13} />
              </motion.div>
            </Link>
          </div>

          {/* Player leaderboard */}
          <div className="w-[260px] flex-shrink-0">
            <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Zap size={11} color="#F0B429" />
              Hot / Cold
            </div>
            <div className="flex flex-col gap-2">
              {sortedByAvg.map((ps, i) => (
                <PlayerRow
                  key={ps.player.id}
                  player={ps.player}
                  rank={i + 1}
                  index={i}
                  stats={{ avg: ps.avg, wins: ps.wins, losses: ps.losses }}
                />
              ))}
            </div>
            <Link href="/h2h">
              <motion.div whileHover={{ x: 2 }} className="flex items-center gap-1.5 mt-3 text-[13px] text-[#60A5FA] font-medium">
                <ArrowLeftRight size={13} />
                Head-to-Head
              </motion.div>
            </Link>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
