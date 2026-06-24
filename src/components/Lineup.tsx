import React, { useState } from 'react';
import { Team, Player, TeamTactics, PlayerPosition } from '../types';

interface LineupProps {
  userTeam: Team;
  onUpdateLineup: (lineup: string[]) => void;
  onUpdateTactics: (tactics: Team['tactics']) => void;
  onNavigate: (screen: string) => void;
}

export default function Lineup({
  userTeam,
  onUpdateLineup,
  onUpdateTactics,
  onNavigate
}: LineupProps) {
  const [activeTab, setActiveTab] = useState<'lineup' | 'tactics'>('lineup');
  const [selectedPitchSlot, setSelectedPitchSlot] = useState<number | null>(null); // Index in active lineup (0-10)

  // Get active 11 players and reserves
  const activePlayers = userTeam.players.filter(p => userTeam.lineup.includes(p.id));
  const reservePlayers = userTeam.players.filter(p => !userTeam.lineup.includes(p.id));

  // Determine positions on the pitch depending on formation
  // returns { x, y } in percentage
  const getCoordinates = (index: number, formation: TeamTactics['formation']) => {
    // index 0 is always TW (GK)
    if (index === 0) return { x: 50, y: 88 };

    switch (formation) {
      case '4-4-2':
        // Defenders (1-4)
        if (index === 1) return { x: 15, y: 70 }; // LV
        if (index === 2) return { x: 38, y: 72 }; // IV L
        if (index === 3) return { x: 62, y: 72 }; // IV R
        if (index === 4) return { x: 85, y: 70 }; // RV
        // Midfielders (5-8)
        if (index === 5) return { x: 15, y: 44 }; // LM
        if (index === 6) return { x: 38, y: 46 }; // ZM L
        if (index === 7) return { x: 62, y: 46 }; // ZM R
        if (index === 8) return { x: 85, y: 44 }; // RM
        // Forwards (9-10)
        if (index === 9) return { x: 33, y: 20 }; // ST L
        if (index === 10) return { x: 67, y: 20 }; // ST R
        break;

      case '4-3-3':
        // Defenders (1-4)
        if (index === 1) return { x: 15, y: 70 };
        if (index === 2) return { x: 38, y: 72 };
        if (index === 3) return { x: 62, y: 72 };
        if (index === 4) return { x: 85, y: 70 };
        // Midfielders (5-7)
        if (index === 5) return { x: 25, y: 46 }; // ZM L
        if (index === 6) return { x: 50, y: 53 }; // DM
        if (index === 7) return { x: 75, y: 46 }; // ZM R
        // Forwards (8-10)
        if (index === 8) return { x: 20, y: 22 }; // LF
        if (index === 9) return { x: 50, y: 18 }; // ST
        if (index === 10) return { x: 80, y: 22 }; // RF
        break;

      case '3-5-2':
        // Defenders (1-3)
        if (index === 1) return { x: 25, y: 72 }; // IV L
        if (index === 2) return { x: 50, y: 74 }; // IV C
        if (index === 3) return { x: 75, y: 72 }; // IV R
        // Midfielders (4-8)
        if (index === 4) return { x: 12, y: 46 }; // LM
        if (index === 5) return { x: 35, y: 48 }; // ZM L
        if (index === 6) return { x: 50, y: 54 }; // DM
        if (index === 7) return { x: 65, y: 48 }; // ZM R
        if (index === 8) return { x: 88, y: 46 }; // RM
        // Forwards (9-10)
        if (index === 9) return { x: 33, y: 20 };
        if (index === 10) return { x: 67, y: 20 };
        break;

      case '4-2-3-1':
        // Defenders (1-4)
        if (index === 1) return { x: 15, y: 70 };
        if (index === 2) return { x: 38, y: 72 };
        if (index === 3) return { x: 62, y: 72 };
        if (index === 4) return { x: 85, y: 70 };
        // Defensive Mid (5-6)
        if (index === 5) return { x: 35, y: 52 }; // DM L
        if (index === 6) return { x: 65, y: 52 }; // DM R
        // Attacking Mid (7-9)
        if (index === 7) return { x: 20, y: 35 }; // OM L
        if (index === 8) return { x: 50, y: 32 }; // OM C
        if (index === 9) return { x: 80, y: 35 }; // OM R
        // Forward (10)
        if (index === 10) return { x: 50, y: 17 }; // ST
        break;

      case '5-3-2':
        // Defenders (1-5)
        if (index === 1) return { x: 12, y: 68 }; // LWB
        if (index === 2) return { x: 32, y: 72 }; // IV L
        if (index === 3) return { x: 50, y: 74 }; // IV C
        if (index === 4) return { x: 68, y: 72 }; // IV R
        if (index === 5) return { x: 88, y: 68 }; // RWB
        // Midfielders (6-8)
        if (index === 6) return { x: 28, y: 46 }; // ZM L
        if (index === 7) return { x: 50, y: 48 }; // ZM C
        if (index === 8) return { x: 72, y: 46 }; // ZM R
        // Forwards (9-10)
        if (index === 9) return { x: 33, y: 20 };
        if (index === 10) return { x: 67, y: 20 };
        break;
    }
    return { x: 50, y: 50 };
  };

  // Perform substitution
  const handleSwapPlayer = (reservePlayerId: string) => {
    if (selectedPitchSlot === null) return;
    
    const newLineup = [...userTeam.lineup];
    const outgoingPlayerId = newLineup[selectedPitchSlot];
    
    // Replace the slot with new player
    newLineup[selectedPitchSlot] = reservePlayerId;
    
    onUpdateLineup(newLineup);
    setSelectedPitchSlot(null);
  };

  const handleUpdateFormation = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const formation = e.target.value as TeamTactics['formation'];
    onUpdateTactics({
      ...userTeam.tactics,
      formation
    });
  };

  const handleUpdateStyle = (style: TeamTactics['style']) => {
    onUpdateTactics({
      ...userTeam.tactics,
      style
    });
  };

  const handleUpdatePassing = (passing: TeamTactics['passing']) => {
    onUpdateTactics({
      ...userTeam.tactics,
      passing
    });
  };

  return (
    <div className="screen-content">
      {/* Header and Pill Navigation */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '10px' }}>
        <div className="flex-row-between">
          <h1 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>📋 Teamverwaltung</h1>
          <select 
            value={userTeam.tactics.formation}
            onChange={handleUpdateFormation}
            style={{ 
              backgroundColor: 'var(--bg-panel)', 
              color: 'var(--text-main)', 
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              padding: '4px 8px',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            <option value="4-4-2">4-4-2</option>
            <option value="4-3-3">4-3-3</option>
            <option value="3-5-2">3-5-2</option>
            <option value="4-2-3-1">4-2-3-1</option>
            <option value="5-3-2">5-3-2</option>
          </select>
        </div>

        <div className="tabs-container">
          <button 
            className={`tab-pill ${activeTab === 'lineup' ? 'active' : ''}`}
            onClick={() => setActiveTab('lineup')}
            style={{ flex: 1 }}
          >
            Aufstellung (11)
          </button>
          <button 
            className={`tab-pill ${activeTab === 'tactics' ? 'active' : ''}`}
            onClick={() => setActiveTab('tactics')}
            style={{ flex: 1 }}
          >
            Taktik & Mentalität
          </button>
        </div>
      </div>

      {activeTab === 'lineup' ? (
        /* Visual Lineup Pitch view */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="pitch-container">
            <div className="pitch-line pitch-center-line"></div>
            <div className="pitch-line pitch-center-circle"></div>
            <div className="pitch-line pitch-penalty-box-top"></div>
            <div className="pitch-line pitch-penalty-box-bottom"></div>

            {/* Render 11 players on pitch based on coordinates */}
            {userTeam.lineup.map((id, index) => {
              const player = userTeam.players.find(p => p.id === id);
              if (!player) return null;
              const coords = getCoordinates(index, userTeam.tactics.formation);

              return (
                <div 
                  key={id}
                  className="pitch-player"
                  onClick={() => setSelectedPitchSlot(index)}
                  style={{
                    left: `${coords.x}%`,
                    top: `${coords.y}%`
                  }}
                >
                  <div 
                    className="pitch-player-shirt" 
                    style={{ 
                      border: selectedPitchSlot === index ? '2px solid var(--accent-gold)' : '2px solid white',
                      boxShadow: selectedPitchSlot === index ? '0 0 10px var(--accent-gold)' : 'none'
                    }}
                  >
                    {player.overall}
                  </div>
                  <div className="pitch-player-name">{player.name.split(' ').pop()}</div>
                  <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                    {player.position}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-panel">
            <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              * Tippe einen Spieler auf dem Feld an, um ihn auszuwechseln.
            </h3>
          </div>
        </div>
      ) : (
        /* Tactics Editor view */
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Style */}
          <div>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>Ausrichtung / Spielstil</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { id: 'defensiv', label: 'Defensiv 🛡️' },
                { id: 'konter', label: 'Kontern ⚡' },
                { id: 'ausgeglichen', label: 'Ausgeglichen ⚖️' },
                { id: 'ballbesitz', label: 'Ballbesitz ⚽' },
                { id: 'offensiv', label: 'Offensiv 🔥' },
                { id: 'brechstange', label: 'Brechstange 🔨' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => handleUpdateStyle(item.id as TeamTactics['style'])}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: userTeam.tactics.style === item.id ? '2px solid var(--accent-green)' : '1px solid var(--border-glass)',
                    backgroundColor: userTeam.tactics.style === item.id ? 'var(--accent-green-glow)' : 'var(--bg-panel)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Passing */}
          <div>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>Passspiel</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'kurz', label: 'Kurzpass' },
                { id: 'lang', label: 'Lange Bälle' },
                { id: 'gemischt', label: 'Gemischt' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => handleUpdatePassing(item.id as TeamTactics['passing'])}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: userTeam.tactics.passing === item.id ? '2px solid var(--accent-green)' : '1px solid var(--border-glass)',
                    backgroundColor: userTeam.tactics.passing === item.id ? 'var(--accent-green-glow)' : 'var(--bg-panel)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aggression */}
          <div>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>
              Aggressivität (Zweikämpfe)
            </h3>
            <div className="flex-row-between" style={{ marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Zahm</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-red)' }}>
                {userTeam.tactics.aggression === 1 && 'Sehr Vorsichtig'}
                {userTeam.tactics.aggression === 2 && 'Vorsichtig'}
                {userTeam.tactics.aggression === 3 && 'Normal'}
                {userTeam.tactics.aggression === 4 && 'Hart'}
                {userTeam.tactics.aggression === 5 && 'Bissig (Gelb-Risiko!)'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Brutal</span>
            </div>
            <input 
              type="range"
              min="1"
              max="5"
              value={userTeam.tactics.aggression}
              onChange={(e) => onUpdateTactics({
                ...userTeam.tactics,
                aggression: parseInt(e.target.value)
              })}
              style={{
                width: '100%',
                accentColor: 'var(--accent-green)'
              }}
            />
          </div>
        </div>
      )}

      {/* Substitute drawer overlay */}
      {selectedPitchSlot !== null && (
        <div className="modal-overlay" onClick={() => setSelectedPitchSlot(null)}>
          <div className="modal-drawer" onClick={e => e.stopPropagation()}>
            <div className="flex-row-between" style={{ marginBottom: '16px' }}>
              <h3>
                Auswechseln für: <span style={{ color: 'var(--accent-gold)' }}>
                  {activePlayers[selectedPitchSlot]?.name} ({activePlayers[selectedPitchSlot]?.position})
                </span>
              </h3>
              <button 
                onClick={() => setSelectedPitchSlot(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reservePlayers.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '10px' }}>
                  Keine Auswechselspieler auf der Bank!
                </div>
              ) : (
                reservePlayers.map(p => (
                  <div 
                    key={p.id}
                    className="list-item clickable"
                    onClick={() => handleSwapPlayer(p.id)}
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.02)', 
                      borderRadius: '10px', 
                      padding: '10px',
                      cursor: 'pointer',
                      border: p.injuryWeeks > 0 ? '1px dashed var(--accent-red)' : '1px solid var(--border-glass)'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span className="player-position-tag">{p.position}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: p.injuryWeeks > 0 ? 'var(--accent-red)' : 'var(--text-main)', fontSize: '0.85rem' }}>
                          {p.name} {p.injuryWeeks > 0 && `(Verletzt - ${p.injuryWeeks} W.)`}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Alter: {p.age} • Fit: {p.fitness}% • Form: {p.form}%
                        </div>
                      </div>
                    </div>
                    <div className={`player-ovr-badge ${p.overall >= 80 ? 'high' : 'med'}`}>
                      {p.overall}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
