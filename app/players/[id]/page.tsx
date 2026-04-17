'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Zap,
  ChevronDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, Game, AtBat, Season } from '@/lib/types';
import { filterAtBatsBySeason } from '@/lib/stats';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

// Pitching stats from DB
interface PitchingStatRecord {
  id: string;
  game_id: string;
  player_id: string;
  outs_recorded: number;
  strikeouts: number;
  walks: number;
  hits_allowed: number;
  earned_runs: number;
}

// Stat calculation helpers
function calculateBattingStats(atBats: AtBat[]) {
  const singles = atBats.filter((ab) => ab.result === 'single').length;
  const doubles = atBats.filter((ab) => ab.result === 'double').length;
  const triples = atBats.filter((ab) => ab.result === 'triple').length;
  const homeruns = atBats.filter((ab) => ab.result === 'homerun').length;
  const walks = atBats.filter((ab) => ab.result === 'walk').length;
  const strikeouts = atBats.filter((ab) => ab.result === 'strikeout').length;
  const outs = atBats.filter((ab) => ab.result === 'out' || ab.result === 'double_play').length;
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
  const abPerRbi = rbi > 0 ? ab / rbi : null;

  return {
    games: 0, // Will be set separately
    ab,
    pa,
    hits,
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
    abPerHr,
    abPerRbi,
  };
}

function calculatePitchingStats(pitchingRecords: PitchingStatRecord[]) {
  const outs = pitchingRecords.reduce((sum, ps) => sum + (ps.outs_recorded || 0), 0);
  const k = pitchingRecords.reduce((sum, ps) => sum + (ps.strikeouts || 0), 0);
  const bb = pitchingRecords.reduce((sum, ps) => sum + (ps.walks || 0), 0);
  const h = pitchingRecords.reduce((sum, ps) => sum + (ps.hits_allowed || 0), 0);
  const er = pitchingRecords.reduce((sum, ps) => sum + (ps.earned_runs || 0), 0);

  const ip = outs / 3;
  const era = outs > 0 ? (er / outs) * 27 : 0;
  const whip = outs > 0 ? ((bb + h) / outs) * 3 : 0;
  const kPerIp = outs > 0 ? (k * 3) / outs : 0;

  return { outs, ip, k, bb, h, er, era, whip, kPerIp };
}

// Format helpers
function formatAvg(avg: number): string {
  if (avg === 0) return '.000';
  return `.${String(Math.round(avg * 1000)).padStart(3, '0')}`;
}

function formatIp(outs: number): string {
  const innings = Math.floor(outs / 3);
  const partial = outs % 3;
  return partial > 0 ? `${innings}.${partial}` : `${innings}.0`;
}

// Stat block component
function StatBlock({
  label,
  value,
  subValue,
  highlight = false,
  size = 'standard',
}: {
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: boolean;
  size?: 'micro' | 'standard' | 'large';
}) {
  const sizeClasses = {
    micro: 'text-sm',
    standard: 'text-lg',
    large: 'text-2xl',
  };

  return (
    <div className="text-center">
      <div
        className={`font-bold tabular-nums ${sizeClasses[size]} leading-none`}
        style={{ color: highlight ? '#F0B429' : '#EFF2FF' }}
      >
        {value}
      </div>
      <div className="text-[10px] text-[#4A5772] uppercase tracking-widest mt-1">{label}</div>
      {subValue && <div className="text-[10px] text-[#8A9BBB] mt-0.5">{subValue}</div>}
    </div>
  );
}

// Graph stat options
type GraphStat = 'avg' | 'hr' | 'rbi' | 'ops' | 'era' | 'k' | 'kPerIp';

const graphStatOptions: { key: GraphStat; label: string; color: string; isPitching: boolean }[] = [
  { key: 'avg', label: 'Batting Avg', color: '#F0B429', isPitching: false },
  { key: 'hr', label: 'Home Runs', color: '#60A5FA', isPitching: false },
  { key: 'rbi', label: 'RBIs', color: '#34D399', isPitching: false },
  { key: 'ops', label: 'OPS', color: '#A78BFA', isPitching: false },
  { key: 'era', label: 'ERA', color: '#EF4444', isPitching: true },
  { key: 'k', label: 'Strikeouts', color: '#F97316', isPitching: true },
  { key: 'kPerIp', label: 'K/IP', color: '#EC4899', isPitching: true },
];

// Line chart component
function StatsChart({
  data,
  stat,
  color,
}: {
  data: { date: string; value: number }[];
  stat: GraphStat;
  color: string;
}) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[#4A5772] text-sm">
        No data available
      </div>
    );
  }

  const width = 100;
  const height = 48;
  const padding = { top: 4, right: 4, bottom: 4, left: 4 };

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - (d.value - minVal) / range) * (height - padding.top - padding.bottom);
    return { x, y, ...d };
  });

  const pathD = points.length > 1
    ? `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    : '';

  // Area fill
  const areaD = points.length > 1
    ? `M ${points[0].x} ${height - padding.bottom} L ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${points[points.length - 1].x} ${height - padding.bottom} Z`
    : '';

  return (
    <div className="h-48 relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-right pr-2">
        <span className="text-[10px] text-[#4A5772] tabular-nums">{maxVal.toFixed(stat === 'avg' || stat === 'ops' ? 3 : stat === 'era' || stat === 'kPerIp' ? 2 : 0)}</span>
        <span className="text-[10px] text-[#4A5772] tabular-nums">{((maxVal + minVal) / 2).toFixed(stat === 'avg' || stat === 'ops' ? 3 : stat === 'era' || stat === 'kPerIp' ? 2 : 0)}</span>
        <span className="text-[10px] text-[#4A5772] tabular-nums">{minVal.toFixed(stat === 'avg' || stat === 'ops' ? 3 : stat === 'era' || stat === 'kPerIp' ? 2 : 0)}</span>
      </div>

      {/* Chart */}
      <div className="absolute left-12 right-0 top-0 bottom-8">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
          {/* Grid lines */}
          <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          <line x1={padding.left} y1={height / 2} x2={width - padding.right} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

          {/* Area */}
          <motion.path
            key={`area-${stat}`}
            d={areaD}
            fill={`${color}15`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          {/* Line */}
          <motion.path
            key={`line-${stat}`}
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />

          {/* Points */}
          {points.map((point, i) => (
            <motion.circle
              key={`point-${stat}-${i}`}
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill={color}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.05, duration: 0.2 }}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="absolute left-12 right-0 bottom-0 h-8 flex justify-between items-start pt-1">
        {data.length > 0 && (
          <>
            <span className="text-[10px] text-[#4A5772]">
              {new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {data.length > 1 && (
              <span className="text-[10px] text-[#4A5772]">
                {new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [allAtBats, setAllAtBats] = useState<AtBat[]>([]);
  const [allPitchingStats, setAllPitchingStats] = useState<PitchingStatRecord[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  // Graph state
  const [selectedStat, setSelectedStat] = useState<GraphStat>('avg');
  const [showStatDropdown, setShowStatDropdown] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [playerRes, gamesRes, seasonsRes, pitchingRes] = await Promise.all([
        supabase.from('players').select('*').eq('id', id).single(),
        supabase
          .from('games')
          .select('*, game_players!inner(*)')
          .eq('game_players.player_id', id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false }),
        supabase.from('seasons').select('*').order('year', { ascending: false }),
        supabase.from('pitching_stats').select('*').eq('player_id', id),
      ]);

      // Fetch all at-bats for this player
      let allPlayerAtBats: AtBat[] = [];
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch } = await supabase
          .from('at_bats')
          .select('*')
          .eq('player_id', id)
          .range(offset, offset + batchSize - 1);
        if (!batch || batch.length === 0) break;
        allPlayerAtBats = [...allPlayerAtBats, ...batch];
        if (batch.length < batchSize) break;
        offset += batchSize;
      }

      setPlayer(playerRes.data);
      setGames(gamesRes.data || []);
      setAllAtBats(allPlayerAtBats);
      setAllPitchingStats(pitchingRes.data || []);
      setSeasons(seasonsRes.data || []);
      setLoading(false);
    }
    loadData();
  }, [id]);

  // Find current season (2026)
  const currentSeason = seasons.find((s) => s.year === 2026);

  // Calculate season stats
  const seasonStats = useMemo(() => {
    if (!currentSeason) return null;
    const seasonAtBats = filterAtBatsBySeason(allAtBats, games, currentSeason.id);
    const seasonGames = games.filter((g) => g.season_id === currentSeason.id);
    const seasonPitching = allPitchingStats.filter((ps) =>
      seasonGames.some((g) => g.id === ps.game_id)
    );

    const batting = calculateBattingStats(seasonAtBats);
    batting.games = seasonGames.length;
    const pitching = calculatePitchingStats(seasonPitching);

    // Win/loss
    const wins = seasonGames.filter((g) => g.score?.includes('W')).length;
    const losses = seasonGames.filter((g) => g.score?.includes('L')).length;

    return { batting, pitching, wins, losses };
  }, [currentSeason, allAtBats, games, allPitchingStats]);

  // Calculate career stats
  const careerStats = useMemo(() => {
    const batting = calculateBattingStats(allAtBats);
    batting.games = games.length;
    const pitching = calculatePitchingStats(allPitchingStats);

    const wins = games.filter((g) => g.score?.includes('W')).length;
    const losses = games.filter((g) => g.score?.includes('L')).length;

    return { batting, pitching, wins, losses };
  }, [allAtBats, games, allPitchingStats]);

  // Calculate graph data (rolling stats per game)
  const graphData = useMemo(() => {
    // Sort games by date ascending for graph
    const sortedGames = [...games].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const selectedOption = graphStatOptions.find((o) => o.key === selectedStat);
    if (!selectedOption) return [];

    if (selectedOption.isPitching) {
      // Pitching stats - cumulative over time
      let cumulativeOuts = 0;
      let cumulativeK = 0;
      let cumulativeER = 0;

      return sortedGames
        .map((game) => {
          const gamePitching = allPitchingStats.filter((ps) => ps.game_id === game.id);
          if (gamePitching.length === 0) return null;

          gamePitching.forEach((ps) => {
            cumulativeOuts += ps.outs_recorded || 0;
            cumulativeK += ps.strikeouts || 0;
            cumulativeER += ps.earned_runs || 0;
          });

          let value = 0;
          if (selectedStat === 'era') {
            value = cumulativeOuts > 0 ? (cumulativeER / cumulativeOuts) * 27 : 0;
          } else if (selectedStat === 'k') {
            value = cumulativeK;
          } else if (selectedStat === 'kPerIp') {
            value = cumulativeOuts > 0 ? (cumulativeK * 3) / cumulativeOuts : 0;
          }

          return { date: game.date, value };
        })
        .filter(Boolean) as { date: string; value: number }[];
    } else {
      // Batting stats - cumulative over time
      let cumulativeHits = 0;
      let cumulativeAB = 0;
      let cumulativeHR = 0;
      let cumulativeRBI = 0;
      let cumulativeSingles = 0;
      let cumulativeDoubles = 0;
      let cumulativeTriples = 0;
      let cumulativeWalks = 0;

      return sortedGames.map((game) => {
        const gameAtBats = allAtBats.filter((ab) => ab.game_id === game.id);

        const singles = gameAtBats.filter((ab) => ab.result === 'single').length;
        const doubles = gameAtBats.filter((ab) => ab.result === 'double').length;
        const triples = gameAtBats.filter((ab) => ab.result === 'triple').length;
        const hr = gameAtBats.filter((ab) => ab.result === 'homerun').length;
        const walks = gameAtBats.filter((ab) => ab.result === 'walk').length;
        const outs = gameAtBats.filter((ab) => ab.result === 'out' || ab.result === 'strikeout' || ab.result === 'double_play').length;
        const rbi = gameAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);

        cumulativeSingles += singles;
        cumulativeDoubles += doubles;
        cumulativeTriples += triples;
        cumulativeHR += hr;
        cumulativeHits += singles + doubles + triples + hr;
        cumulativeAB += singles + doubles + triples + hr + outs;
        cumulativeRBI += rbi;
        cumulativeWalks += walks;

        let value = 0;
        if (selectedStat === 'avg') {
          value = cumulativeAB > 0 ? cumulativeHits / cumulativeAB : 0;
        } else if (selectedStat === 'hr') {
          value = cumulativeHR;
        } else if (selectedStat === 'rbi') {
          value = cumulativeRBI;
        } else if (selectedStat === 'ops') {
          const obp = cumulativeAB + cumulativeWalks > 0
            ? (cumulativeHits + cumulativeWalks) / (cumulativeAB + cumulativeWalks)
            : 0;
          const slg = cumulativeAB > 0
            ? (cumulativeSingles + cumulativeDoubles * 2 + cumulativeTriples * 3 + cumulativeHR * 4) / cumulativeAB
            : 0;
          value = obp + slg;
        }

        return { date: game.date, value };
      });
    }
  }, [games, allAtBats, allPitchingStats, selectedStat]);

  const selectedStatOption = graphStatOptions.find((o) => o.key === selectedStat)!;

  // Check if player has pitching stats
  const hasPitchingStats = allPitchingStats.length > 0;

  // Filter stat options based on whether player has pitching
  const availableStatOptions = graphStatOptions.filter(
    (o) => !o.isPitching || hasPitchingStats
  );

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
          <div className="text-xs text-[#4A5772]">Player Card</div>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
          style={{ background: 'linear-gradient(135deg, #162035 0%, #1A2640 100%)', color: '#8A9BBB' }}
        >
          {player.name[0]}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        {/* Player Card Header */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl p-5 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0F1829 0%, #162035 100%)',
            border: '1px solid rgba(240,180,41,0.15)',
          }}
        >
          {/* Pinstripe pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 8px)',
            }}
          />

          <div className="relative flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mb-1">2026 Season</div>
              <div className="font-display font-bold text-3xl text-[#EFF2FF]">
                {seasonStats?.wins || 0}W – {seasonStats?.losses || 0}L
              </div>
            </div>
            {player.heat === 'hot' && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(240,180,41,0.12)', color: '#F0B429', border: '1px solid rgba(240,180,41,0.25)' }}
              >
                <Zap size={12} fill="#F0B429" />
                HOT
              </span>
            )}
          </div>

          {/* Hero stat */}
          <div className="flex items-end gap-6">
            <div>
              <div className="font-display font-bold text-5xl text-[#F0B429] tabular-nums">
                {formatAvg(seasonStats?.batting.avg || 0)}
              </div>
              <div className="text-[11px] text-[#4A5772] uppercase tracking-widest mt-1">AVG</div>
            </div>
            <div className="flex gap-6 pb-1">
              <StatBlock label="OPS" value={(seasonStats?.batting.ops || 0).toFixed(3)} size="large" />
              <StatBlock label="HR" value={seasonStats?.batting.hr || 0} size="large" />
              <StatBlock label="RBI" value={seasonStats?.batting.rbi || 0} size="large" />
            </div>
          </div>
        </motion.div>

        {/* 2026 Season Stats */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] text-[#60A5FA] uppercase tracking-widest font-semibold">2026 Season</h2>
            <span className="text-[11px] text-[#4A5772]">{seasonStats?.batting.games || 0} Games</span>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ background: '#0F1829', border: '1px solid rgba(96,165,250,0.15)' }}
          >
            {/* Batting */}
            <div className="text-[10px] text-[#4A5772] uppercase tracking-widest mb-3">Batting</div>
            <div className="grid grid-cols-7 gap-3 mb-4">
              <StatBlock label="AB" value={seasonStats?.batting.ab || 0} size="micro" />
              <StatBlock label="H" value={seasonStats?.batting.hits || 0} size="micro" />
              <StatBlock label="2B" value={seasonStats?.batting.doubles || 0} size="micro" />
              <StatBlock label="3B" value={seasonStats?.batting.triples || 0} size="micro" />
              <StatBlock label="HR" value={seasonStats?.batting.hr || 0} size="micro" />
              <StatBlock label="RBI" value={seasonStats?.batting.rbi || 0} size="micro" />
              <StatBlock label="BB" value={seasonStats?.batting.bb || 0} size="micro" />
            </div>
            <div className="grid grid-cols-6 gap-3">
              <StatBlock label="AVG" value={formatAvg(seasonStats?.batting.avg || 0)} size="micro" highlight />
              <StatBlock label="OBP" value={(seasonStats?.batting.obp || 0).toFixed(3)} size="micro" />
              <StatBlock label="SLG" value={(seasonStats?.batting.slg || 0).toFixed(3)} size="micro" />
              <StatBlock label="OPS" value={(seasonStats?.batting.ops || 0).toFixed(3)} size="micro" />
              <StatBlock label="K%" value={`${(seasonStats?.batting.kPercent || 0).toFixed(1)}%`} size="micro" />
              <StatBlock label="AB/HR" value={seasonStats?.batting.abPerHr?.toFixed(1) || '-'} size="micro" />
            </div>

            {/* Pitching (if applicable) */}
            {seasonStats && seasonStats.pitching.outs > 0 && (
              <>
                <div className="border-t border-white/5 my-4" />
                <div className="text-[10px] text-[#EF4444] uppercase tracking-widest mb-3">Pitching</div>
                <div className="grid grid-cols-7 gap-3">
                  <StatBlock label="IP" value={formatIp(seasonStats.pitching.outs)} size="micro" />
                  <StatBlock label="ERA" value={seasonStats.pitching.era.toFixed(2)} size="micro" highlight />
                  <StatBlock label="WHIP" value={seasonStats.pitching.whip.toFixed(2)} size="micro" />
                  <StatBlock label="K" value={seasonStats.pitching.k} size="micro" />
                  <StatBlock label="K/IP" value={seasonStats.pitching.kPerIp.toFixed(2)} size="micro" />
                  <StatBlock label="BB" value={seasonStats.pitching.bb} size="micro" />
                  <StatBlock label="ER" value={seasonStats.pitching.er} size="micro" />
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Career Stats */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] text-[#F0B429] uppercase tracking-widest font-semibold">Career</h2>
            <span className="text-[11px] text-[#4A5772]">{careerStats.batting.games} Games</span>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ background: '#0F1829', border: '1px solid rgba(240,180,41,0.15)' }}
          >
            {/* Batting */}
            <div className="text-[10px] text-[#4A5772] uppercase tracking-widest mb-3">Batting</div>
            <div className="grid grid-cols-7 gap-3 mb-4">
              <StatBlock label="AB" value={careerStats.batting.ab} size="micro" />
              <StatBlock label="H" value={careerStats.batting.hits} size="micro" />
              <StatBlock label="2B" value={careerStats.batting.doubles} size="micro" />
              <StatBlock label="3B" value={careerStats.batting.triples} size="micro" />
              <StatBlock label="HR" value={careerStats.batting.hr} size="micro" />
              <StatBlock label="RBI" value={careerStats.batting.rbi} size="micro" />
              <StatBlock label="BB" value={careerStats.batting.bb} size="micro" />
            </div>
            <div className="grid grid-cols-6 gap-3">
              <StatBlock label="AVG" value={formatAvg(careerStats.batting.avg)} size="micro" highlight />
              <StatBlock label="OBP" value={careerStats.batting.obp.toFixed(3)} size="micro" />
              <StatBlock label="SLG" value={careerStats.batting.slg.toFixed(3)} size="micro" />
              <StatBlock label="OPS" value={careerStats.batting.ops.toFixed(3)} size="micro" />
              <StatBlock label="K%" value={`${careerStats.batting.kPercent.toFixed(1)}%`} size="micro" />
              <StatBlock label="AB/HR" value={careerStats.batting.abPerHr?.toFixed(1) || '-'} size="micro" />
            </div>

            {/* Pitching (if applicable) */}
            {careerStats.pitching.outs > 0 && (
              <>
                <div className="border-t border-white/5 my-4" />
                <div className="text-[10px] text-[#EF4444] uppercase tracking-widest mb-3">Pitching</div>
                <div className="grid grid-cols-7 gap-3">
                  <StatBlock label="IP" value={formatIp(careerStats.pitching.outs)} size="micro" />
                  <StatBlock label="ERA" value={careerStats.pitching.era.toFixed(2)} size="micro" highlight />
                  <StatBlock label="WHIP" value={careerStats.pitching.whip.toFixed(2)} size="micro" />
                  <StatBlock label="K" value={careerStats.pitching.k} size="micro" />
                  <StatBlock label="K/IP" value={careerStats.pitching.kPerIp.toFixed(2)} size="micro" />
                  <StatBlock label="BB" value={careerStats.pitching.bb} size="micro" />
                  <StatBlock label="ER" value={careerStats.pitching.er} size="micro" />
                </div>
              </>
            )}

            {/* Career record */}
            <div className="border-t border-white/5 my-4" />
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#34D399]">{careerStats.wins}</div>
                <div className="text-[10px] text-[#4A5772] uppercase tracking-widest">Wins</div>
              </div>
              <div className="text-2xl text-[#4A5772]">–</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#F87171]">{careerStats.losses}</div>
                <div className="text-[10px] text-[#4A5772] uppercase tracking-widest">Losses</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Trend Graph */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] text-[#8A9BBB] uppercase tracking-widest font-semibold">Trend</h2>

            {/* Stat selector dropdown */}
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowStatDropdown(!showStatDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: `${selectedStatOption.color}15`,
                  color: selectedStatOption.color,
                  border: `1px solid ${selectedStatOption.color}30`,
                }}
              >
                {selectedStatOption.label}
                <ChevronDown size={12} className={`transition-transform ${showStatDropdown ? 'rotate-180' : ''}`} />
              </motion.button>

              <AnimatePresence>
                {showStatDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 z-20 rounded-xl overflow-hidden"
                    style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {availableStatOptions.map((option) => (
                      <motion.button
                        key={option.key}
                        whileHover={{ background: 'rgba(255,255,255,0.05)' }}
                        onClick={() => {
                          setSelectedStat(option.key);
                          setShowStatDropdown(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-medium flex items-center gap-2"
                        style={{ color: option.key === selectedStat ? option.color : '#8A9BBB' }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: option.color }}
                        />
                        {option.label}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedStat}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <StatsChart data={graphData} stat={selectedStat} color={selectedStatOption.color} />
              </motion.div>
            </AnimatePresence>

            {/* Current value indicator */}
            {graphData.length > 0 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/5">
                <span className="text-[11px] text-[#4A5772]">Current:</span>
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: selectedStatOption.color }}
                >
                  {selectedStat === 'avg' || selectedStat === 'ops'
                    ? graphData[graphData.length - 1].value.toFixed(3)
                    : selectedStat === 'era' || selectedStat === 'kPerIp'
                    ? graphData[graphData.length - 1].value.toFixed(2)
                    : graphData[graphData.length - 1].value}
                </span>
                {graphData.length > 1 && (
                  <span className="flex items-center gap-1 text-xs">
                    {graphData[graphData.length - 1].value > graphData[graphData.length - 2].value ? (
                      <>
                        <TrendingUp size={12} className="text-[#34D399]" />
                        <span className="text-[#34D399]">
                          +{(graphData[graphData.length - 1].value - graphData[graphData.length - 2].value).toFixed(selectedStat === 'avg' || selectedStat === 'ops' ? 3 : selectedStat === 'era' || selectedStat === 'kPerIp' ? 2 : 0)}
                        </span>
                      </>
                    ) : graphData[graphData.length - 1].value < graphData[graphData.length - 2].value ? (
                      <>
                        <TrendingDown size={12} className="text-[#F87171]" />
                        <span className="text-[#F87171]">
                          {(graphData[graphData.length - 1].value - graphData[graphData.length - 2].value).toFixed(selectedStat === 'avg' || selectedStat === 'ops' ? 3 : selectedStat === 'era' || selectedStat === 'kPerIp' ? 2 : 0)}
                        </span>
                      </>
                    ) : null}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
