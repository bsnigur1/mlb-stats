'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart2, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import Link from 'next/link';
// Note: Link is still used for the back button
import { supabase } from '@/lib/supabase';
import { Player, AtBat, Game, Session, Season } from '@/lib/types';
import { filterAtBatsBySeason, countGamesInSeason } from '@/lib/stats';

type SortKey = 'name' | 'games' | 'avg' | 'obp' | 'slg' | 'ops' | 'hr' | 'rbi' | 'h' | 'doubles' | 'triples' | 'ab' | 'bb' | 'kPercent';
type PitchingSortKey = 'name' | 'ip' | 'k' | 'bb' | 'h' | 'er' | 'era' | 'whip';

interface PitchingStatRow {
  player_id: string;
  player_name: string;
  outs: number;
  k: number;
  bb: number;
  h: number;
  er: number;
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
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('avg');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeSection, setActiveSection] = useState<'2026' | '2025' | 'career'>('2026');
  const [pitchingStats, setPitchingStats] = useState<PitchingStatRow[]>([]);
  const [pitchingSortKey, setPitchingSortKey] = useState<PitchingSortKey>('era');
  const [pitchingSortDir, setPitchingSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    async function loadData() {
      const [playersRes, gamesRes, sessionsRes, seasonsRes, pitchingRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('games').select('*, game_players(*)').limit(1000),
        supabase.from('sessions').select('*'),
        supabase.from('seasons').select('*').order('year', { ascending: false }),
        supabase.from('pitching_stats').select('*, player:players(name)'),
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

      // Aggregate pitching stats by player
      const pitchingByPlayer: Record<string, { outs: number; k: number; bb: number; h: number; er: number; name: string }> = {};
      const gamesData = gamesRes.data || [];

      pitchingRes.data?.forEach((ps: { player_id: string; game_id: string; outs_recorded: number; strikeouts: number; walks: number; hits_allowed: number; earned_runs: number; player: { name: string } }) => {
        // Get the game to check season
        const game = gamesData.find((g) => g.id === ps.game_id);
        if (!game) return;

        // Only include stats from 2026 season games
        const season2026 = seasonsRes.data?.find((s) => s.year === 2026);
        if (!season2026 || game.season_id !== season2026.id) return;

        if (!pitchingByPlayer[ps.player_id]) {
          pitchingByPlayer[ps.player_id] = { outs: 0, k: 0, bb: 0, h: 0, er: 0, name: ps.player?.name || 'Unknown' };
        }
        pitchingByPlayer[ps.player_id].outs += ps.outs_recorded || 0;
        pitchingByPlayer[ps.player_id].k += ps.strikeouts || 0;
        pitchingByPlayer[ps.player_id].bb += ps.walks || 0;
        pitchingByPlayer[ps.player_id].h += ps.hits_allowed || 0;
        pitchingByPlayer[ps.player_id].er += ps.earned_runs || 0;
      });

      const pitchingRows: PitchingStatRow[] = Object.entries(pitchingByPlayer).map(([player_id, stats]) => ({
        player_id,
        player_name: stats.name,
        outs: stats.outs,
        k: stats.k,
        bb: stats.bb,
        h: stats.h,
        er: stats.er,
      }));

      setPlayers(playersRes.data || []);
      setAtBats(allAtBats);
      setGames(gamesRes.data || []);
      setSessions(sessionsRes.data || []);
      setSeasons(seasonsRes.data || []);
      setPitchingStats(pitchingRows);
      setLoading(false);
    }
    loadData();
  }, []);

  // Calculate stats filtered by season
  const getFilteredStats = () => {
    if (activeSection === 'career') {
      // Career = all games
      return players.map((player) => calculatePlayerStats(player, atBats, games));
    }

    // Find the season
    const season = seasons.find(s => s.year.toString() === activeSection);
    if (!season) {
      return players.map((player) => calculatePlayerStats(player, [], []));
    }

    // Filter games and at-bats by season
    const seasonGames = games.filter(g => g.season_id === season.id);
    const seasonAtBats = filterAtBatsBySeason(atBats, games, season.id);

    return players.map((player) => calculatePlayerStats(player, seasonAtBats, seasonGames));
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

  const handlePitchingSort = (key: PitchingSortKey) => {
    if (pitchingSortKey === key) {
      setPitchingSortDir(pitchingSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setPitchingSortKey(key);
      // ERA and WHIP are better when lower
      setPitchingSortDir(key === 'era' || key === 'whip' ? 'asc' : 'desc');
    }
  };

  // Calculate derived pitching stats and sort
  const getSortedPitchingStats = () => {
    const withDerived = pitchingStats.map(ps => {
      const ip = ps.outs / 3;
      const era = ps.outs > 0 ? (ps.er / ps.outs) * 27 : 0;
      const whip = ps.outs > 0 ? ((ps.bb + ps.h) / ps.outs) * 3 : 0;
      return { ...ps, ip, era, whip };
    });

    return withDerived.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (pitchingSortKey) {
        case 'name':
          aVal = a.player_name;
          bVal = b.player_name;
          break;
        case 'ip':
          aVal = a.ip;
          bVal = b.ip;
          break;
        case 'k':
          aVal = a.k;
          bVal = b.k;
          break;
        case 'bb':
          aVal = a.bb;
          bVal = b.bb;
          break;
        case 'h':
          aVal = a.h;
          bVal = b.h;
          break;
        case 'er':
          aVal = a.er;
          bVal = b.er;
          break;
        case 'era':
          aVal = a.era;
          bVal = b.era;
          break;
        case 'whip':
          aVal = a.whip;
          bVal = b.whip;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (typeof aVal === 'string') {
        return pitchingSortDir === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return pitchingSortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  };

  const sortedPitching = getSortedPitchingStats();

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
    { key: 'avg', label: 'AVG', format: (v) => v > 0 ? `.${String(Math.round(v * 1000)).padStart(3, '0')}` : '.000' },
    { key: 'obp', label: 'OBP', format: (v) => v > 0 ? `.${String(Math.round(v * 1000)).padStart(3, '0')}` : '.000' },
    { key: 'slg', label: 'SLG', format: (v) => v > 0 ? `.${String(Math.round(v * 1000)).padStart(3, '0')}` : '.000' },
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
            onClick={() => setActiveSection('2026')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeSection === '2026' ? '#60A5FA' : '#162035',
              color: activeSection === '2026' ? '#080D18' : '#8A9BBB',
            }}
          >
            2026 Season
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveSection('2025')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
            style={{
              background: activeSection === '2025' ? '#60A5FA' : '#162035',
              color: activeSection === '2025' ? '#080D18' : '#8A9BBB',
            }}
          >
            2025 Season
            <Lock size={12} />
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
            Career
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
                  <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{ps.ab}</td>
                  <td className="px-3 py-3 text-sm text-[#F0B429] text-right tabular-nums font-bold">
                    {columns.find((c) => c.key === 'avg')?.format?.(ps.avg)}
                  </td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">
                    {columns.find((c) => c.key === 'obp')?.format?.(ps.obp)}
                  </td>
                  <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">
                    {columns.find((c) => c.key === 'slg')?.format?.(ps.slg)}
                  </td>
                  <td className="px-3 py-3 text-sm text-[#60A5FA] text-right tabular-nums font-bold">
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

        {/* Pitching Stats - only show for 2026 and Career */}
        {(activeSection === '2026' || activeSection === 'career') && sortedPitching.length > 0 && (
          <motion.div
            key={`pitching-${activeSection}`}
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-lg overflow-x-auto mt-6"
            style={{ background: '#0F1829', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-[11px] text-[#EF4444] uppercase tracking-widest font-semibold">Pitching</h2>
            </div>
            <table className="w-full min-w-[500px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {[
                    { key: 'name', label: 'Player' },
                    { key: 'ip', label: 'IP' },
                    { key: 'era', label: 'ERA' },
                    { key: 'whip', label: 'WHIP' },
                    { key: 'k', label: 'K' },
                    { key: 'bb', label: 'BB' },
                    { key: 'h', label: 'H' },
                    { key: 'er', label: 'ER' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handlePitchingSort(col.key as PitchingSortKey)}
                      className="px-3 py-3 text-[11px] text-[#4A5772] uppercase tracking-widest font-semibold cursor-pointer hover:text-[#8A9BBB] transition-colors"
                      style={{ textAlign: col.key === 'name' ? 'left' : 'right' }}
                    >
                      <div
                        className="flex items-center gap-1"
                        style={{ justifyContent: col.key === 'name' ? 'flex-start' : 'flex-end' }}
                      >
                        {col.label}
                        {pitchingSortKey === col.key && (pitchingSortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPitching.map((ps, i) => {
                  const ipDisplay = ps.outs % 3 === 0 ? `${Math.floor(ps.outs / 3)}.0` : `${Math.floor(ps.outs / 3)}.${ps.outs % 3}`;
                  return (
                    <motion.tr
                      key={ps.player_id}
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
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
                          >
                            {ps.player_name[0]}
                          </div>
                          <span className="text-sm font-medium text-[#EFF2FF]">
                            {ps.player_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{ipDisplay}</td>
                      <td className="px-3 py-3 text-sm text-[#EF4444] text-right tabular-nums font-bold">
                        {ps.era.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">
                        {ps.whip.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-sm text-[#22C55E] text-right tabular-nums">{ps.k}</td>
                      <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.bb}</td>
                      <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.h}</td>
                      <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums">{ps.er}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}

        {playerStats.every((ps) => ps.ab === 0) && (
          <div
            className="text-center py-12 rounded-lg mt-5"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <BarChart2 size={32} color="#4A5772" className="mx-auto mb-3" />
            <div className="text-[#4A5772] text-sm">No stats for {activeSection === 'career' ? 'Career' : `${activeSection} Season`}</div>
            <div className="text-xs text-[#4A5772] mt-1">Start logging games to see statistics!</div>
          </div>
        )}
      </div>
    </div>
  );
}
