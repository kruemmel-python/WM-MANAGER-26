import React, { useState, useEffect, useRef } from 'react';
import { GameState, Team, Player, Match, MatchEvent, TeamTactics } from '../types';
import { simulateSubstrateMatch } from '../utils/substrateEngine';

interface MatchViewProps {
  matchId: string;
  gameState: GameState;
  userTeam: Team;
  onFinishMatch: (homeScore: number, awayScore: number, events: MatchEvent[]) => void;
  onNavigate: (screen: string) => void;
}

export default function MatchView({
  matchId,
  gameState,
  userTeam,
  onFinishMatch,
  onNavigate
}: MatchViewProps) {
  const match = gameState.matches.find(m => m.id === matchId);
  if (!match) return <div style={{ color: 'var(--text-main)', padding: '20px' }}>Match nicht gefunden</div>;
  const isUserHome = match.homeTeamId === userTeam.id;

  const originalHomeTeam = gameState.teams.find(t => t.id === match.homeTeamId);
  const originalAwayTeam = gameState.teams.find(t => t.id === match.awayTeamId);

  if (!originalHomeTeam || !originalAwayTeam) {
    return <div style={{ color: 'var(--text-main)', padding: '20px' }}>Teams nicht gefunden</div>;
  }

  // Local state for the match simulation
  const [minute, setMinute] = useState<number>(0);
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(600); // ms per simulated minute
  const [redCardedIds, setRedCardedIds] = useState<string[]>([]);
  
  // Tactical & Lineup adjustments during the match
  const [localHomeTeam, setLocalHomeTeam] = useState<Team>(JSON.parse(JSON.stringify(originalHomeTeam)));
  const [localAwayTeam, setLocalAwayTeam] = useState<Team>(JSON.parse(JSON.stringify(originalAwayTeam)));
  
  // Modal states for substitutions / tactics
  const [showSubModal, setShowSubModal] = useState<boolean>(false);
  const [selectedSubSlot, setSelectedSubSlot] = useState<number | null>(null);
  const [injuryAlertPlayer, setInjuryAlertPlayer] = useState<Player | null>(null);

  const [preSimulatedMatch, setPreSimulatedMatch] = useState<Match | null>(null);

  const tickerEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<any>(null);

  // Initialize the deterministic substrate match simulation
  useEffect(() => {
    const simulated = simulateSubstrateMatch(localHomeTeam, localAwayTeam, match.stage, match.date, match.dayIndex);
    setPreSimulatedMatch(simulated);
  }, []);

  // Auto-scroll ticker to bottom when new events arrive
  useEffect(() => {
    tickerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const processedMinutesRef = useRef<Set<number>>(new Set());

  // Simulation timer loop
  useEffect(() => {
    if (isPlaying && minute < 90) {
      intervalRef.current = setInterval(() => {
        setMinute(prev => {
          const nextMin = prev + 1;
          if (nextMin >= 90) {
            setIsPlaying(false);
          }
          return nextMin;
        });
      }, simSpeed);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, simSpeed]);

  const reSimulateFromCurrentMinute = (updatedHome: Team, updatedAway: Team, currentEventsList: MatchEvent[]) => {
    const nextMin = minute + 1;
    const reSimulated = simulateSubstrateMatch(
      updatedHome,
      updatedAway,
      match.stage,
      match.date,
      match.dayIndex,
      nextMin,
      homeScore,
      awayScore,
      currentEventsList,
      redCardedIds
    );
    setPreSimulatedMatch(reSimulated);
  };

  const updatePlayerInjuryStatus = (playerId: string, weeks: number) => {
    if (isUserHome) {
      setLocalHomeTeam(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === playerId ? { ...p, injuryWeeks: weeks } : p)
      }));
    } else {
      setLocalAwayTeam(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === playerId ? { ...p, injuryWeeks: weeks } : p)
      }));
    }
  };

  // AI substitution helper for the opposing team
  const handleAISubstitution = (injuredId: string, min: number) => {
    const aiTeam = isUserHome ? localAwayTeam : localHomeTeam;
    const aiTeamSetter = isUserHome ? setLocalAwayTeam : setLocalHomeTeam;

    const injuredPlayer = aiTeam.players.find(p => p.id === injuredId);
    if (!injuredPlayer) return;

    aiTeamSetter(prev => {
      const updatedPlayers = prev.players.map(p => 
        p.id === injuredId ? { ...p, injuryWeeks: 2 } : p
      );
      const activeLineup = [...prev.lineup];
      const playerIndex = activeLineup.indexOf(injuredId);

      if (playerIndex !== -1) {
        // Find healthy backup on the bench
        const backup = updatedPlayers.find(p => 
          p.position === injuredPlayer.position && 
          !activeLineup.includes(p.id) && 
          p.injuryWeeks === 0 && 
          !redCardedIds.includes(p.id)
        );

        if (backup) {
          activeLineup[playerIndex] = backup.id;
          
          setEvents(eventsPrev => [...eventsPrev, {
            minute: min,
            type: 'text',
            description: `Wechsel bei ${prev.name}: ${backup.name} kommt für den verletzten ${injuredPlayer.name}.`
          }]);
        }
      }

      return {
        ...prev,
        players: updatedPlayers,
        lineup: activeLineup
      };
    });
  };

  // Process events when minute changes
  useEffect(() => {
    if (minute > 0 && minute <= 90 && preSimulatedMatch) {
      if (processedMinutesRef.current.has(minute)) {
        return;
      }
      processedMinutesRef.current.add(minute);

      // Find all events for the current minute
      const minEvents = preSimulatedMatch.events.filter(e => e.minute === minute);

      // Update scores and active cards/injuries based on minEvents
      minEvents.forEach(e => {
        if (e.type === 'goal') {
          if (e.teamId === localHomeTeam.id) {
            setHomeScore(s => s + 1);
          } else if (e.teamId === localAwayTeam.id) {
            setAwayScore(s => s + 1);
          }
        }

        if (e.type === 'red') {
          const homePlayer = localHomeTeam.players.find(p => p.name === e.playerName);
          if (homePlayer) setRedCardedIds(prev => [...prev, homePlayer.id]);

          const awayPlayer = localAwayTeam.players.find(p => p.name === e.playerName);
          if (awayPlayer) setRedCardedIds(prev => [...prev, awayPlayer.id]);
        }

        if (e.type === 'injury') {
          const homePlayer = localHomeTeam.players.find(p => p.name === e.playerName);
          if (homePlayer) {
            updatePlayerInjuryStatus(homePlayer.id, 2);
            const isUserInjured = isUserHome;
            if (isUserInjured) {
              setIsPlaying(false);
              setInjuryAlertPlayer(homePlayer);
            } else {
              handleAISubstitution(homePlayer.id, minute);
            }
          }

          const awayPlayer = localAwayTeam.players.find(p => p.name === e.playerName);
          if (awayPlayer) {
            updatePlayerInjuryStatus(awayPlayer.id, 2);
            const isUserInjured = !isUserHome;
            if (isUserInjured) {
              setIsPlaying(false);
              setInjuryAlertPlayer(awayPlayer);
            } else {
              handleAISubstitution(awayPlayer.id, minute);
            }
          }
        }
      });

      if (minEvents.length > 0) {
        setEvents(prev => [...prev, ...minEvents]);
      }
    }
  }, [minute, preSimulatedMatch, localHomeTeam.id, localAwayTeam.id, isUserHome, redCardedIds]);
  const handleInstantSimulation = () => {
    setIsPlaying(false);
    if (!preSimulatedMatch) return;
    
    // Mark all minutes as processed to avoid double processing in useEffect
    for (let m = 1; m <= 90; m++) {
      processedMinutesRef.current.add(m);
    }
    
    // Set all remaining events and scores instantly
    const finalHomeScore = preSimulatedMatch.homeScore ?? homeScore;
    const finalAwayScore = preSimulatedMatch.awayScore ?? awayScore;
    
    // Find all player IDs that got red carded in the pre-simulated match
    const finalRedCardedIds = [...redCardedIds];
    preSimulatedMatch.events.forEach(e => {
      if (e.type === 'red') {
        const homePlayer = localHomeTeam.players.find(p => p.name === e.playerName);
        if (homePlayer && !finalRedCardedIds.includes(homePlayer.id)) finalRedCardedIds.push(homePlayer.id);
        const awayPlayer = localAwayTeam.players.find(p => p.name === e.playerName);
        if (awayPlayer && !finalRedCardedIds.includes(awayPlayer.id)) finalRedCardedIds.push(awayPlayer.id);
      }
    });

    setMinute(90);
    setHomeScore(finalHomeScore);
    setAwayScore(finalAwayScore);
    setEvents(preSimulatedMatch.events);
    setRedCardedIds(finalRedCardedIds);
  };

  // Perform User substitution mid-game
  const handleUserSwapPlayer = (reservePlayerId: string) => {
    if (selectedSubSlot === null) return;
    
    const userTeamRef = isUserHome ? localHomeTeam : localAwayTeam;
    const teamSetter = isUserHome ? setLocalHomeTeam : setLocalAwayTeam;

    const newLineup = [...userTeamRef.lineup];
    const outgoingPlayer = userTeamRef.players.find(p => p.id === newLineup[selectedSubSlot]);
    const incomingPlayer = userTeamRef.players.find(p => p.id === reservePlayerId);

    if (outgoingPlayer && incomingPlayer) {
      newLineup[selectedSubSlot] = reservePlayerId;
      const updatedTeam = {
        ...userTeamRef,
        lineup: newLineup
      };
      
      // Update team state
      teamSetter(updatedTeam);

      // Log swap event
      const swapEvent: MatchEvent = {
        minute: minute || 1,
        type: 'text',
        description: `Wechsel bei ${userTeamRef.name}: ${incomingPlayer.name} kommt für ${outgoingPlayer.name}.`
      };
      const updatedEvents = [...events, swapEvent];
      setEvents(updatedEvents);

      reSimulateFromCurrentMinute(
        isUserHome ? updatedTeam : localHomeTeam,
        isUserHome ? localHomeTeam : updatedTeam,
        updatedEvents
      );
    }

    setSelectedSubSlot(null);
    setShowSubModal(false);
  };

  const handleUpdateUserTactics = (style: TeamTactics['style']) => {
    const teamSetter = isUserHome ? setLocalHomeTeam : setLocalAwayTeam;
    const updatedTeam = {
      ...activeUserTeam,
      tactics: {
        ...activeUserTeam.tactics,
        style
      }
    };
    teamSetter(updatedTeam);

    const tacticEvent: MatchEvent = {
      minute: minute || 1,
      type: 'text',
      description: `Trainer taktische Anpassung: ${userTeam.name} stellt auf "${style}" um.`
    };
    const updatedEvents = [...events, tacticEvent];
    setEvents(updatedEvents);

    reSimulateFromCurrentMinute(
      isUserHome ? updatedTeam : localHomeTeam,
      isUserHome ? localHomeTeam : updatedTeam,
      updatedEvents
    );
  };

  const activeUserTeam = isUserHome ? localHomeTeam : localAwayTeam;
  const activeOpponentTeam = isUserHome ? localAwayTeam : localHomeTeam;

  const activeLineupPlayers = activeUserTeam.players.filter(p => activeUserTeam.lineup.includes(p.id));
  const reserveBenchPlayers = activeUserTeam.players.filter(
    p => !activeUserTeam.lineup.includes(p.id) && p.injuryWeeks === 0 && !redCardedIds.includes(p.id)
  );

  return (
    <div className="screen-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Live scoreboard */}
      <div className="glass-panel" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
          {match.stage} Live
        </span>
        
        <div className="flex-row-between" style={{ padding: '4px 0' }}>
          <div style={{ width: '38%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>{originalHomeTeam.flag}</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
              {originalHomeTeam.name}
            </span>
          </div>
          
          <div style={{ width: '24%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent-gold)' }}>
              {homeScore} : {awayScore}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '10px' }}>
              {minute < 90 && isPlaying && <div className="simulating-indicator"></div>}
              <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                {minute === 90 ? 'ENDE' : `${minute}'`}
              </span>
            </div>
          </div>
          
          <div style={{ width: '38%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>{originalAwayTeam.flag}</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
              {originalAwayTeam.name}
            </span>
          </div>
        </div>
      </div>

      {/* Speed and controls */}
      <div className="glass-panel" style={{ padding: '8px 12px' }}>
        <div className="flex-row-between">
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              className="tab-pill" 
              onClick={() => setSimSpeed(800)}
              style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: simSpeed === 800 ? 'var(--accent-green-glow)' : 'var(--bg-panel)', borderColor: simSpeed === 800 ? 'var(--accent-green)' : 'var(--border-glass)' }}
            >
              1x ⏱️
            </button>
            <button 
              className="tab-pill" 
              onClick={() => setSimSpeed(300)}
              style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: simSpeed === 300 ? 'var(--accent-green-glow)' : 'var(--bg-panel)', borderColor: simSpeed === 300 ? 'var(--accent-green)' : 'var(--border-glass)' }}
            >
              2x ⚡
            </button>
            <button 
              className="tab-pill" 
              onClick={() => setSimSpeed(100)}
              style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: simSpeed === 100 ? 'var(--accent-green-glow)' : 'var(--bg-panel)', borderColor: simSpeed === 100 ? 'var(--accent-green)' : 'var(--border-glass)' }}
            >
              5x 🚀
            </button>
          </div>

          {minute < 90 && (
            <button
              onClick={handleInstantSimulation}
              style={{
                fontSize: '0.7rem',
                padding: '4px 8px',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              Direktsimulation ⏭️
            </button>
          )}
        </div>
      </div>

      {/* Live Ticker Commentaries */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '220px' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>📝 Live-Spielbericht</h3>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {events.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '40px' }}>
              Warten auf den Anpfiff...
            </div>
          ) : (
            events.map((e, idx) => (
              <div 
                key={idx} 
                style={{ 
                  padding: '8px 10px', 
                  borderRadius: '8px',
                  backgroundColor: e.type === 'goal' ? 'rgba(34, 197, 94, 0.08)' :
                                   e.type === 'red' ? 'rgba(239, 68, 68, 0.08)' :
                                   e.type === 'yellow' ? 'rgba(234, 179, 8, 0.05)' :
                                   'rgba(255,255,255,0.01)',
                  border: e.type === 'goal' ? '1px solid var(--accent-green)' :
                          e.type === 'red' ? '1px solid var(--accent-red)' :
                          e.type === 'yellow' ? '1px solid var(--accent-gold)' :
                          '1px solid rgba(255,255,255,0.02)',
                  fontSize: '0.8rem',
                  lineHeight: '1.3'
                }}
              >
                <span style={{ 
                  fontWeight: 800, 
                  fontFamily: 'var(--font-display)', 
                  marginRight: '8px',
                  color: e.type === 'goal' ? 'var(--accent-green)' : 
                         e.type === 'red' ? 'var(--accent-red)' : 
                         e.type === 'yellow' ? 'var(--accent-gold)' : 
                         'var(--text-muted)'
                }}>
                  {e.minute}'
                </span>
                <span style={{ color: 'var(--text-main)' }}>{e.description}</span>
              </div>
            ))
          )}
          <div ref={tickerEndRef} />
        </div>
      </div>

      {/* Mid-Match Manager Options */}
      <div className="glass-panel" style={{ display: 'flex', gap: '8px', padding: '12px' }}>
        {minute < 90 ? (
          <>
            <button
              className="btn-primary"
              onClick={() => setIsPlaying(!isPlaying)}
              style={{ 
                flex: 1, 
                backgroundColor: isPlaying ? 'var(--accent-gold)' : 'var(--accent-green)',
                boxShadow: isPlaying ? '0 0 10px var(--accent-gold-glow)' : '0 0 10px var(--accent-green-glow)'
              }}
            >
              {isPlaying ? 'PAUSE ⏸️' : 'ANPFEIFEN / WEITER ▶️'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => { setIsPlaying(false); setShowSubModal(true); }}
              style={{ flex: 1 }}
            >
              Wechsel & Taktik 📋
            </button>
          </>
        ) : (
          <button
            className="btn-primary"
            onClick={() => onFinishMatch(homeScore, awayScore, events)}
            style={{ width: '100%' }}
          >
            Spiel beenden & ins Büro zurückkehren 🏢
          </button>
        )}
      </div>

      {/* User Substitution / Taktik drawer modal */}
      {showSubModal && (
        <div className="modal-overlay" onClick={() => setShowSubModal(false)}>
          <div className="modal-drawer" onClick={e => e.stopPropagation()}>
            <div className="flex-row-between" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              <h3>Taktische Anweisungen & Wechsel</h3>
              <button 
                onClick={() => setShowSubModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Change mentality live */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>SPIELSTIL ANPASSEN</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {['defensiv', 'ausgeglichen', 'offensiv', 'brechstange'].map(style => (
                  <button
                    key={style}
                    onClick={() => handleUpdateUserTactics(style as any)}
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      border: activeUserTeam.tactics.style === style ? '1.5px solid var(--accent-green)' : '1px solid var(--border-glass)',
                      backgroundColor: activeUserTeam.tactics.style === style ? 'var(--accent-green-glow)' : 'var(--bg-panel)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      textTransform: 'uppercase'
                    }}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Substitution select slot */}
            <div>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>SPIELER AUSWECHSELN</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeLineupPlayers.map((p, idx) => {
                  const isInjured = p.injuryWeeks > 0;
                  const isRedCarded = redCardedIds.includes(p.id);
                  if (isRedCarded) return null; // cannot substitute red-carded players

                  return (
                    <div 
                      key={p.id}
                      onClick={() => setSelectedSubSlot(idx)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        backgroundColor: selectedSubSlot === idx ? 'var(--accent-green-glow)' : 'rgba(255,255,255,0.01)',
                        border: selectedSubSlot === idx ? '1.5px solid var(--accent-green)' : isInjured ? '1.5px dashed var(--accent-red)' : '1.5px solid var(--border-glass)',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="player-position-tag">{p.position}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isInjured ? 'var(--accent-red)' : 'var(--text-main)' }}>
                          {p.name} {isInjured && '(VERLETZT!)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Fit: {p.fitness}% | ATP: {Math.round(p.atp ?? 100)}% | Gly: {Math.round(p.glycogen ?? 100)}%
                        </span>
                        <div className="player-ovr-badge med" style={{ width: '24px', height: '24px', fontSize: '0.75rem' }}>{p.overall}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sub selected slot -> show bench players */}
            {selectedSubSlot !== null && (
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', marginBottom: '8px' }}>BANK-SPIELER EINWECHSELN</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {reserveBenchPlayers.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                      Keine gesunden Feldspieler auf der Bank!
                    </div>
                  ) : (
                    reserveBenchPlayers.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleUserSwapPlayer(p.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 12px',
                          backgroundColor: 'rgba(255,255,255,0.01)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className="player-position-tag">{p.position}</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            Fit: {p.fitness}% | ATP: {Math.round(p.atp ?? 100)}% | Gly: {Math.round(p.glycogen ?? 100)}%
                          </span>
                          <div className="player-ovr-badge med" style={{ width: '24px', height: '24px', fontSize: '0.75rem' }}>{p.overall}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Injury Alarm Modal alert */}
      {injuryAlertPlayer && (
        <div className="modal-overlay">
          <div className="modal-drawer" style={{ textAlign: 'center', borderTop: '4px solid var(--accent-red)' }}>
            <div style={{ fontSize: '3rem' }}>🚨</div>
            <h3 style={{ color: 'var(--accent-red)', margin: '8px 0' }}>VERLETZUNGSALARM!</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
              {injuryAlertPlayer.name} ({injuryAlertPlayer.position})
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              ist verletzt und kann das Spiel nicht fortsetzen! Sie müssen eine Auswechslung vornehmen, um fortzufahren.
            </p>

            <button
              className="btn-primary"
              onClick={() => {
                // Find index of injured player in active lineup
                const idx = activeUserTeam.lineup.indexOf(injuryAlertPlayer.id);
                if (idx !== -1) {
                  setSelectedSubSlot(idx);
                  setShowSubModal(true);
                }
                setInjuryAlertPlayer(null);
              }}
              style={{ width: '100%', marginTop: '16px', backgroundColor: 'var(--accent-red)' }}
            >
              Spieler auswechseln 🔄
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
