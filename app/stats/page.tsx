'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, AtBat, Game } from '@/lib/types';

type SortKey = 'name' | 'avg' | 'obp' | 'slg' | 'ops' | 'hr' | 'rbi' | 'h' | 'ab' | 'bb' | 'k' | 'kPercent';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

export default function StatsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('avg');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    async function loadData() {
      const [playersRes, atBatsRes, gamesRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('at_bats').select('*'),
        supabase.from('games').select('*, game_players(*)'),
      ]);

      setPlayers(playersRes.data || []);
      setAtBats(atBatsRes.data || []);
      setGames(gamesRes.data || []);
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
  });

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
    { key: 'ab', label: 'AB' },
    { key: 'h', label: 'H' },
    { key: 'hr', label: 'HR' },
    { key: 'rbi', label: 'RBI' },
    { key: 'bb', label: 'BB' },
    { key: 'k', label: 'K' },
    { key: 'avg', label: 'AVG', format: (v) => `.${String(Math.round(v * 1000)).padStart(3, '0')}` },
    { key: 'obp', label: 'OBP', format: (v) => `.${String(Math.round(v * 1000)).padStart(3, '0')}` },
    { key: 'slg', label: 'SLG', format: (v) => `.${String(Math.round(v * 1000)).padStart(3, '0')}` },
    { key: 'ops', label: 'OPS', format: (v) => v.toFixed(3) },
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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">CAREER STATS</h1>
          <div className="text-xs text-[#4A5772]">All-time batting statistics</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-5">
        <motion.div
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
                    <Link href={`/players/${ps.player.id}`}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                          style={{ background: '#162035', color: '#8A9BBB' }}
                        >
                          {ps.player.name[0]}
                        </div>
                        <span className="text-sm font-medium text-[#EFF2FF] hover:text-[#60A5FA]">
                          {ps.player.name}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.ab}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.h}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.hr}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.rbi}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.bb}</td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.k}</td>
                  <td className="px-3 py-3 text-sm text-[#F0B429] text-right tabular-nums font-bold">
                    {columns.find((c) => c.key === 'avg')?.format?.(ps.avg)}
                  </td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">
                    {columns.find((c) => c.key === 'obp')?.format?.(ps.obp)}
                  </td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">
                    {columns.find((c) => c.key === 'slg')?.format?.(ps.slg)}
                  </td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">
                    {ps.ops.toFixed(3)}
                  </td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">
                    {ps.kPercent.toFixed(1)}%
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {players.length === 0 && (
          <div
            className="text-center py-12 rounded-lg"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <BarChart2 size={32} color="#4A5772" className="mx-auto mb-3" />
            <div className="text-[#4A5772] text-sm">No stats yet</div>
            <div className="text-xs text-[#4A5772] mt-1">Start logging games to see statistics!</div>
          </div>
        )}
      </div>
    </div>
  );
}
