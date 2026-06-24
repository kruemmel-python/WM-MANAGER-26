import React, { useState } from 'react';
import { GameState, Team, Match, NewsItem } from '../types';
import { GAME_CALENDAR } from '../utils/tournamentEngine';
import { xorNumber } from '../utils/cryptoLedger';

interface DashboardProps {
  gameState: GameState;
  userTeam: Team;
  nextMatch: Match | undefined;
  onNavigate: (screen: string) => void;
  onAdvanceDay: (trainingFocus: string) => void;
  onResetGame: () => void;
  onStartMatch: (matchId: string) => void;
  onStartFriendlyMatch: (opponentId: string) => void;
}

export default function Dashboard({
  gameState,
  userTeam,
  nextMatch,
  onNavigate,
  onAdvanceDay,
  onResetGame,
  onStartMatch,
  onStartFriendlyMatch
}: DashboardProps) {
  const [trainingFocus, setTrainingFocus] = useState<string>('kondition');
  const otherTeams = gameState.teams.filter(t => t.id !== userTeam.id).sort((a, b) => a.name.localeCompare(b.name));
  const [selectedOpponent, setSelectedOpponent] = useState<string>(otherTeams[0]?.id || '');
  
  const currentCalendarDay = GAME_CALENDAR[gameState.currentDayIndex];
  
  const formattedBudget = (xorNumber(userTeam.budget_xor) / 1000000).toFixed(1);
  const teamOvr = Math.round(
    userTeam.players.reduce((sum, p) => sum + p.overall, 0) / userTeam.players.length
  );

  const getTeamNameById = (id: string) => {
    const t = gameState.teams.find(team => team.id === id);
    return t ? `${t.flag} ${t.name}` : id;
  };

  return (
    <div className="screen-content">
      {/* Header Info */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="flex-row-between">
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Tag {gameState.currentDayIndex} of 16 • {gameState.stage === 'group_stage' ? 'Gruppenphase' : 'K.o.-Runde'}
            </span>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--accent-gold)' }}>{gameState.currentDate}</h1>
          </div>
          <button 
            onClick={onResetGame}
            style={{ 
              background: 'transparent', 
              border: '1px solid var(--border-glass)', 
              color: 'var(--accent-red)', 
              borderRadius: '8px', 
              padding: '4px 8px', 
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Neustart 🔄
          </button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TEAM</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-green)' }}>{userTeam.flag} {userTeam.name}</div>
          </div>
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>STÄRKE</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{teamOvr} OVR</div>
          </div>
          <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BUDGET</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{formattedBudget}M €</div>
          </div>
        </div>
      </div>

      {/* Main Office Action Block */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '4px solid var(--accent-green)' }}>
        <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📅</span> {currentCalendarDay.label}
        </h2>

        {nextMatch ? (
          /* Match Day Card */
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-glass)' }}>
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 700 }}>
              Nächstes Spiel ({nextMatch.stage})
            </div>
            <div className="flex-row-between" style={{ padding: '8px 0' }}>
              <div style={{ width: '40%', textAlign: 'center' }}>
                <span style={{ fontSize: '2.5rem', display: 'block' }}>
                  {gameState.teams.find(t => t.id === nextMatch.homeTeamId)?.flag}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {gameState.teams.find(t => t.id === nextMatch.homeTeamId)?.name}
                </span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                VS
              </div>
              <div style={{ width: '40%', textAlign: 'center' }}>
                <span style={{ fontSize: '2.5rem', display: 'block' }}>
                  {gameState.teams.find(t => t.id === nextMatch.awayTeamId)?.flag}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {gameState.teams.find(t => t.id === nextMatch.awayTeamId)?.name}
                </span>
              </div>
            </div>
            
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                className="btn-primary" 
                onClick={() => onStartMatch(nextMatch.id)}
                style={{ width: '100%' }}
              >
                Spiel live simulieren ⚽
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => onNavigate('lineup')}
                style={{ width: '100%' }}
              >
                Aufstellung & Taktik prüfen 📋
              </button>
            </div>
          </div>
        ) : (
          /* Training Day Card */
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Wählen Sie den Schwerpunkt für die heutige Trainingseinheit:
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              {[
                { id: 'kondition', label: 'Kondition 🔋' },
                { id: 'torschuss', label: 'Torschuss 🎯' },
                { id: 'abwehr', label: 'Abwehr 🛡️' },
                { id: 'passspiel', label: 'Passspiel 🔄' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setTrainingFocus(item.id)}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: trainingFocus === item.id ? '2px solid var(--accent-green)' : '1px solid var(--border-glass)',
                    backgroundColor: trainingFocus === item.id ? 'var(--accent-green-glow)' : 'var(--bg-panel)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            
            <button 
              className="btn-primary" 
              onClick={() => onAdvanceDay(trainingFocus)}
              style={{ width: '100%' }}
            >
              Tag beenden & Training starten ⏱️
            </button>
          </div>
        )}

        {/* If no user match today but it's a match day (user is eliminated, or it's a rest day for group) */}
        {!nextMatch && currentCalendarDay.type === 'matchday' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Ihr Team hat heute kein Spiel. Sie können die anderen Spiele simulieren.
            </p>
            <button 
              className="btn-primary" 
              onClick={() => onAdvanceDay('rest')}
              style={{ width: '100%' }}
            >
              Turnierspiele simulieren & Tag beenden ⏭️
            </button>
          </div>
        )}
      </div>

      {/* Friendly Match scheduler panel */}
      {!nextMatch && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--accent-gold)' }}>🤝 Freundschaftsspiel vereinbaren</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Nutze die spielfreie Zeit, um deine Taktik gegen andere WM-Teilnehmer zu testen.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <select
              value={selectedOpponent}
              onChange={(e) => setSelectedOpponent(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-panel)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-glass)',
                borderRadius: '10px',
                padding: '10px',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              {otherTeams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.flag} {t.name}
                </option>
              ))}
            </select>
            <button
              className="btn-primary"
              onClick={() => {
                if (selectedOpponent) {
                  onStartFriendlyMatch(selectedOpponent);
                }
              }}
              style={{ padding: '10px 14px', fontSize: '0.85rem' }}
            >
              Starten ⚽
            </button>
          </div>
        </div>
      )}

      {/* News Feed Panel */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '180px' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--accent-gold)' }}>📰 News & Schlagzeilen</h2>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
          {gameState.news.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '20px' }}>
              Keine aktuellen Nachrichten vorliegend.
            </div>
          ) : (
            gameState.news.map(news => (
              <div 
                key={news.id} 
                style={{ 
                  padding: '10px', 
                  borderRadius: '10px', 
                  backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                  borderLeft: `3px solid ${
                    news.type === 'transfer' ? 'var(--accent-gold)' :
                    news.type === 'injury' ? 'var(--accent-red)' :
                    news.type === 'match' ? 'var(--accent-blue)' :
                    'var(--text-muted)'
                  }`,
                  fontSize: '0.8rem'
                }}
              >
                <div className="flex-row-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{news.title}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{news.date}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', lineHeight: '1.3' }}>{news.content}</div>
              </div>
            ))
          )}
      </div>
    </div>
      {/* Developer & Copyright Info */}
      <div className="glass-panel" style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '10px', marginTop: '4px' }}>
        <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>⚽ WM-Manager 26</p>
        <p>Entwickler & Rechteinhaber: <b>Ralf Krümmel</b></p>
        <p style={{ fontSize: '0.65rem', marginTop: '4px', opacity: 0.6 }}>© 2026 • Alle Rechte vorbehalten</p>
      </div>
    </div>
  );
}
