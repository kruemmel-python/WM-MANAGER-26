import React, { useState } from 'react';
import { Team, Player } from '../types';

interface RosterProps {
  userTeam: Team;
  onNavigate: (screen: string) => void;
}

type SortField = 'ovr' | 'pos' | 'fitness' | 'goals';

export default function Roster({ userTeam, onNavigate }: RosterProps) {
  const [sortBy, setSortBy] = useState<SortField>('ovr');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Sorting helper
  const sortedPlayers = [...userTeam.players].sort((a, b) => {
    if (sortBy === 'ovr') return b.overall - a.overall;
    if (sortBy === 'fitness') return b.fitness - a.fitness;
    if (sortBy === 'goals') return b.goals - a.goals;
    
    // Position sort order: TW, ABW, MF, ANG
    if (sortBy === 'pos') {
      const posWeights = { TW: 4, ABW: 3, MF: 2, ANG: 1 };
      return posWeights[b.position] - posWeights[a.position];
    }
    return 0;
  });

  const getPositionLabel = (pos: string) => {
    switch (pos) {
      case 'TW': return 'Torwart';
      case 'ABW': return 'Abwehr';
      case 'MF': return 'Mittelfeld';
      case 'ANG': return 'Angriff';
      default: return pos;
    }
  };

  return (
    <div className="screen-content">
      {/* Roster Header */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="flex-row-between">
          <h1 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>🏃 Spielerkader ({userTeam.players.length} Spieler)</h1>
        </div>

        {/* Sort pills */}
        <div className="tabs-container">
          {[
            { id: 'ovr', label: 'Stärke ⭐' },
            { id: 'pos', label: 'Position 📍' },
            { id: 'fitness', label: 'Fitness 🔋' },
            { id: 'goals', label: 'Tore ⚽' }
          ].map(pill => (
            <button
              key={pill.id}
              onClick={() => setSortBy(pill.id as SortField)}
              className={`tab-pill ${sortBy === pill.id ? 'active' : ''}`}
              style={{ flex: 1, padding: '4px 10px', fontSize: '0.75rem' }}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Players list */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {sortedPlayers.map(p => {
          const isActive = userTeam.lineup.includes(p.id);

          return (
            <div
              key={p.id}
              className="list-item clickable"
              onClick={() => setSelectedPlayer(p)}
              style={{
                cursor: 'pointer',
                backgroundColor: isActive ? 'rgba(34, 197, 94, 0.03)' : 'transparent',
                padding: '12px 16px',
                borderLeft: isActive ? '3px solid var(--accent-green)' : '3px solid transparent'
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span className="player-position-tag" style={{
                  backgroundColor: p.position === 'TW' ? 'rgba(234, 179, 8, 0.15)' :
                                   p.position === 'ABW' ? 'rgba(59, 130, 246, 0.15)' :
                                   p.position === 'MF' ? 'rgba(34, 197, 94, 0.15)' :
                                   'rgba(239, 68, 68, 0.15)',
                  color: p.position === 'TW' ? 'var(--accent-gold)' :
                         p.position === 'ABW' ? 'var(--accent-blue)' :
                         p.position === 'MF' ? 'var(--accent-green)' :
                         'var(--accent-red)'
                }}>
                  {p.position}
                </span>
                <div>
                  <div style={{ fontWeight: 600, color: p.injuryWeeks > 0 ? 'var(--accent-red)' : 'var(--text-main)', fontSize: '0.9rem' }}>
                    {p.name} {p.injuryWeeks > 0 && `(Verletzt ${p.injuryWeeks} W.)`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Alter: {p.age} • Fit: {p.fitness}% • Form: {p.form}%
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {p.goals > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-gold)', backgroundColor: 'rgba(234,179,8,0.1)', padding: '2px 6px', borderRadius: '6px' }}>
                    ⚽ {p.goals}
                  </span>
                )}
                <div className={`player-ovr-badge ${p.overall >= 85 ? 'high' : p.overall >= 75 ? 'med' : 'low'}`}>
                  {p.overall}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Player Detail Modal drawer */}
      {selectedPlayer && (
        <div className="modal-overlay" onClick={() => setSelectedPlayer(null)}>
          <div className="modal-drawer" onClick={e => e.stopPropagation()}>
            <div className="flex-row-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              <div>
                <span className="player-position-tag" style={{ marginRight: '8px' }}>
                  {selectedPlayer.position}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {getPositionLabel(selectedPlayer.position)}
                </span>
                <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginTop: '4px' }}>
                  {selectedPlayer.name}
                </h2>
              </div>
              <div className="player-ovr-badge high" style={{ width: '48px', height: '48px', borderRadius: '12px', fontSize: '1.3rem' }}>
                {selectedPlayer.overall}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Core attributes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>ALTER</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedPlayer.age} Jahre</span>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>MARKTWERT</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-gold)' }}>
                    {(selectedPlayer.value / 1000000).toFixed(2)} Mio. €
                  </span>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>FITNESS</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: selectedPlayer.fitness < 70 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {selectedPlayer.fitness}%
                  </span>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>FORM</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{selectedPlayer.form}%</span>
                </div>
              </div>

              {/* Skill Bars */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-glass)' }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', marginBottom: '10px' }}>FÄHIGKEITEN</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Torschuss 🎯', val: selectedPlayer.skills.shooting },
                    { label: 'Passspiel 🔄', val: selectedPlayer.skills.passing },
                    { label: 'Verteidigung 🛡️', val: selectedPlayer.skills.defending },
                    { label: 'Physis / Kondition 💪', val: selectedPlayer.skills.physical },
                    { label: 'Torwartspiel 🧤', val: selectedPlayer.skills.goalkeeping }
                  ].map((skill, index) => (
                    <div key={index}>
                      <div className="flex-row-between" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>
                        <span>{skill.label}</span>
                        <span style={{ fontWeight: 700 }}>{skill.val}</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${skill.val}%`, 
                          height: '100%', 
                          backgroundColor: skill.val >= 85 ? 'var(--accent-gold)' : skill.val >= 75 ? 'var(--accent-green)' : 'var(--text-muted)',
                          borderRadius: '3px'
                        }}></div>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', marginTop: '14px', marginBottom: '10px' }}>METABOLISMUS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'ATP-CP (Explosivkraft) ⚡', val: Math.round(selectedPlayer.atp ?? 100) },
                    { label: 'Glykogen (Ausdauer) 🔋', val: Math.round(selectedPlayer.glycogen ?? 100) },
                    { label: 'Aerobe Kapazität (Regeneration) 💨', val: Math.round(selectedPlayer.aerobic ?? selectedPlayer.skills.physical) }
                  ].map((bio, index) => (
                    <div key={index}>
                      <div className="flex-row-between" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>
                        <span>{bio.label}</span>
                        <span style={{ fontWeight: 700 }}>{bio.val}%</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${bio.val}%`, 
                          height: '100%', 
                          backgroundColor: bio.val >= 75 ? 'var(--accent-green)' : bio.val >= 35 ? 'var(--accent-gold)' : 'var(--accent-red)',
                          borderRadius: '3px'
                        }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats & Actions */}
              <div className="flex-row-between" style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>STATISTIKEN</span>
                  <span>⚽ {selectedPlayer.goals} Tore • 🟨 {selectedPlayer.yellowCards} • 🟥 {selectedPlayer.redCards}</span>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => setSelectedPlayer(null)}
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
