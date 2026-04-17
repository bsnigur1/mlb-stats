'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Player, Game, AtBat, Season } from '@/lib/types';
import { filterAtBatsBySeason } from '@/lib/stats';

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

interface PlayerModalProps {
  playerId: string;
  onClose: () => void;
}

// Stat calculation helpers
function calculateBattingStats(atBats: AtBat[]) {
  const singles = atBats.filter((ab) => ab.result === 'single').length;
  const doubles = atBats.filter((ab) => ab.result === 'double').length;
  const triples = atBats.filter((ab) => ab.result === 'triple').length;
  const homeruns = atBats.filter((ab) => ab.result === 'homerun').length;
  const walks = atBats.filter((ab) => ab.result === 'walk').length;
  const strikeouts = atBats.filter((ab) => ab.result === 'strikeout').length;
  const outs = atBats.filter((ab) => ab.result === 'out').length;
  const rbi = atBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);

  const hits = singles + doubles + triples + homeruns;
  const ab = hits + strikeouts + outs;
  const avg = ab > 0 ? hits / ab : 0;
  const slg = ab > 0 ? (singles + doubles * 2 + triples * 3 + homeruns * 4) / ab : 0;
  const obp = ab + walks > 0 ? (hits + walks) / (ab + walks) : 0;
  const ops = obp + slg;

  return { ab, hits, doubles, triples, hr: homeruns, rbi, bb: walks, k: strikeouts, avg, obp, slg, ops };
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

function formatAvg(avg: number): string {
  if (avg === 0) return '.000';
  return `.${String(Math.round(avg * 1000)).padStart(3, '0')}`;
}

function formatIp(outs: number): string {
  const innings = Math.floor(outs / 3);
  const partial = outs % 3;
  return partial > 0 ? `${innings}.${partial}` : `${innings}.0`;
}

// Graph stat options
type GraphStat = 'avg' | 'abPerHr' | 'abPerRbi' | 'ops' | 'era' | 'kPerIp';

const graphStatOptions: { key: GraphStat; label: string; color: string; isPitching: boolean; lowerIsBetter?: boolean }[] = [
  { key: 'avg', label: 'AVG', color: '#F0B429', isPitching: false },
  { key: 'abPerHr', label: 'AB/HR', color: '#60A5FA', isPitching: false, lowerIsBetter: true },
  { key: 'abPerRbi', label: 'AB/RBI', color: '#34D399', isPitching: false, lowerIsBetter: true },
  { key: 'ops', label: 'OPS', color: '#A78BFA', isPitching: false },
  { key: 'era', label: 'ERA', color: '#EF4444', isPitching: true, lowerIsBetter: true },
  { key: 'kPerIp', label: 'K/IP', color: '#EC4899', isPitching: true },
];

// Simple line chart with hover
function StatsChart({
  data,
  stat,
  color,
}: {
  data: { date: string; value: number }[];
  stat: GraphStat;
  color: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-[#4A5772] text-sm">
        No data available
      </div>
    );
  }

  const width = 400;
  const height = 80;
  const padding = { top: 8, right: 8, bottom: 8, left: 8 };

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

  const decimals = stat === 'avg' || stat === 'ops' ? 3 : stat === 'era' || stat === 'kPerIp' || stat === 'abPerHr' || stat === 'abPerRbi' ? 1 : 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const index = Math.round(percentage * (data.length - 1));
    setHoverIndex(Math.max(0, Math.min(data.length - 1, index)));
  };

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="h-32 relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-right pr-2">
        <span className="text-[10px] text-[#4A5772] tabular-nums">{maxVal.toFixed(decimals)}</span>
        <span className="text-[10px] text-[#4A5772] tabular-nums">{minVal.toFixed(decimals)}</span>
      </div>

      {/* Chart */}
      <div
        className="absolute left-10 right-0 top-0 bottom-6 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Hover indicator */}
        {hoverPoint && (
          <>
            {/* Vertical line */}
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: `${(hoverPoint.x / width) * 100}%`,
                background: 'rgba(255,255,255,0.3)',
              }}
            />
            {/* Dot */}
            <div
              className="absolute w-3 h-3 rounded-full border-2"
              style={{
                left: `${(hoverPoint.x / width) * 100}%`,
                top: `${(hoverPoint.y / height) * 100}%`,
                transform: 'translate(-50%, -50%)',
                background: '#0A0F1C',
                borderColor: color,
              }}
            />
            {/* Tooltip */}
            <div
              className="absolute px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
              style={{
                left: `${(hoverPoint.x / width) * 100}%`,
                top: `${(hoverPoint.y / height) * 100}%`,
                transform: 'translate(-50%, -130%)',
                background: '#162035',
                color: '#EFF2FF',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <span className="text-[#4A5772]">
                {new Date(hoverPoint.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}:
              </span>{' '}
              <span style={{ color }}>{hoverPoint.value.toFixed(decimals)}</span>
            </div>
          </>
        )}
      </div>

      {/* X-axis labels */}
      <div className="absolute left-10 right-0 bottom-0 h-6 flex justify-between items-start">
        <span className="text-[10px] text-[#4A5772]">Mar 15</span>
        {data.length > 1 && (
          <span className="text-[10px] text-[#4A5772]">
            {new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PlayerModal({ playerId, onClose }: PlayerModalProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [allAtBats, setAllAtBats] = useState<AtBat[]>([]);
  const [allPitchingStats, setAllPitchingStats] = useState<PitchingStatRecord[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStat, setSelectedStat] = useState<GraphStat>('avg');
  const [showStatDropdown, setShowStatDropdown] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [playerRes, gamesRes, seasonsRes, pitchingRes] = await Promise.all([
        supabase.from('players').select('*').eq('id', playerId).single(),
        supabase
          .from('games')
          .select('*, game_players(*)')
          .order('created_at', { ascending: false }),
        supabase.from('seasons').select('*').order('year', { ascending: true }),
        supabase.from('pitching_stats').select('*').eq('player_id', playerId),
      ]);

      let allPlayerAtBats: AtBat[] = [];
      let offset = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch } = await supabase
          .from('at_bats')
          .select('*')
          .eq('player_id', playerId)
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
  }, [playerId]);

  // Get unique game IDs where this player has at_bats
  const playerGameIds = useMemo(() => {
    return new Set(allAtBats.map(ab => ab.game_id));
  }, [allAtBats]);

  // Calculate stats per season
  const seasonRows = useMemo(() => {
    return seasons.map((season) => {
      const seasonAtBats = filterAtBatsBySeason(allAtBats, games, season.id);
      const seasonGames = games.filter((g) => g.season_id === season.id && playerGameIds.has(g.id));
      const seasonPitching = allPitchingStats.filter((ps) =>
        seasonGames.some((g) => g.id === ps.game_id)
      );

      const batting = calculateBattingStats(seasonAtBats);
      const pitching = calculatePitchingStats(seasonPitching);
      const gamesPlayed = seasonGames.length;

      return { season, batting, pitching, gamesPlayed };
    }).filter(row => row.gamesPlayed > 0 || row.batting.ab > 0);
  }, [seasons, allAtBats, games, allPitchingStats, playerGameIds]);

  // Career totals
  const careerStats = useMemo(() => {
    const batting = calculateBattingStats(allAtBats);
    const pitching = calculatePitchingStats(allPitchingStats);
    const gamesPlayed = games.filter(g => playerGameIds.has(g.id)).length;
    return { batting, pitching, gamesPlayed };
  }, [allAtBats, games, allPitchingStats, playerGameIds]);

  // Graph data - cumulative from March 15, 2026
  const graphData = useMemo(() => {
    const startDate = new Date('2026-03-15');
    const sortedGames = [...games]
      .filter(g => new Date(g.date) >= startDate && playerGameIds.has(g.id))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const selectedOption = graphStatOptions.find((o) => o.key === selectedStat);
    if (!selectedOption) return [];

    if (selectedOption.isPitching) {
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
          } else if (selectedStat === 'kPerIp') {
            value = cumulativeOuts > 0 ? (cumulativeK * 3) / cumulativeOuts : 0;
          }

          return { date: game.date, value };
        })
        .filter(Boolean) as { date: string; value: number }[];
    } else {
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
        const strikeouts = gameAtBats.filter((ab) => ab.result === 'strikeout').length;
        const outs = gameAtBats.filter((ab) => ab.result === 'out').length;
        const rbi = gameAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);

        cumulativeSingles += singles;
        cumulativeDoubles += doubles;
        cumulativeTriples += triples;
        cumulativeHR += hr;
        cumulativeHits += singles + doubles + triples + hr;
        cumulativeAB += singles + doubles + triples + hr + strikeouts + outs;
        cumulativeRBI += rbi;
        cumulativeWalks += walks;

        let value = 0;
        if (selectedStat === 'avg') {
          value = cumulativeAB > 0 ? cumulativeHits / cumulativeAB : 0;
        } else if (selectedStat === 'abPerHr') {
          value = cumulativeHR > 0 ? cumulativeAB / cumulativeHR : 0;
        } else if (selectedStat === 'abPerRbi') {
          value = cumulativeRBI > 0 ? cumulativeAB / cumulativeRBI : 0;
        } else if (selectedStat === 'ops') {
          const obp = cumulativeAB + cumulativeWalks > 0
            ? (cumulativeHits + cumulativeWalks) / (cumulativeAB + cumulativeWalks)
            : 0;
          const slg = cumulativeAB > 0
            ? (cumulativeSingles + cumulativeDoubles * 2 + cumulativeTriples * 3 + cumulativeHR * 4) / cumulativeAB
            : 0;
          value = obp + slg;
        }

        // Skip data points where the rate stat would be 0 (no HR or RBI yet)
        if ((selectedStat === 'abPerHr' || selectedStat === 'abPerRbi') && value === 0) {
          return null;
        }

        return { date: game.date, value };
      }).filter(Boolean) as { date: string; value: number }[];
    }
  }, [games, allAtBats, allPitchingStats, selectedStat, playerGameIds]);

  const selectedStatOption = graphStatOptions.find((o) => o.key === selectedStat)!;
  const hasPitchingStats = allPitchingStats.length > 0;
  const availableStatOptions = graphStatOptions.filter((o) => !o.isPitching || hasPitchingStats);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

  if (!player) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl"
        style={{ background: '#0A0F1C' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4" style={{ background: '#0A0F1C', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl font-bold"
              style={{ background: '#162035', color: '#8A9BBB' }}
            >
              {player.name[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#EFF2FF]">{player.name}</h1>
              <div className="text-sm text-[#4A5772]">Player Card</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={20} color="#8A9BBB" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Awards Section */}
          {player.name === 'Greg' && (
            <div className="flex flex-wrap gap-2">
              <div
                className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <span>🏆</span> 2025 MVP
              </div>
              <div
                className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                style={{ background: 'rgba(168,85,247,0.15)', color: '#A855F7', border: '1px solid rgba(168,85,247,0.3)' }}
              >
                <span>👑</span> 2025 Triple Crown
              </div>
            </div>
          )}

          {/* Batting Stats Table */}
          <div>
            <h2 className="text-xs text-[#4A5772] uppercase tracking-widest font-semibold mb-3">Batting</h2>
            <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr style={{ background: '#0F1829' }}>
                    <th className="px-4 py-3 text-left text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">Season</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">AB</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">H</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">2B</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">3B</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">HR</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">RBI</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">BB</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">AVG</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">OBP</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">SLG</th>
                    <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">OPS</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonRows.map((row) => (
                    <tr key={row.season.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-4 py-3 text-sm font-medium text-[#EFF2FF]">{row.season.year}</td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.batting.ab}</td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.batting.hits}</td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.batting.doubles}</td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.batting.triples}</td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.batting.hr}</td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.batting.rbi}</td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.batting.bb}</td>
                      <td className="px-3 py-3 text-sm text-[#F0B429] text-right tabular-nums font-medium">{formatAvg(row.batting.avg)}</td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.batting.obp.toFixed(3)}</td>
                      <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.batting.slg.toFixed(3)}</td>
                      <td className="px-3 py-3 text-sm text-[#60A5FA] text-right tabular-nums font-medium">{row.batting.ops.toFixed(3)}</td>
                    </tr>
                  ))}
                  {/* Career row */}
                  <tr style={{ borderTop: '2px solid rgba(255,255,255,0.15)', background: '#0F1829' }}>
                    <td className="px-4 py-3 text-sm font-bold text-[#EFF2FF]">Career</td>
                    <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.batting.ab}</td>
                    <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.batting.hits}</td>
                    <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.batting.doubles}</td>
                    <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.batting.triples}</td>
                    <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.batting.hr}</td>
                    <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.batting.rbi}</td>
                    <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.batting.bb}</td>
                    <td className="px-3 py-3 text-sm text-[#F0B429] text-right tabular-nums font-bold">{formatAvg(careerStats.batting.avg)}</td>
                    <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.batting.obp.toFixed(3)}</td>
                    <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.batting.slg.toFixed(3)}</td>
                    <td className="px-3 py-3 text-sm text-[#60A5FA] text-right tabular-nums font-bold">{careerStats.batting.ops.toFixed(3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pitching Stats Table */}
          {hasPitchingStats && (
            <div>
              <h2 className="text-xs text-[#EF4444] uppercase tracking-widest font-semibold mb-3">Pitching</h2>
              <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr style={{ background: '#0F1829' }}>
                      <th className="px-4 py-3 text-left text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">Season</th>
                      <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">IP</th>
                      <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">ERA</th>
                      <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">WHIP</th>
                      <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">K</th>
                      <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">K/IP</th>
                      <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">BB</th>
                      <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">H</th>
                      <th className="px-3 py-3 text-right text-[11px] text-[#4A5772] uppercase tracking-wider font-semibold">ER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonRows.filter(row => row.pitching.outs > 0).map((row) => (
                      <tr key={row.season.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="px-4 py-3 text-sm font-medium text-[#EFF2FF]">{row.season.year}</td>
                        <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{formatIp(row.pitching.outs)}</td>
                        <td className="px-3 py-3 text-sm text-[#EF4444] text-right tabular-nums font-medium">{row.pitching.era.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.pitching.whip.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.pitching.k}</td>
                        <td className="px-3 py-3 text-sm text-[#60A5FA] text-right tabular-nums font-medium">{row.pitching.kPerIp.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.pitching.bb}</td>
                        <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.pitching.h}</td>
                        <td className="px-3 py-3 text-sm text-[#8A9BBB] text-right tabular-nums">{row.pitching.er}</td>
                      </tr>
                    ))}
                    {/* Career row */}
                    {careerStats.pitching.outs > 0 && (
                      <tr style={{ borderTop: '2px solid rgba(255,255,255,0.15)', background: '#0F1829' }}>
                        <td className="px-4 py-3 text-sm font-bold text-[#EFF2FF]">Career</td>
                        <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{formatIp(careerStats.pitching.outs)}</td>
                        <td className="px-3 py-3 text-sm text-[#EF4444] text-right tabular-nums font-bold">{careerStats.pitching.era.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.pitching.whip.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.pitching.k}</td>
                        <td className="px-3 py-3 text-sm text-[#60A5FA] text-right tabular-nums font-bold">{careerStats.pitching.kPerIp.toFixed(2)}</td>
                        <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.pitching.bb}</td>
                        <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.pitching.h}</td>
                        <td className="px-3 py-3 text-sm text-[#EFF2FF] text-right tabular-nums font-semibold">{careerStats.pitching.er}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trend Graph */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-[#4A5772] uppercase tracking-widest font-semibold">2026 Season Trend</h2>
              <div className="relative">
                <button
                  onClick={() => setShowStatDropdown(!showStatDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: `${selectedStatOption.color}15`,
                    color: selectedStatOption.color,
                    border: `1px solid ${selectedStatOption.color}30`,
                  }}
                >
                  {selectedStatOption.label}
                  <ChevronDown size={12} />
                </button>

                {showStatDropdown && (
                  <div
                    className="absolute right-0 top-full mt-1 z-20 rounded-lg overflow-hidden py-1"
                    style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {availableStatOptions.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => {
                          setSelectedStat(option.key);
                          setShowStatDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-medium flex items-center gap-2 hover:bg-white/5"
                        style={{ color: option.key === selectedStat ? option.color : '#8A9BBB' }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: option.color }} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg p-4" style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}>
              <StatsChart data={graphData} stat={selectedStat} color={selectedStatOption.color} />

              {graphData.length > 0 && (
                <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-white/5">
                  <span className="text-[11px] text-[#4A5772]">Current:</span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: selectedStatOption.color }}>
                    {selectedStat === 'avg' || selectedStat === 'ops'
                      ? graphData[graphData.length - 1].value.toFixed(3)
                      : selectedStat === 'era' || selectedStat === 'kPerIp' || selectedStat === 'abPerHr' || selectedStat === 'abPerRbi'
                      ? graphData[graphData.length - 1].value.toFixed(1)
                      : graphData[graphData.length - 1].value}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
