'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowLeftRight, ChevronDown, Trophy, Swords, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Player, AtBat, Game } from '@/lib/types';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

// Matchup record type
interface MatchupRecord {
  player1: Player;
  player2: Player;
  player1Wins: number;
  player2Wins: number;
  games: Game[];
}

// Stat comparison row
function StatRow({
  label,
  value1,
  value2,
  higherIsBetter = true,
  format = 'number',
}: {
  label: string;
  value1: number;
  value2: number;
  higherIsBetter?: boolean;
  format?: 'number' | 'avg' | 'percent';
}) {
  const diff = value1 - value2;
  const p1Wins = higherIsBetter ? diff > 0 : diff < 0;
  const p2Wins = higherIsBetter ? diff < 0 : diff > 0;
  const isTie = diff === 0;

  const formatValue = (val: number) => {
    switch (format) {
      case 'avg':
        return `.${String(Math.round(val * 1000)).padStart(3, '0')}`;
      case 'percent':
        return `${val.toFixed(1)}%`;
      default:
        return val.toFixed(val % 1 === 0 ? 0 : 2);
    }
  };

  return (
    <div className="flex items-center py-3 border-b border-white/5 last:border-0">
      <div
        className="flex-1 text-right pr-4 text-lg font-bold tabular-nums"
        style={{ color: p1Wins ? '#34D399' : isTie ? '#EFF2FF' : '#4A5772' }}
      >
        {formatValue(value1)}
      </div>
      <div className="w-20 text-center text-[11px] text-[#4A5772] uppercase tracking-widest">{label}</div>
      <div
        className="flex-1 text-left pl-4 text-lg font-bold tabular-nums"
        style={{ color: p2Wins ? '#34D399' : isTie ? '#EFF2FF' : '#4A5772' }}
      >
        {formatValue(value2)}
      </div>
    </div>
  );
}

// Rivalry card
function RivalryCard({
  matchup,
  index,
  onSelect,
}: {
  matchup: MatchupRecord;
  index: number;
  onSelect: (p1: string, p2: string) => void;
}) {
  const leader = matchup.player1Wins > matchup.player2Wins ? matchup.player1 :
                 matchup.player2Wins > matchup.player1Wins ? matchup.player2 : null;
  const isTied = matchup.player1Wins === matchup.player2Wins;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2 }}
      onClick={() => onSelect(matchup.player1.id, matchup.player2.id)}
      className="p-4 rounded-lg cursor-pointer"
      style={{
        background: '#0F1829',
        border: `1px solid ${leader ? 'rgba(240,180,41,0.15)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Swords size={14} color="#F0B429" />
          <span className="text-xs text-[#4A5772] uppercase tracking-widest">Rivalry</span>
        </div>
        <div className="text-xs text-[#4A5772]">{matchup.games.length} games</div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <div
            className="w-10 h-10 rounded-lg mx-auto flex items-center justify-center text-sm font-bold mb-1"
            style={{
              background: matchup.player1Wins > matchup.player2Wins ? 'rgba(240,180,41,0.15)' : '#162035',
              color: matchup.player1Wins > matchup.player2Wins ? '#F0B429' : '#8A9BBB'
            }}
          >
            {matchup.player1.name[0]}
          </div>
          <div className="text-xs font-medium text-[#EFF2FF]">{matchup.player1.name}</div>
        </div>

        <div className="px-4 text-center">
          <div className="font-display font-bold text-2xl text-[#EFF2FF] tabular-nums">
            {matchup.player1Wins} – {matchup.player2Wins}
          </div>
          {!isTied && leader && (
            <div className="text-[10px] text-[#F0B429] mt-1">{leader.name} leads</div>
          )}
          {isTied && matchup.games.length > 0 && (
            <div className="text-[10px] text-[#4A5772] mt-1">Tied</div>
          )}
        </div>

        <div className="flex-1 text-center">
          <div
            className="w-10 h-10 rounded-lg mx-auto flex items-center justify-center text-sm font-bold mb-1"
            style={{
              background: matchup.player2Wins > matchup.player1Wins ? 'rgba(240,180,41,0.15)' : '#162035',
              color: matchup.player2Wins > matchup.player1Wins ? '#F0B429' : '#8A9BBB'
            }}
          >
            {matchup.player2.name[0]}
          </div>
          <div className="text-xs font-medium text-[#EFF2FF]">{matchup.player2.name}</div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 mt-3 text-xs text-[#60A5FA]">
        View details <ChevronRight size={12} />
      </div>
    </motion.div>
  );
}

// Player selector
function PlayerSelector({
  players,
  selected,
  onChange,
  exclude,
}: {
  players: Player[];
  selected: string | null;
  onChange: (id: string) => void;
  exclude?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const selectedPlayer = players.find((p) => p.id === selected);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-3 rounded-lg w-full"
        style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {selectedPlayer ? (
          <>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: '#162035', color: '#8A9BBB' }}
            >
              {selectedPlayer.name[0]}
            </div>
            <span className="flex-1 text-left text-sm font-medium text-[#EFF2FF]">
              {selectedPlayer.name}
            </span>
          </>
        ) : (
          <span className="flex-1 text-left text-sm text-[#4A5772]">Select player</span>
        )}
        <ChevronDown size={16} color="#4A5772" />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 rounded-lg overflow-hidden z-50"
          style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {players
            .filter((p) => p.id !== exclude)
            .map((player) => (
              <button
                key={player.id}
                onClick={() => {
                  onChange(player.id);
                  setOpen(false);
                }}
                className="flex items-center gap-2 w-full p-3 hover:bg-white/5 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background: '#0F1829', color: '#8A9BBB' }}
                >
                  {player.name[0]}
                </div>
                <span className="text-sm font-medium text-[#EFF2FF]">{player.name}</span>
              </button>
            ))}
        </motion.div>
      )}
    </div>
  );
}

function HeadToHeadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [h2hGames, setH2hGames] = useState<Game[]>([]);
  const [matchups, setMatchups] = useState<MatchupRecord[]>([]);
  const [player1Id, setPlayer1Id] = useState<string | null>(searchParams.get('p1'));
  const [player2Id, setPlayer2Id] = useState<string | null>(searchParams.get('p2'));
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'records' | 'stats'>('records');

  useEffect(() => {
    async function loadData() {
      const [playersRes, atBatsRes, gamesRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('at_bats').select('*'),
        supabase.from('games').select('*').eq('game_mode', '1v1').eq('status', 'completed'),
      ]);

      const playerData = playersRes.data || [];
      const gameData = gamesRes.data || [];

      setPlayers(playerData);
      setAtBats(atBatsRes.data || []);
      setH2hGames(gameData);

      // Build matchup records
      const matchupMap = new Map<string, MatchupRecord>();

      gameData.forEach((game) => {
        if (!game.h2h_player1_id || !game.h2h_player2_id) return;

        // Create consistent key (smaller ID first)
        const ids = [game.h2h_player1_id, game.h2h_player2_id].sort();
        const key = `${ids[0]}-${ids[1]}`;

        const p1 = playerData.find(p => p.id === ids[0]);
        const p2 = playerData.find(p => p.id === ids[1]);

        if (!p1 || !p2) return;

        if (!matchupMap.has(key)) {
          matchupMap.set(key, {
            player1: p1,
            player2: p2,
            player1Wins: 0,
            player2Wins: 0,
            games: [],
          });
        }

        const record = matchupMap.get(key)!;
        record.games.push(game);

        if (game.h2h_winner_id === ids[0]) {
          record.player1Wins++;
        } else if (game.h2h_winner_id === ids[1]) {
          record.player2Wins++;
        }
      });

      setMatchups(Array.from(matchupMap.values()));

      // Set defaults if not provided
      if (!player1Id && playerData.length > 0) {
        setPlayer1Id(playerData[0].id);
      }
      if (!player2Id && playerData.length > 1) {
        setPlayer2Id(playerData[1].id);
      }

      setLoading(false);
    }
    loadData();
  }, []);

  const handleSelectMatchup = (p1: string, p2: string) => {
    setPlayer1Id(p1);
    setPlayer2Id(p2);
    setTab('stats');
  };

  // Calculate stats for a player FROM ONLY their H2H games against the other player
  const getPlayerStats = (playerId: string, opponentId: string) => {
    // Find all 1v1 games between these two players
    const matchupGames = h2hGames.filter((game) => {
      const players = [game.h2h_player1_id, game.h2h_player2_id];
      return players.includes(playerId) && players.includes(opponentId);
    });

    // Get game IDs
    const matchupGameIds = new Set(matchupGames.map((g) => g.id));

    // Filter at-bats to only include those from matchup games for this player
    const playerAtBats = atBats.filter(
      (ab) => ab.player_id === playerId && matchupGameIds.has(ab.game_id)
    );

    const singles = playerAtBats.filter((ab) => ab.result === 'single').length;
    const doubles = playerAtBats.filter((ab) => ab.result === 'double').length;
    const triples = playerAtBats.filter((ab) => ab.result === 'triple').length;
    const homeruns = playerAtBats.filter((ab) => ab.result === 'homerun').length;
    const walks = playerAtBats.filter((ab) => ab.result === 'walk').length;
    const strikeouts = playerAtBats.filter((ab) => ab.result === 'strikeout').length;
    const outs = playerAtBats.filter((ab) => ab.result === 'out').length;
    const rbi = playerAtBats.reduce((sum, ab) => sum + (ab.rbi || 0), 0);

    const hits = singles + doubles + triples + homeruns;
    const ab = hits + strikeouts + outs;
    const pa = ab + walks;
    const avg = ab > 0 ? hits / ab : 0;
    const slg = ab > 0 ? (singles + doubles * 2 + triples * 3 + homeruns * 4) / ab : 0;
    const obp = ab + walks > 0 ? (hits + walks) / (ab + walks) : 0;
    const ops = obp + slg;
    const kPercent = pa > 0 ? (strikeouts / pa) * 100 : 0;

    return {
      games: matchupGames.length,
      ab,
      hits,
      singles,
      doubles,
      triples,
      homeruns,
      rbi,
      walks,
      strikeouts,
      avg,
      obp,
      slg,
      ops,
      kPercent,
    };
  };

  // Get H2H record for selected players
  const getSelectedMatchup = () => {
    if (!player1Id || !player2Id) return null;
    const ids = [player1Id, player2Id].sort();
    return matchups.find(m =>
      m.player1.id === ids[0] && m.player2.id === ids[1]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

  const player1 = players.find((p) => p.id === player1Id);
  const player2 = players.find((p) => p.id === player2Id);
  // Only calculate stats if both players are selected (to filter by their matchup)
  const stats1 = player1Id && player2Id ? getPlayerStats(player1Id, player2Id) : null;
  const stats2 = player1Id && player2Id ? getPlayerStats(player2Id, player1Id) : null;
  const selectedMatchup = getSelectedMatchup();

  // Count advantages
  const countAdvantages = () => {
    if (!stats1 || !stats2) return { p1: 0, p2: 0 };
    let p1 = 0;
    let p2 = 0;

    if (stats1.avg > stats2.avg) p1++;
    else if (stats2.avg > stats1.avg) p2++;

    if (stats1.ops > stats2.ops) p1++;
    else if (stats2.ops > stats1.ops) p2++;

    if (stats1.homeruns > stats2.homeruns) p1++;
    else if (stats2.homeruns > stats1.homeruns) p2++;

    if (stats1.rbi > stats2.rbi) p1++;
    else if (stats2.rbi > stats1.rbi) p2++;

    if (stats1.kPercent < stats2.kPercent) p1++;
    else if (stats2.kPercent < stats1.kPercent) p2++;

    return { p1, p2 };
  };

  const advantages = countAdvantages();
  const winner =
    advantages.p1 > advantages.p2 ? player1 : advantages.p2 > advantages.p1 ? player2 : null;

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
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">HEAD-TO-HEAD</h1>
          <div className="text-xs text-[#4A5772]">1v1 Rivalry Records</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        {/* Tab switcher */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex gap-2 p-1 rounded-lg"
          style={{ background: '#0F1829' }}
        >
          <button
            onClick={() => setTab('records')}
            className="flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors"
            style={{
              background: tab === 'records' ? '#162035' : 'transparent',
              color: tab === 'records' ? '#EFF2FF' : '#4A5772',
            }}
          >
            Rivalry Records
          </button>
          <button
            onClick={() => setTab('stats')}
            className="flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors"
            style={{
              background: tab === 'stats' ? '#162035' : 'transparent',
              color: tab === 'stats' ? '#EFF2FF' : '#4A5772',
            }}
          >
            Stat Comparison
          </button>
        </motion.div>

        {/* Records tab */}
        {tab === 'records' && (
          <>
            {matchups.length > 0 ? (
              <div className="space-y-3">
                {matchups.map((matchup, i) => (
                  <RivalryCard
                    key={`${matchup.player1.id}-${matchup.player2.id}`}
                    matchup={matchup}
                    index={i + 1}
                    onSelect={handleSelectMatchup}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                custom={1}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="text-center py-12 rounded-lg"
                style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <Swords size={32} color="#4A5772" className="mx-auto mb-3" />
                <div className="text-[#4A5772] text-sm mb-1">No 1v1 games yet</div>
                <div className="text-[#4A5772] text-xs">Play some head-to-head games to build rivalries</div>
              </motion.div>
            )}
          </>
        )}

        {/* Stats tab */}
        {tab === 'stats' && (
          <>
            {/* Player selectors */}
            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="flex gap-4">
              <div className="flex-1">
                <PlayerSelector
                  players={players}
                  selected={player1Id}
                  onChange={setPlayer1Id}
                  exclude={player2Id}
                />
              </div>
              <div className="flex items-center">
                <ArrowLeftRight size={20} color="#4A5772" />
              </div>
              <div className="flex-1">
                <PlayerSelector
                  players={players}
                  selected={player2Id}
                  onChange={setPlayer2Id}
                  exclude={player1Id}
                />
              </div>
            </motion.div>

            {/* H2H record callout */}
            {selectedMatchup && (
              <motion.div
                custom={2}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="flex items-center justify-center gap-4 p-4 rounded-lg"
                style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)' }}
              >
                <Swords size={18} color="#F0B429" />
                <div className="text-center">
                  <div className="font-display font-bold text-xl text-[#EFF2FF]">
                    {selectedMatchup.player1.id === player1Id ? selectedMatchup.player1Wins : selectedMatchup.player2Wins}
                    {' – '}
                    {selectedMatchup.player1.id === player1Id ? selectedMatchup.player2Wins : selectedMatchup.player1Wins}
                  </div>
                  <div className="text-xs text-[#F0B429]">1v1 Record ({selectedMatchup.games.length} games)</div>
                </div>
              </motion.div>
            )}

            {/* Winner callout */}
            {winner && stats1 && stats2 && (
              <motion.div
                custom={3}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="flex items-center justify-center gap-3 p-4 rounded-lg"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
              >
                <Trophy size={18} color="#34D399" />
                <span className="text-sm font-semibold text-[#34D399]">
                  {winner.name} leads stats {advantages.p1 > advantages.p2 ? advantages.p1 : advantages.p2}-
                  {advantages.p1 > advantages.p2 ? advantages.p2 : advantages.p1}
                </span>
              </motion.div>
            )}

            {/* No stats message */}
            {stats1 && stats2 && stats1.ab === 0 && stats2.ab === 0 && selectedMatchup && selectedMatchup.games.length > 0 && (
              <motion.div
                custom={3.5}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="text-center py-6 rounded-lg"
                style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="text-[#4A5772] text-sm mb-1">No batting stats recorded yet</div>
                <div className="text-[#4A5772] text-xs">Log games with "Full Stats" mode to track H2H batting</div>
              </motion.div>
            )}

            {/* Stats comparison */}
            {stats1 && stats2 && (stats1.ab > 0 || stats2.ab > 0) && (
              <motion.div
                custom={4}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="rounded-lg overflow-hidden"
                style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {/* Player headers */}
                <div className="flex items-center p-4 border-b border-white/5">
                  <div className="flex-1 text-center">
                    <div
                      className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-lg font-bold mb-2"
                      style={{ background: '#162035', color: '#8A9BBB' }}
                    >
                      {player1?.name[0]}
                    </div>
                    <div className="text-sm font-semibold text-[#EFF2FF]">{player1?.name}</div>
                    <div className="text-xs text-[#4A5772]">{stats1.games} H2H games</div>
                  </div>
                  <div className="px-4">
                    <div className="text-[11px] text-[#4A5772] uppercase tracking-widest">VS</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div
                      className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-lg font-bold mb-2"
                      style={{ background: '#162035', color: '#8A9BBB' }}
                    >
                      {player2?.name[0]}
                    </div>
                    <div className="text-sm font-semibold text-[#EFF2FF]">{player2?.name}</div>
                    <div className="text-xs text-[#4A5772]">{stats2.games} H2H games</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="p-4">
                  <div className="text-[10px] text-[#4A5772] uppercase tracking-widest mb-2 text-center">
                    H2H Batting Stats
                  </div>
                  <StatRow label="AVG" value1={stats1.avg} value2={stats2.avg} format="avg" />
                  <StatRow label="OPS" value1={stats1.ops} value2={stats2.ops} />
                  <StatRow label="OBP" value1={stats1.obp} value2={stats2.obp} />
                  <StatRow label="SLG" value1={stats1.slg} value2={stats2.slg} />
                  <StatRow label="HR" value1={stats1.homeruns} value2={stats2.homeruns} />
                  <StatRow label="RBI" value1={stats1.rbi} value2={stats2.rbi} />
                  <StatRow label="H" value1={stats1.hits} value2={stats2.hits} />
                  <StatRow label="2B" value1={stats1.doubles} value2={stats2.doubles} />
                  <StatRow label="3B" value1={stats1.triples} value2={stats2.triples} />
                  <StatRow label="BB" value1={stats1.walks} value2={stats2.walks} />
                  <StatRow
                    label="K%"
                    value1={stats1.kPercent}
                    value2={stats2.kPercent}
                    higherIsBetter={false}
                    format="percent"
                  />
                </div>
              </motion.div>
            )}

            {(!player1Id || !player2Id) && (
              <div
                className="text-center py-12 rounded-lg"
                style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <ArrowLeftRight size={32} color="#4A5772" className="mx-auto mb-3" />
                <div className="text-[#4A5772] text-sm">Select two players to compare</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HeadToHead() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}><div className="text-[#4A5772]">Loading...</div></div>}>
      <HeadToHeadContent />
    </Suspense>
  );
}
