'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Trash2, Plus, X, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Player, Game, GamePlayer, AtBat, AtBatResult } from '@/lib/types';

const AT_BAT_OPTIONS: { value: AtBatResult; label: string; color: string }[] = [
  { value: 'single', label: 'Single', color: '#22C55E' },
  { value: 'double', label: 'Double', color: '#3B82F6' },
  { value: 'triple', label: 'Triple', color: '#A855F7' },
  { value: 'homerun', label: 'Homerun', color: '#F97316' },
  { value: 'strikeout', label: 'Strikeout', color: '#EF4444' },
  { value: 'out', label: 'Out', color: '#6B7280' },
  { value: 'double_play', label: 'Double Play', color: '#6B7280' },
  { value: 'error', label: 'Error', color: '#8B5CF6' },
  { value: 'walk', label: 'Walk', color: '#F0B429' },
];

export default function EditGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<(GamePlayer & { player: Player })[]>([]);
  const [atBats, setAtBats] = useState<AtBat[]>([]);
  const [pitchingStats, setPitchingStats] = useState<Record<string, { id?: string; outs: number; k: number; bb: number; h: number; er: number }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Score editing
  const [scoreResult, setScoreResult] = useState<'W' | 'L' | 'T'>('W');
  const [ourScore, setOurScore] = useState('');
  const [theirScore, setTheirScore] = useState('');
  const [innings, setInnings] = useState('');

  // At-bat editing
  const [editingAtBat, setEditingAtBat] = useState<string | null>(null);
  const [showAddAtBat, setShowAddAtBat] = useState(false);
  const [newAtBatPlayer, setNewAtBatPlayer] = useState<string>('');
  const [newAtBatResult, setNewAtBatResult] = useState<AtBatResult>('single');
  const [newAtBatRbi, setNewAtBatRbi] = useState(0);

  useEffect(() => {
    async function loadGame() {
      const { data: gameData } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (!gameData) {
        router.push('/');
        return;
      }

      setGame(gameData);

      // Parse score
      if (gameData.score) {
        const match = gameData.score.match(/^([WLT])\s+(\d+)-(\d+)$/);
        if (match) {
          setScoreResult(match[1] as 'W' | 'L' | 'T');
          setOurScore(match[2]);
          setTheirScore(match[3]);
        }
      }
      setInnings(gameData.innings?.toString() || '9');

      const { data: gamePlayersData } = await supabase
        .from('game_players')
        .select('*, player:players(*)')
        .eq('game_id', gameId)
        .order('batting_order');

      setGamePlayers(gamePlayersData || []);
      if (gamePlayersData?.length) {
        setNewAtBatPlayer(gamePlayersData[0].player_id);
      }

      const { data: atBatsData } = await supabase
        .from('at_bats')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at');

      setAtBats(atBatsData || []);

      // Load pitching stats
      if (gameData.track_pitching) {
        const { data: pitchingData } = await supabase
          .from('pitching_stats')
          .select('*')
          .eq('game_id', gameId);

        const stats: Record<string, { id?: string; outs: number; k: number; bb: number; h: number; er: number }> = {};
        pitchingData?.forEach((ps: { id: string; player_id: string; outs_recorded: number; strikeouts: number; walks: number; hits_allowed: number; earned_runs: number }) => {
          stats[ps.player_id] = {
            id: ps.id,
            outs: ps.outs_recorded,
            k: ps.strikeouts,
            bb: ps.walks,
            h: ps.hits_allowed,
            er: ps.earned_runs,
          };
        });
        setPitchingStats(stats);
      }

      setLoading(false);
    }

    loadGame();
  }, [gameId, router]);

  const saveGame = async () => {
    if (saving || !game) return;
    setSaving(true);

    try {
      // Update game score/innings
      const score = `${scoreResult} ${ourScore}-${theirScore}`;
      await supabase
        .from('games')
        .update({ score, innings: parseInt(innings) || 9 })
        .eq('id', gameId);

      // Update pitching stats
      if (game.track_pitching) {
        for (const [playerId, stats] of Object.entries(pitchingStats)) {
          if (stats.id) {
            await supabase
              .from('pitching_stats')
              .update({
                outs_recorded: stats.outs,
                strikeouts: stats.k,
                walks: stats.bb,
                hits_allowed: stats.h,
                earned_runs: stats.er,
              })
              .eq('id', stats.id);
          }
        }
      }

      router.push(`/recap/${gameId}`);
    } catch (error) {
      console.error('Error saving game:', error);
      alert('Failed to save changes');
      setSaving(false);
    }
  };

  const deleteAtBat = async (atBatId: string) => {
    await supabase.from('at_bats').delete().eq('id', atBatId);
    setAtBats(prev => prev.filter(ab => ab.id !== atBatId));
  };

  const updateAtBat = async (atBatId: string, result: AtBatResult, rbi: number) => {
    await supabase
      .from('at_bats')
      .update({ result, rbi })
      .eq('id', atBatId);
    setAtBats(prev => prev.map(ab => ab.id === atBatId ? { ...ab, result, rbi } : ab));
    setEditingAtBat(null);
  };

  const addAtBat = async () => {
    if (!newAtBatPlayer) return;

    const { data: newAtBat } = await supabase
      .from('at_bats')
      .insert({
        game_id: gameId,
        player_id: newAtBatPlayer,
        inning: game?.current_inning || 1,
        result: newAtBatResult,
        rbi: newAtBatRbi,
      })
      .select()
      .single();

    if (newAtBat) {
      setAtBats(prev => [...prev, newAtBat]);
    }

    setShowAddAtBat(false);
    setNewAtBatResult('single');
    setNewAtBatRbi(0);
  };

  const updatePitchingStat = (playerId: string, field: 'outs' | 'k' | 'bb' | 'h' | 'er', value: number) => {
    setPitchingStats(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: Math.max(0, value),
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D18' }}>
        <div className="text-[#4A5772]">Loading...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4" style={{ background: '#080D18' }}>
        <p className="text-[#4A5772]">Game not found</p>
        <Link href="/" className="text-[#60A5FA] hover:underline">Go home</Link>
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
        <Link href={`/recap/${gameId}`}>
          <motion.div whileTap={{ scale: 0.95 }} className="p-2 -m-2">
            <ArrowLeft size={20} color="#8A9BBB" />
          </motion.div>
        </Link>
        <div className="flex-1">
          <h1 className="font-display font-bold text-lg text-[#EFF2FF]">EDIT GAME</h1>
          <div className="text-xs text-[#4A5772]">{game.date}</div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={saveGame}
          disabled={saving}
          className="px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
          style={{ background: '#22C55E', color: '#080D18' }}
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save'}
        </motion.button>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        {/* Score Editor */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h3 className="text-sm font-semibold text-[#F0B429] uppercase tracking-wider mb-4">
            Final Score
          </h3>

          {/* Result selector */}
          <div className="flex gap-2 mb-4">
            {(['W', 'L', 'T'] as const).map((r) => (
              <motion.button
                key={r}
                whileTap={{ scale: 0.95 }}
                onClick={() => setScoreResult(r)}
                className="flex-1 py-2 rounded-lg font-bold text-sm"
                style={{
                  background: scoreResult === r
                    ? r === 'W' ? '#22C55E' : r === 'L' ? '#EF4444' : '#6B7280'
                    : '#162035',
                  color: scoreResult === r ? '#080D18' : '#8A9BBB',
                  border: `1px solid ${scoreResult === r ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Tie'}
              </motion.button>
            ))}
          </div>

          {/* Score inputs */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-[#4A5772] uppercase tracking-wide block mb-1">Us</label>
              <input
                type="number"
                min="0"
                value={ourScore}
                onChange={(e) => setOurScore(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-center text-xl font-bold text-[#EFF2FF]"
                style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <div>
              <label className="text-[10px] text-[#4A5772] uppercase tracking-wide block mb-1">Them</label>
              <input
                type="number"
                min="0"
                value={theirScore}
                onChange={(e) => setTheirScore(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-center text-xl font-bold text-[#EFF2FF]"
                style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <div>
              <label className="text-[10px] text-[#4A5772] uppercase tracking-wide block mb-1">Innings</label>
              <input
                type="number"
                min="1"
                value={innings}
                onChange={(e) => setInnings(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-center text-xl font-bold text-[#EFF2FF]"
                style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          </div>
        </div>

        {/* At-Bats Editor */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#60A5FA] uppercase tracking-wider">
              At-Bats ({atBats.length})
            </h3>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddAtBat(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
              style={{ background: 'rgba(96,165,250,0.15)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.3)' }}
            >
              <Plus size={14} />
              Add
            </motion.button>
          </div>

          {/* Add At-Bat Form */}
          {showAddAtBat && (
            <div
              className="rounded-lg p-4 mb-4"
              style={{ background: '#162035', border: '1px solid rgba(96,165,250,0.3)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-[#EFF2FF]">New At-Bat</span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowAddAtBat(false)}>
                  <X size={16} color="#8A9BBB" />
                </motion.button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[10px] text-[#4A5772] uppercase block mb-1">Player</label>
                  <select
                    value={newAtBatPlayer}
                    onChange={(e) => setNewAtBatPlayer(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg text-sm text-[#EFF2FF]"
                    style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {gamePlayers.map((gp) => (
                      <option key={gp.player_id} value={gp.player_id}>{gp.player.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#4A5772] uppercase block mb-1">Result</label>
                  <select
                    value={newAtBatResult}
                    onChange={(e) => setNewAtBatResult(e.target.value as AtBatResult)}
                    className="w-full px-2 py-2 rounded-lg text-sm text-[#EFF2FF]"
                    style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {AT_BAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#4A5772] uppercase block mb-1">RBI</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={newAtBatRbi}
                    onChange={(e) => setNewAtBatRbi(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-2 rounded-lg text-sm text-center text-[#EFF2FF]"
                    style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={addAtBat}
                className="w-full py-2 rounded-lg font-semibold text-sm"
                style={{ background: '#22C55E', color: '#080D18' }}
              >
                Add At-Bat
              </motion.button>
            </div>
          )}

          {/* At-Bats List */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {atBats.map((ab, idx) => {
              const player = gamePlayers.find((gp) => gp.player_id === ab.player_id);
              const resultInfo = AT_BAT_OPTIONS.find((opt) => opt.value === ab.result);
              const isEditing = editingAtBat === ab.id;

              return (
                <div
                  key={ab.id}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: '#162035', border: isEditing ? '1px solid #60A5FA' : '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span className="text-xs text-[#4A5772] w-6">{idx + 1}</span>
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                    style={{ background: '#0F1829', color: '#8A9BBB' }}
                  >
                    {player?.player.name[0] || '?'}
                  </div>

                  {isEditing ? (
                    <EditAtBatRow
                      ab={ab}
                      onSave={(result, rbi) => updateAtBat(ab.id, result, rbi)}
                      onCancel={() => setEditingAtBat(null)}
                    />
                  ) : (
                    <>
                      <div className="flex-1">
                        <span className="text-sm text-[#EFF2FF]">{player?.player.name}</span>
                        <span className="text-sm ml-2" style={{ color: resultInfo?.color || '#8A9BBB' }}>
                          {resultInfo?.label || ab.result}
                        </span>
                        {ab.rbi > 0 && (
                          <span className="text-xs text-[#4A5772] ml-2">({ab.rbi} RBI)</span>
                        )}
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setEditingAtBat(ab.id)}
                        className="p-1.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        <ChevronDown size={14} color="#8A9BBB" />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => deleteAtBat(ab.id)}
                        className="p-1.5 rounded"
                        style={{ background: 'rgba(239,68,68,0.1)' }}
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </motion.button>
                    </>
                  )}
                </div>
              );
            })}
            {atBats.length === 0 && (
              <div className="text-center text-sm text-[#4A5772] py-4">No at-bats recorded</div>
            )}
          </div>
        </div>

        {/* Pitching Stats Editor */}
        {game.track_pitching && (
          <div
            className="rounded-xl p-5"
            style={{ background: '#0F1829', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <h3 className="text-sm font-semibold text-[#EF4444] uppercase tracking-wider mb-4">
              Pitching Stats
            </h3>

            <div className="space-y-4">
              {gamePlayers.map((gp) => {
                const stats = pitchingStats[gp.player_id] || { outs: 0, k: 0, bb: 0, h: 0, er: 0 };

                return (
                  <div key={`pitch-edit-${gp.player_id}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
                      >
                        {gp.player.name[0]}
                      </div>
                      <span className="text-sm font-medium text-[#EFF2FF]">{gp.player.name}</span>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { key: 'outs', label: 'Outs' },
                        { key: 'k', label: 'K' },
                        { key: 'bb', label: 'BB' },
                        { key: 'h', label: 'H' },
                        { key: 'er', label: 'ER' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-[9px] text-[#4A5772] uppercase block mb-1 text-center">{label}</label>
                          <input
                            type="number"
                            min="0"
                            value={stats[key as keyof typeof stats] || 0}
                            onChange={(e) => updatePitchingStat(gp.player_id, key as 'outs' | 'k' | 'bb' | 'h' | 'er', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 rounded text-center text-sm font-medium text-[#EFF2FF]"
                            style={{ background: '#162035', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Save Button (bottom) */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={saveGame}
          disabled={saving}
          className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
          style={{ background: '#22C55E', color: '#080D18' }}
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Changes'}
        </motion.button>
      </div>
    </div>
  );
}

// Inline edit component for at-bats
function EditAtBatRow({
  ab,
  onSave,
  onCancel,
}: {
  ab: AtBat;
  onSave: (result: AtBatResult, rbi: number) => void;
  onCancel: () => void;
}) {
  const [result, setResult] = useState<AtBatResult>(ab.result);
  const [rbi, setRbi] = useState(ab.rbi);

  return (
    <div className="flex-1 flex items-center gap-2">
      <select
        value={result}
        onChange={(e) => setResult(e.target.value as AtBatResult)}
        className="flex-1 px-2 py-1.5 rounded text-sm text-[#EFF2FF]"
        style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {AT_BAT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <input
        type="number"
        min="0"
        max="4"
        value={rbi}
        onChange={(e) => setRbi(parseInt(e.target.value) || 0)}
        className="w-14 px-2 py-1.5 rounded text-sm text-center text-[#EFF2FF]"
        style={{ background: '#0F1829', border: '1px solid rgba(255,255,255,0.1)' }}
      />
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onSave(result, rbi)}
        className="px-2 py-1.5 rounded text-xs font-semibold"
        style={{ background: '#22C55E', color: '#080D18' }}
      >
        Save
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onCancel}
        className="px-2 py-1.5 rounded text-xs font-semibold"
        style={{ background: '#374151', color: '#8A9BBB' }}
      >
        Cancel
      </motion.button>
    </div>
  );
}
