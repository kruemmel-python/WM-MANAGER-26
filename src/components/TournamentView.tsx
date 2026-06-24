import React, { useState } from 'react';
import { GameState, Team, GroupStanding, Match } from '../types';
import { calculateGroupStandings } from '../utils/tournamentEngine';

interface TournamentViewProps {
  gameState: GameState;
  userTeam: Team;
  onNavigate: (screen: string) => void;
  selectedTeam: Team | null;
  setSelectedTeam: (team: Team | null) => void;
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function TournamentView({
  gameState,
  userTeam,
  onNavigate,
  selectedTeam,
  setSelectedTeam
}: TournamentViewProps) {
  const [activeView, setActiveView] = useState<'tables' | 'bracket'>('tables');
  const [activeGroup, setActiveGroup] = useState<string>('A');

  const getTeamNameById = (id: string) => {
    const t = gameState.teams.find(team => team.id === id);
    return t ? `${t.flag} ${t.name}` : id;
  };

  const getTeamFlagById = (id: string) => {
    const t = gameState.teams.find(team => team.id === id);
    return t ? t.flag : '⚪';
  };

  // Group standlings for active group
  const standings = calculateGroupStandings(activeGroup, gameState.matches, gameState.teams);

  // Group knockout matches
  const knockoutStages: { stage: Match['stage']; label: string }[] = [
    { stage: 'Achtelfinale', label: 'Achtelfinale' },
    { stage: 'Viertelfinale', label: 'Viertelfinale' },
    { stage: 'Halbfinale', label: 'Halbfinale' },
    { stage: 'Spiel um Platz 3', label: 'Spiel um Platz 3' },
    { stage: 'Finale', label: 'Finale' }
  ];

  return (
    <div className="screen-content">
      {/* Header Tabs */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="flex-row-between">
          <h1 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>🏆 WM-Turnierbaum</h1>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveView('tables')}
            className={`tab-pill ${activeView === 'tables' ? 'active' : ''}`}
            style={{ flex: 1 }}
          >
            Tabellen 📊
          </button>
          <button
            onClick={() => setActiveView('bracket')}
            className={`tab-pill ${activeView === 'bracket' ? 'active' : ''}`}
            style={{ flex: 1 }}
          >
            K.o.-Phase 🌳
          </button>
        </div>
      </div>

      {activeView === 'tables' ? (
        /* TABLES VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Group A-H Pills */}
          <div className="glass-panel" style={{ padding: '8px' }}>
            <div className="tabs-container" style={{ justifyContent: 'space-between' }}>
              {GROUPS.map(g => (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  className={`tab-pill ${activeGroup === g ? 'active' : ''}`}
                  style={{ padding: '6px 10px', fontSize: '0.75rem', minWidth: '40px', textAlign: 'center' }}
                >
                  Gr. {g}
                </button>
              ))}
            </div>
          </div>

          {/* Standings Table */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-glass)', display: 'flex', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              <div style={{ width: '8%' }}>#</div>
              <div style={{ width: '42%' }}>TEAM</div>
              <div style={{ width: '10%', textAlign: 'center' }}>SP</div>
              <div style={{ width: '12%', textAlign: 'center' }}>TORE</div>
              <div style={{ width: '13%', textAlign: 'center' }}>DIFF</div>
              <div style={{ width: '15%', textAlign: 'center' }}>PKT</div>
            </div>

            {standings.map((row, idx) => {
              const isQualified = idx < 2; // top 2 qualify
              const isUserTeam = row.teamId === userTeam.id;

              return (
                <div 
                  key={row.teamId}
                  className="clickable"
                  onClick={() => {
                    const team = gameState.teams.find(t => t.id === row.teamId);
                    if (team) setSelectedTeam(team);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                    borderBottom: '1px solid var(--border-glass)',
                    backgroundColor: isUserTeam ? 'rgba(34, 197, 94, 0.04)' : 'transparent',
                    borderLeft: isQualified ? '3px solid var(--accent-green)' : '3px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ width: '8%', fontWeight: 700, color: isQualified ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    {idx + 1}
                  </div>
                  <div style={{ width: '42%', fontWeight: isUserTeam ? 700 : 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{row.flag}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.teamName}</span>
                  </div>
                  <div style={{ width: '10%', textAlign: 'center', color: 'var(--text-muted)' }}>{row.played}</div>
                  <div style={{ width: '12%', textAlign: 'center', fontSize: '0.75rem' }}>{row.goalsFor}:{row.goalsAgainst}</div>
                  <div style={{ width: '13%', textAlign: 'center', fontWeight: 600, color: (row.goalsFor - row.goalsAgainst) > 0 ? 'var(--accent-green)' : (row.goalsFor - row.goalsAgainst) < 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                    {row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}{row.goalsFor - row.goalsAgainst}
                  </div>
                  <div style={{ width: '15%', textAlign: 'center', fontWeight: 800, color: isQualified ? 'var(--accent-green)' : 'var(--text-main)' }}>
                    {row.points}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-panel">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              * Tippen Sie auf ein Team, um dessen Kader und Spielerwerte zu inspizieren.
            </span>
          </div>
        </div>
      ) : (
        /* BRACKET VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {knockoutStages.map(stageObj => {
            const stageMatches = gameState.matches.filter(m => m.stage === stageObj.stage);

            if (stageMatches.length === 0) return null;

            return (
              <div key={stageObj.stage} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h2 style={{ fontSize: '0.95rem', color: 'var(--accent-gold)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                  {stageObj.label}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stageMatches.map(m => {
                    const homeTeamRef = gameState.teams.find(t => t.id === m.homeTeamId);
                    const awayTeamRef = gameState.teams.find(t => t.id === m.awayTeamId);

                    const isHomeWinner = m.played && m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore;
                    const isAwayWinner = m.played && m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore;

                    return (
                      <div 
                        key={m.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.03)',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '70%' }}>
                          {/* Home team */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: isHomeWinner ? 700 : 400, opacity: m.played && !isHomeWinner ? 0.6 : 1 }}>
                            <span>{homeTeamRef?.flag}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeTeamRef?.name}</span>
                          </div>
                          {/* Away team */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: isAwayWinner ? 700 : 400, opacity: m.played && !isAwayWinner ? 0.6 : 1 }}>
                            <span>{awayTeamRef?.flag}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayTeamRef?.name}</span>
                          </div>
                        </div>

                        {/* Scores */}
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '4px' }}>
                          <span style={{ color: isHomeWinner ? 'var(--accent-green)' : 'var(--text-main)' }}>
                            {m.played ? m.homeScore : '-'}
                          </span>
                          <span style={{ color: isAwayWinner ? 'var(--accent-green)' : 'var(--text-main)' }}>
                            {m.played ? m.awayScore : '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team Details / Scouting Drawer Modal */}
      {selectedTeam && (
        <div className="modal-overlay" onClick={() => setSelectedTeam(null)}>
          <div className="modal-drawer" onClick={e => e.stopPropagation()}>
            <div className="flex-row-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)' }}>
                  {selectedTeam.flag} {selectedTeam.name}
                </h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kaderscouting</span>
              </div>
              <button 
                onClick={() => setSelectedTeam(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {selectedTeam.players
                .sort((a, b) => b.overall - a.overall)
                .map(p => (
                  <div 
                    key={p.id}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '8px 12px', 
                      backgroundColor: 'rgba(255,255,255,0.01)', 
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="player-position-tag" style={{ fontSize: '0.6rem' }}>{p.position}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({p.age} J.)</span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                        {(p.value/1000000).toFixed(1)}M €
                      </span>
                      <div className={`player-ovr-badge ${p.overall >= 80 ? 'high' : 'med'}`} style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>
                        {p.overall}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <button 
              className="btn-secondary" 
              onClick={() => setSelectedTeam(null)}
              style={{ width: '100%', marginTop: '16px' }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
