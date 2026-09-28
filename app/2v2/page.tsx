'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Trophy } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, AtBat, Game, GamePlayer } from '@/lib/types';
import { formatAvg } from '@/lib/stats';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' as const },
  }),
};

interface DuoRecord {
  key: string;
  names: string;
  wins: number;
  losses: number;
  ties: number;
  games: number;
}

interface PlayerLine {
  player: Player;
  games: number;
  ab: number;
  h: number;
  hr: number;
  rbi: number;
  avg: number;
  ops: number;
  wins: number;
  losses: number;
  // pitching
  ip: number;
  era: number;
  k: number;
}

type PitchingRow = {
  player_id: string;
  game_id: string;
  outs_recorded: number;
  strikeouts: number;
  walks: number;
  hits_allowed: number;
  earned_runs: number;
};

export default function TwoVTwoPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<(Game & { game_players: GamePlayer[] })[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [pitching, setPitching] = useState<PitchingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'duos' | 'batting' | 'pitching'>('duos');

  useEffect(() => {
    async function load() {
      const [playersRes, gamesRes, pitchingRes] = await Promise.all([
        supabase.from('players').select('*'),
        supabase
          .from('games')
          .select('*, game_players(*)')
          .eq('game_mode', '2v2_teams')
          .eq('status', 'completed')
          .limit(1000),
        supabase.from('pitching_stats').select('*'),
      ]);

      const gamesData = (gamesRes.data || []) as (Game & { game_players: GamePlayer[] })[];
      const gameIds = new Set(gamesData.map((g) => g.id));

      let allAtBats: AtBat[] = [];
      let offset = 0;
      while (true) {
        const { data: batch } = await supabase.from('at_bats').select('*').range(offset, offset + 999);
        if (!batch || batch.length === 0) break;
        allAtBats = [...allAtBats, ...batch];
        if (batch.length < 1000) break;
        offset += 1000;
      }

      setPlayers(playersRes.data || []);
      setGames(gamesData);
      setAtBats(allAtBats.filter((ab) => gameIds.has(ab.game_id)));
      setPitching(((pitchingRes.data || []) as PitchingRow[]).filter((p) => gameIds.has(p.game_id)));
      setLoading(false);
    }
    load();
  }, []);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name || '?';

  // --- Duo records ---
  const duoMap: Record<string, DuoRecord> = {};
  for (const g of games) {
    const t1 = g.game_players.filter((gp) => gp.team === 1).map((gp) => gp.player_id);
    const t2 = g.game_players.filter((gp) => gp.team === 2).map((gp) => gp.player_id);
    if (t1.length < 2 || t2.length < 2) continue;
    const duos: { ids: string[]; team: number }[] = [
      { ids: [...t1].sort(), team: 1 },
      { ids: [...t2].sort(), team: 2 },
    ];
    for (const d of duos) {
      const key = d.ids.join('|');
      if (!duoMap[key]) {
        duoMap[key] = { key, names: d.ids.map(nameOf).join(' + '), wins: 0, losses: 0, ties: 0, games: 0 };
      }
      duoMap[key].games += 1;
      if (g.winning_team == null) duoMap[key].ties += 1;
      else if (g.winning_team === d.team) duoMap[key].wins += 1;
      else duoMap[key].losses += 1;
    }
  }
  const duoRecords = Object.values(duoMap).sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || b.games - a.games
  );

  // --- Player lines (2v2 only) ---
  const teamInGame = (playerId: string, g: Game & { game_players: GamePlayer[] }) =>
    g.game_players.find((gp) => gp.player_id === playerId)?.team ?? null;

  const playerLines: PlayerLine[] = players
    .map((player) => {
      const pAtBats = atBats.filter((ab) => ab.player_id === player.id);
      const singles = pAtBats.filter((ab) => ab.result === 'single').length;
      const doubles = pAtBats.filter((ab) => ab.result === 'double').length;
      const triples = pAtBats.filter((ab) => ab.result === 'triple').length;
      const hr = pAtBats.filter((ab) => ab.result === 'homerun').length;
      const bb = pAtBats.filter((ab) => ab.result === 'walk').length;
      const k = pAtBats.filter((ab) => ab.result === 'strikeout').length;
      const outs = pAtBats.filter((ab) => ab.result === 'out' || ab.result === 'double_play').length;
      const errors = pAtBats.filter((ab) => ab.result === 'error').length;
      const hits = singles + doubles + triples + hr;
      const ab = hits + k + outs;
      const rbi = pAtBats.reduce((s, x) => s + (x.rbi || 0), 0);
      const avg = ab > 0 ? hits / ab : 0;
      const slg = ab > 0 ? (singles + doubles * 2 + triples * 3 + hr * 4) / ab : 0;
      const obp = ab + bb + errors > 0 ? (hits + bb) / (ab + bb + errors) : 0;

      const pGames = games.filter((g) => g.game_players.some((gp) => gp.player_id === player.id));
      let wins = 0;
      let losses = 0;
      for (const g of pGames) {
        const t = teamInGame(player.id, g);
        if (g.winning_team == null || t == null) continue;
        if (g.winning_team === t) wins += 1;
        else losses += 1;
      }

      const pPitch = pitching.filter((p) => p.player_id === player.id);
      const pitchOuts = pPitch.reduce((s, x) => s + (x.outs_recorded || 0), 0);
      const er = pPitch.reduce((s, x) => s + (x.earned_runs || 0), 0);
      const pk = pPitch.reduce((s, x) => s + (x.strikeouts || 0), 0);
      const ip = pitchOuts / 3;
      const era = ip > 0 ? (er * 9) / ip : 0;

      return {
        player,
        games: pGames.length,
        ab,
        h: hits,
        hr,
        rbi,
        avg,
        ops: obp + slg,
        wins,
        losses,
        ip,
        era,
        k: pk,
      };
    })
    .filter((l) => l.games > 0);

  const battingLeaders = [...playerLines].sort((a, b) => b.avg - a.avg);
  const pitchingLeaders = [...playerLines].filter((l) => l.ip > 0).sort((a, b) => a.era - b.era);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#080D18' }}>
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-5 py-4"
        style={{ background: 'rgba(8,13,24,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Link href="/">
          <motion.div whileTap={{ scale: 0.95 }} className="p-2 -m-2">
            <ArrowLeft size={20} color="#8A9BBB" />
          </motion.div>
        </Link>
        <div className="flex-1">
          <h1 className="font-display font-bold text-lg text-[#EFF2FF] flex items-center gap-2">
            <Users size={18} color="#F0B429" /> 2v2 TEAMS
          </h1>
          <div className="text-[11px] text-[#4A5772]">{games.length} team games logged</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-5">
        {/* Tabs */}
        <div className="flex gap-2">
          {(['duos', 'batting', 'pitching'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-colors"
              style={{
                background: tab === t ? '#F0B429' : 'rgba(255,255,255,0.05)',
                color: tab === t ? '#080D18' : '#8A9BBB',
                border: `1px solid ${tab === t ? '#F0B429' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {t === 'duos' ? 'Duo Records' : t}
            </button>
          ))}
        </div>

        {games.length === 0 && (
          <div className="text-center py-16 text-[#4A5772]">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No 2v2 Teams games yet.</p>
            <Link href="/log?mode=2v2_teams">
              <span className="text-[#60A5FA] text-sm">Start one →</span>
            </Link>
          </div>
        )}

        {/* Duo Records */}
        {tab === 'duos' && games.length > 0 && (
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="space-y-2">
            {duoRecords.map((d, i) => {
              const pct = d.games > 0 ? d.wins / (d.wins + d.losses || 1) : 0;
              return (
                <div
                  key={d.key}
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {i === 0 && <Trophy size={16} color="#F0B429" />}
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[#EFF2FF]">{d.names}</div>
                    <div className="text-[11px] text-[#4A5772]">{d.games} games together</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums">
                      <span className="text-[#34D399]">{d.wins}</span>
                      <span className="text-[#4A5772]">–</span>
                      <span className="text-[#F87171]">{d.losses}</span>
                      {d.ties > 0 && <span className="text-[#8A9BBB] text-sm">–{d.ties}T</span>}
                    </div>
                    <div className="text-[11px] text-[#8A9BBB]">{formatAvg(pct).replace(/^\./, '.')} win%</div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Batting leaders */}
        {tab === 'batting' && games.length > 0 && (
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="rounded-xl overflow-hidden" style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#4A5772]" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th className="text-left py-3 px-3">Player</th>
                  <th className="text-right py-3 px-2">W-L</th>
                  <th className="text-right py-3 px-2">AVG</th>
                  <th className="text-right py-3 px-2">HR</th>
                  <th className="text-right py-3 px-2">RBI</th>
                  <th className="text-right py-3 px-3">OPS</th>
                </tr>
              </thead>
              <tbody>
                {battingLeaders.map((l) => (
                  <tr key={l.player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-3 px-3 font-medium text-[#EFF2FF]">{l.player.name}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-[#8A9BBB]">{l.wins}-{l.losses}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-[#EFF2FF] font-semibold">{formatAvg(l.avg)}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-[#F0B429]">{l.hr}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-[#EFF2FF]">{l.rbi}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-[#8A9BBB]">{l.ops.toFixed(3).replace(/^0/, '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Pitching leaders */}
        {tab === 'pitching' && games.length > 0 && (
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="rounded-xl overflow-hidden" style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}>
            {pitchingLeaders.length === 0 ? (
              <div className="text-center py-10 text-[#4A5772] text-sm">No pitching logged in 2v2 games yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#4A5772]" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <th className="text-left py-3 px-3">Player</th>
                    <th className="text-right py-3 px-2">IP</th>
                    <th className="text-right py-3 px-2">K</th>
                    <th className="text-right py-3 px-3">ERA</th>
                  </tr>
                </thead>
                <tbody>
                  {pitchingLeaders.map((l) => (
                    <tr key={l.player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-3 px-3 font-medium text-[#EFF2FF]">{l.player.name}</td>
                      <td className="py-3 px-2 text-right tabular-nums text-[#8A9BBB]">{l.ip.toFixed(1)}</td>
                      <td className="py-3 px-2 text-right tabular-nums text-[#F87171]">{l.k}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#EFF2FF] font-semibold">{l.era.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="px-3 py-2 text-[10px] text-[#4A5772]" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              ERA counts runs driven in against each pitcher (2v2 approximation).
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
