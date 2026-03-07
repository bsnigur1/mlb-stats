'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
// Note: Link is still used for the back button
import { supabase } from '@/lib/supabase';
import { Player, AtBat, Game, Session } from '@/lib/types';

type SortKey = 'name' | 'games' | 'avg' | 'obp' | 'slg' | 'ops' | 'hr' | 'rbi' | 'h' | 'doubles' | 'triples' | 'ab' | 'bb' | 'kPercent';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

interface PlayerStats {
  player: Player;
  games: number;
  ab: number;
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  k: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  kPercent: number;
}

function calculatePlayerStats(
  player: Player,
  atBats: AtBat[],
  games: Game[]
): PlayerStats {
  const playerAtBats = atBats.filter((ab) => ab.player_id === player.id);
  const singles = playerAtBats.filter((ab) => ab.result === 'single').length;
  const doubles = playerAtBats.filter((ab) => ab.result === 'double').length;
  const triples = playerAtBats.filter((ab) => ab.result === 'triple').length;
  const homeruns = playerAtBats.filter((ab) => ab.result === 'homerun').length;
  const walks = playerAtBats.filter((ab) => ab.result === 'walk').length;
  const strikeouts = playerAtBats.filter((ab) => ab.result === 'strikeout').length;
  const outs = playerAtBats.filter((ab) => ab.result === 'out').length;
  const errors = playerAtBats.filter((ab) => ab.result === 'error').length;
  const rbi = playerAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);

  const hits = singles + doubles + triples + homeruns;
  const ab = hits + strikeouts + outs;
  const pa = ab + walks + errors;
  const avg = ab > 0 ? hits / ab : 0;
  const slg = ab > 0 ? (singles + doubles * 2 + triples * 3 + homeruns * 4) / ab : 0;
  const obp = ab + walks > 0 ? (hits + walks) / (ab + walks) : 0;
  const ops = obp + slg;
  const kPercent = pa > 0 ? (strikeouts / pa) * 100 : 0;

  const playerGames = games.filter((g) =>
    g.game_players?.some((gp) => gp.player_id === player.id)
  ).length;

  return {
    player,
    games: playerGames,
    ab,
    h: hits,
    singles,
    doubles,
    triples,
    hr: homeruns,
    rbi,
    bb: walks,
    k: strikeouts,
    avg,
    obp,
    slg,
    ops,
    kPercent,
  };
}

export default function StatsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('avg');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeSection, setActiveSection] = useState<'2025' | 'career'>('2025');

  useEffect(() => {
    async function loadData() {
      const [playersRes, gamesRes, sessionsRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('games').select('*, game_players(*)').limit(1000),
        supabase.from('sessions').select('*'),
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
      setAtBats(allAtBats);
      setGames(gamesRes.data || []);
      setSessions(sessionsRes.data || []);
      setLoading(false);
    }
    loadData();
  }, []);

  // Find the 2025 historical session
  const historicalSession = sessions.find((s) => s.label?.includes('2025') || s.id === 'a0000000-0000-0000-0000-000000000001');

  // Get games from 2025 season
  const season2025Games = historicalSession
    ? games.filter((g) => g.session_id === historicalSession.id)
    : [];
  const season2025GameIds = new Set(season2025Games.map((g) => g.id));

  // Filter at-bats for 2025 season
  const season2025AtBats = atBats.filter((ab) => season2025GameIds.has(ab.game_id));

  // Calculate stats based on active section
  const getFilteredStats = () => {
    if (activeSection === '2025') {
      return players.map((player) => calculatePlayerStats(player, season2025AtBats, season2025Games));
    }
    // Career = all stats
    return players.map((player) => calculatePlayerStats(player, atBats, games));
  };

  const playerStats = getFilteredStats();

  // Sort players
  const sortedPlayers = [...playerStats].sort((a, b) => {
    const aVal = sortKey === 'name' ? a.player.name : a[sortKey];
    const bVal = sortKey === 'name' ? b.player.name : b[sortKey];
    if (sortKey === 'name') {
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    }
    return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

  const columns: { key: SortKey; label: string; format?: (v: number) => string }[] = [
    { key: 'name', label: 'Player' },
    { key: 'games', label: 'G' },
    { key: 'avg', label: 'AVG', format: (v) => v > 0 ? `.${String(Math.round(v * 1000)).padStart(3, '0')}` : '.000' },
    { key: 'ops', label: 'OPS', format: (v) => v.toFixed(3) },
    { key: 'hr', label: 'HR' },
    { key: 'rbi', label: 'RBI' },
    { key: 'h', label: 'H' },
    { key: 'doubles', label: '2B' },
    { key: 'triples', label: '3B' },
    { key: 'bb', label: 'BB' },
    { key: 'kPercent', label: 'K%', format: (v) => `${v.toFixed(1)}%` },
  ];

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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">STATS</h1>
          <div className="text-xs text-[#4A5772]">Batting statistics</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-5">
        {/* Section Tabs */}
        <div className="flex gap-2 mb-5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveSection('2025')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeSection === '2025' ? '#60A5FA' : '#162035',
              color: activeSection === '2025' ? '#080D18' : '#8A9BBB',
            }}
          >
            2025 Season
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveSection('career')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeSection === 'career' ? '#F0B429' : '#162035',
              color: activeSection === 'career' ? '#080D18' : '#8A9BBB',
            }}
          >
            Career Stats
          </motion.button>
        </div>

        <motion.div
          key={activeSection}
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-lg overflow-x-auto"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-3 text-[11px] text-[#4A5772] uppercase tracking-widest font-semibold cursor-pointer hover:text-[#8A9BBB] transition-colors"
                    style={{ textAlign: col.key === 'name' ? 'left' : 'right' }}
                  >
                    <div
                      className="flex items-center gap-1"
                      style={{ justifyContent: col.key === 'name' ? 'flex-start' : 'flex-end' }}
                    >
                      {col.label}
                      <SortIcon column={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((ps, i) => (
                <motion.tr
                  key={ps.player.id}
                  custom={i + 1}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className="hover:bg-white/5 transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                        style={{ background: '#162035', color: '#8A9BBB' }}
                      >
                        {ps.player.name[0]}
                      </div>
                      <span className="text-sm font-medium text-[#EFF2FF]">
                        {ps.player.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{ps.games}</td>
                  <td className="px-3 py-3 text-sm text-[#F0B429] text-right tabular-nums font-bold">
                    {columns.find((c) => c.key === 'avg')?.format?.(ps.avg)}
                  </td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">
                    {ps.ops.toFixed(3)}
                  </td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.hr}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.rbi}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.h}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.doubles}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.triples}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.bb}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">
                    {ps.kPercent.toFixed(1)}%
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {playerStats.every((ps) => ps.ab === 0) && (
          <div
            className="text-center py-12 rounded-lg mt-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <BarChart2 size={32} color="#4A5772" className="mx-auto mb-3" />
            <div className="text-[#4A5772] text-sm">No stats for {activeSection === '2025' ? '2025 Season' : 'Career'}</div>
            <div className="text-xs text-[#4A5772] mt-1">Start logging games to see statistics!</div>
          </div>
        )}
      </div>
    </div>
  );
}
