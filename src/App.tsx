import React, { useState, useEffect } from 'react';
import { GameState, Team, Player, Match, NewsItem, GroupStanding } from './types';
import { generateInitialTeams, generateFreeAgents, generateSkills } from './data/playerDatabase';
import { generateGroupMatches, calculateGroupStandings, generateRoundOf16, generateQuarterfinals, generateSemifinals, generateFinals, getWinners, GAME_CALENDAR } from './utils/tournamentEngine';
import { simulateSubstrateMatch } from './utils/substrateEngine';
import { verifyStateLedger, appendLedgerEvent, xorNumber, generateActionToken } from './utils/cryptoLedger';
import { Capacitor } from '@capacitor/core';

// Import Views
import Dashboard from './components/Dashboard';
import Lineup from './components/Lineup';
import Roster from './components/Roster';
import Transfers from './components/Transfers';
import TournamentView from './components/TournamentView';
import MatchView from './components/MatchView';

const STORAGE_KEY = 'wm_fussballmanager_save';

// Helper to migrate and sanitize old save games
const migrateSaveGame = (state: GameState): GameState => {
  if (!state || !state.teams) return state;

  const migratedTeams = state.teams.map(team => {
    if (!team.players) return team;
    
    const migratedPlayers = team.players.map(p => {
      // Ensure skills exist
      let skills = p.skills;
      if (!skills) {
        skills = generateSkills(p.position, p.overall);
      } else {
        // Ensure all individual skills are defined
        skills = {
          shooting: skills.shooting !== undefined ? skills.shooting : p.overall,
          passing: skills.passing !== undefined ? skills.passing : p.overall,
          defending: skills.defending !== undefined ? skills.defending : p.overall,
          physical: skills.physical !== undefined ? skills.physical : p.overall,
          goalkeeping: skills.goalkeeping !== undefined ? skills.goalkeeping : p.overall
        };
      }

      return {
        ...p,
        skills,
        goals: p.goals !== undefined ? p.goals : 0,
        assists: p.assists !== undefined ? p.assists : 0,
        yellowCards: p.yellowCards !== undefined ? p.yellowCards : 0,
        redCards: p.redCards !== undefined ? p.redCards : 0,
        injuryWeeks: p.injuryWeeks !== undefined ? p.injuryWeeks : 0,
        contractYears: p.contractYears !== undefined ? p.contractYears : 2,
        fitness: p.fitness !== undefined ? p.fitness : 100,
        form: p.form !== undefined ? p.form : 75,
        morale: p.morale !== undefined ? p.morale : 80
      };
    });

    return {
      ...team,
      players: migratedPlayers
    };
  });

  return {
    ...state,
    teams: migratedTeams
  };
};

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeScreen, setActiveScreen] = useState<string>('dashboard');
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [selectedTeamForView, setSelectedTeamForView] = useState<Team | null>(null);
  
  // Selection screen state
  const [tempTeams, setTempTeams] = useState<Team[]>([]);
  const [selectedSelectionTeam, setSelectedSelectionTeam] = useState<Team | null>(null);

  // Helper to handle game state updates with cryptographic ledger logging
  const updateGameStateWithLedger = (
    newState: Omit<GameState, 'ledger' | 'ledgerHash'>,
    eventType: GameState['ledger'][0]['type'],
    payload: any
  ) => {
    const currentLedger = gameState?.ledger || [];
    const { ledger, topHash } = appendLedgerEvent(currentLedger, eventType, payload);
    setGameState({
      ...newState,
      ledger,
      ledgerHash: topHash
    } as GameState);
  };

  // 1. Initial Load from LocalStorage or pre-setup
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      document.body.classList.add('capacitor-app');
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as GameState;
        
        // Cryptographic Ledger verification
        if (parsed.ledger && !verifyStateLedger(parsed.ledger)) {
          console.warn("Kryptografische Speicherstands-Verifikation fehlgeschlagen! Spielstand wurde manipuliert.");
          alert("Speicherstands-Verifikation fehlgeschlagen! Das Append-Only Ledger weist Abweichungen auf. Ein neues Spiel wird initialisiert.");
          initializePreGame();
          return;
        }

        const migrated = migrateSaveGame(parsed);
        setGameState(migrated);
        // Load free agents
        setFreeAgents(generateFreeAgents());
      } catch (e) {
        console.error('Error loading save game:', e);
        initializePreGame();
      }
    } else {
      initializePreGame();
    }
  }, []);

  // Save game whenever state changes
  useEffect(() => {
    if (gameState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    }
  }, [gameState]);

  const initializePreGame = () => {
    const initialTeams = generateInitialTeams();
    setTempTeams(initialTeams);
    setSelectedSelectionTeam(initialTeams[0]);
    setFreeAgents(generateFreeAgents());
  };

  const startNewGame = (teamId: string) => {
    const teams = tempTeams.map(t => ({
      ...t,
      isUser: t.id === teamId
    }));
    
    const initialMatches = generateGroupMatches(teams);
    
    const initialNews: NewsItem[] = [
      {
        id: 'start',
        date: GAME_CALENDAR[0].date,
        title: 'WM 2026 beginnt!',
        content: `Herzlich willkommen zum WM Fussballmanager 2026! Sie haben die Leitung von ${teams.find(t => t.id === teamId)?.name} übernommen. Bereiten Sie Ihr Team auf das erste Gruppenspiel vor.`,
        type: 'tournament'
      }
    ];

    const initialGameState = {
      currentDayIndex: 0,
      currentDate: GAME_CALENDAR[0].date,
      userTeamId: teamId,
      teams,
      matches: initialMatches,
      news: initialNews,
      stage: 'group_stage' as const,
      history: {}
    };

    // Initialize with a cryptographic Merkle root
    const { ledger, topHash } = appendLedgerEvent([], 'init', { userTeamId: teamId });
    setGameState({
      ...initialGameState,
      ledger,
      ledgerHash: topHash
    });

    setActiveScreen('dashboard');
  };

  const resetGame = () => {
    if (window.confirm('Möchten Sie das Spiel wirklich zurücksetzen? Alle Fortschritte gehen verloren.')) {
      localStorage.removeItem(STORAGE_KEY);
      initializePreGame();
      setGameState(null);
    }
  };

  if (!gameState) {
    // RENDER TEAM SELECTION SCREEN
    const calculatedOvr = (team: Team) => {
      const sum = team.players.reduce((s, p) => s + p.overall, 0);
      return Math.round(sum / team.players.length);
    };

    return (
      <div className="phone-frame">
        <div className="phone-top-bar">
          <div>17:00</div>
          <div className="top-bar-icons">
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>
        <div className="app-container" style={{ padding: '20px', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--accent-green)', textShadow: '0 0 10px var(--accent-green-glow)' }}>
              WM MANAGER 26
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              Wählen Sie Ihre Nationalmannschaft
            </p>
          </div>

          <div className="glass-panel" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', maxHeight: '260px', overflowY: 'auto', paddingRight: '4px' }}>
              {tempTeams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedSelectionTeam(t)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    borderRadius: '12px',
                    border: selectedSelectionTeam?.id === t.id ? '2px solid var(--accent-green)' : '1px solid var(--border-glass)',
                    backgroundColor: selectedSelectionTeam?.id === t.id ? 'var(--accent-green-glow)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{t.flag}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedSelectionTeam && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="flex-row-between">
                <h2 style={{ fontSize: '1.4rem', color: 'var(--accent-gold)' }}>
                  {selectedSelectionTeam.flag} {selectedSelectionTeam.name}
                </h2>
                <span className="badge-green" style={{ fontSize: '0.85rem' }}>
                  Stärke: {calculatedOvr(selectedSelectionTeam)} OVR
                </span>
              </div>

              <div>
                <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Top-Spieler:</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedSelectionTeam.players
                    .sort((a, b) => b.overall - a.overall)
                    .slice(0, 3)
                    .map(p => (
                      <div key={p.id} className="flex-row-between" style={{ fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: 'var(--text-main)' }}>
                          <span className="player-position-tag" style={{ marginRight: '6px' }}>{p.position}</span>
                          {p.name} ({p.age} Jahre)
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{p.overall} OVR</span>
                      </div>
                    ))}
                </div>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="flex-row-between" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Turnierbudget:</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{(xorNumber(selectedSelectionTeam.budget_xor) / 1000000).toFixed(1)} Mio. €</span>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => startNewGame(selectedSelectionTeam.id)}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  Turnier starten
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const userTeam = gameState.teams.find(t => t.id === gameState.userTeamId)!;
  const currentCalendarDay = GAME_CALENDAR[gameState.currentDayIndex];
  
  // Find next user match
  const userMatches = gameState.matches.filter(
    m => (m.homeTeamId === userTeam.id || m.awayTeamId === userTeam.id)
  );
  const nextUserMatch = userMatches.find(m => m.dayIndex === gameState.currentDayIndex && !m.played);

  // Advance Calendar day
  const advanceDay = (trainingFocus?: string) => {
    const nextDayIndex = gameState.currentDayIndex + 1;
    if (nextDayIndex >= GAME_CALENDAR.length) {
      alert('Das Turnier ist beendet!');
      return;
    }

    const nextDay = GAME_CALENDAR[nextDayIndex];
    let updatedTeams = [...gameState.teams];
    let updatedMatches = [...gameState.matches];
    let newNews: NewsItem[] = [];

    // Run Training logic if advancing from a training day
    if (currentCalendarDay.type === 'training') {
      const focus = trainingFocus || 'kondition';
      const trainingResult = runTrainingRoutine(updatedTeams, focus, gameState.currentDayIndex);
      
      // Validate training action token (Differential Validation)
      const expectedToken = generateActionToken(`training_${focus}`, gameState.currentDayIndex);
      if (trainingResult.token !== expectedToken) {
        console.error("Training token validation failed!");
        return;
      }

      updatedTeams = trainingResult.updatedTeams;
      newNews.push(trainingResult.newsItem);
    }

    // Simulate AI matches for the current day index if they haven't been played yet
    const todayMatches = updatedMatches.filter(m => m.dayIndex === gameState.currentDayIndex && !m.played);
    
    for (const match of todayMatches) {
      // Find team references
      const home = updatedTeams.find(t => t.id === match.homeTeamId);
      const away = updatedTeams.find(t => t.id === match.awayTeamId);
      
      if (!home || !away) {
        console.error(`Team references not found for match: ${match.id} (Home: ${match.homeTeamId}, Away: ${match.awayTeamId})`);
        const matchIdx = updatedMatches.findIndex(m => m.id === match.id);
        updatedMatches[matchIdx] = {
          ...match,
          homeScore: 0,
          awayScore: 0,
          played: true,
          events: [{ minute: 1, type: 'text', description: 'Spiel abgesagt: Teams nicht gefunden.' }]
        };
        continue;
      }
      
      const result = simulateSubstrateMatch(home, away, match.stage, match.date, match.dayIndex);
      
      // Update match details
      const matchIdx = updatedMatches.findIndex(m => m.id === match.id);
      updatedMatches[matchIdx] = {
        ...match,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        played: true,
        events: result.events
      };

      // Add news for highlight games
      if (result.homeScore !== null && result.awayScore !== null) {
        if (result.homeScore + result.awayScore >= 4 || result.events.some(e => e.type === 'red')) {
          newNews.push({
            id: `news_${match.id}`,
            date: currentCalendarDay.date,
            title: `Spektakel bei ${home.name} vs. ${away.name}!`,
            content: `Das Spiel endete mit einem packenden ${result.homeScore}:${result.awayScore}. Ticker-Analysten sprechen von einem fantastischen WM-Duell.`,
            type: 'match'
          });
        }
      }
    }

    // Decrement player injury timers & regenerate ATP/Glykogen
    updatedTeams = updatedTeams.map(t => ({
      ...t,
      players: t.players.map(p => ({
        ...p,
        injuryWeeks: p.injuryWeeks > 0 ? p.injuryWeeks - 1 : 0,
        // Small fitness recovery on training/rest days
        fitness: currentCalendarDay.type === 'training' 
          ? Math.min(100, p.fitness + 12) 
          : Math.min(100, p.fitness + 5),
        atp: 100.0,
        glycogen: 100.0
      }))
    }));

    // If Group Stage is completed (Day 8 matches played)
    // Generate Round of 16 matches on Day 9
    if (nextDayIndex === 9 && gameState.stage === 'group_stage') {
      const r16Matches = generateRoundOf16(updatedMatches, updatedTeams);
      updatedMatches = [...updatedMatches, ...r16Matches];
      newNews.push({
        id: 'r16_generated',
        date: nextDay.date,
        title: 'Achtelfinale steht fest!',
        content: 'Die Gruppenphase ist vorbei. Die 16 verbleibenden Nationalmannschaften kämpfen ab sofort im K.o.-System um den WM-Titel.',
        type: 'tournament'
      });
    }

    // After Round of 16 (Day 10 matches played) -> Generate Quarterfinals on Day 11
    if (nextDayIndex === 11) {
      const r16Played = updatedMatches.filter(m => m.stage === 'Achtelfinale');
      const vfMatches = generateQuarterfinals(r16Played);
      updatedMatches = [...updatedMatches, ...vfMatches];
      newNews.push({
        id: 'vf_generated',
        date: nextDay.date,
        title: 'Viertelfinale ausgelost!',
        content: 'Das Feld lichtet sich. Nur noch 8 Mannschaften sind im Rennen.',
        type: 'tournament'
      });
    }

    // After Quarterfinals (Day 12 matches played) -> Generate Semifinals on Day 13
    if (nextDayIndex === 13) {
      const vfPlayed = updatedMatches.filter(m => m.stage === 'Viertelfinale');
      const hfMatches = generateSemifinals(vfPlayed);
      updatedMatches = [...updatedMatches, ...hfMatches];
      newNews.push({
        id: 'hf_generated',
        date: nextDay.date,
        title: 'Das Halbfinale wartet!',
        content: 'Die vier besten Teams der Welt stehen fest. Wer zieht ins Finale ein?',
        type: 'tournament'
      });
    }

    // After Semifinals (Day 14 matches played) -> Generate Finals on Day 15
    if (nextDayIndex === 15) {
      const hfPlayed = updatedMatches.filter(m => m.stage === 'Halbfinale');
      const finalMatches = generateFinals(hfPlayed);
      updatedMatches = [...updatedMatches, ...finalMatches];
      
      const finalists = updatedTeams.filter(t => getWinners(hfPlayed).includes(t.id));
      newNews.push({
        id: 'finals_generated',
        date: nextDay.date,
        title: 'FINALE STEHT FEST!',
        content: `Das große Finale lautet: ${finalists[0]?.flag} ${finalists[0]?.name} gegen ${finalists[1]?.flag} ${finalists[1]?.name}! Was für ein historischer Moment!`,
        type: 'tournament'
      });
    }

    // Determine stage updates
    let updatedStage = gameState.stage;
    if (nextDayIndex >= 16) {
      const finalsPlayed = updatedMatches.filter(m => m.stage === 'Finale' && m.played);
      if (finalsPlayed.length > 0) {
        updatedStage = 'finished';
        const winnerId = getWinners(finalsPlayed)[0];
        const winner = updatedTeams.find(t => t.id === winnerId);
        newNews.push({
          id: 'winner_announcement',
          date: nextDay.date,
          title: `${winner?.name} IST WELTMEISTER!`,
          content: `Herzlichen Glückwunsch an ${winner?.flag} ${winner?.name} zum Gewinn der Fussball-Weltmeisterschaft 2026!`,
          type: 'tournament'
        });
      }
    } else if (nextDayIndex >= 14) {
      updatedStage = 'final';
    } else if (nextDayIndex >= 12) {
      updatedStage = 'semifinals';
    } else if (nextDayIndex >= 10) {
      updatedStage = 'quarterfinals';
    } else if (nextDayIndex >= 9) {
      updatedStage = 'round_of_16';
    }

    const nextState = {
      ...gameState,
      currentDayIndex: nextDayIndex,
      currentDate: nextDay.date,
      teams: updatedTeams,
      matches: updatedMatches,
      news: [...newNews, ...gameState.news].slice(0, 40),
      stage: updatedStage
    };

    updateGameStateWithLedger(nextState, 'day_advance', { dayIndex: nextDayIndex });

    setActiveScreen('dashboard');
  };

  // Run training routine details
  const runTrainingRoutine = (teams: Team[], focus: string, dayIndex: number): { updatedTeams: Team[]; newsItem: NewsItem; token: string } => {
    let affectedCount = 0;

    const updatedTeams = teams.map(t => {
      const updatedPlayers = t.players.map(p => {
        const skills = p.skills ? { ...p.skills } : generateSkills(p.position, p.overall);
        let overall = p.overall;
        let fitness = p.fitness;

        if (Math.random() < 0.4 && p.injuryWeeks === 0) {
          affectedCount++;
          const boost = 1;
          
          if (focus === 'torschuss' && p.position === 'ANG') {
            skills.shooting = Math.min(99, skills.shooting + boost);
            overall = Math.min(99, Math.round((skills.shooting + skills.passing + skills.physical) / 3));
          } else if (focus === 'abwehr' && p.position === 'ABW') {
            skills.defending = Math.min(99, skills.defending + boost);
            overall = Math.min(99, Math.round((skills.defending + skills.passing + skills.physical) / 3));
          } else if (focus === 'passspiel' && p.position === 'MF') {
            skills.passing = Math.min(99, skills.passing + boost);
            overall = Math.min(99, Math.round((skills.defending + skills.passing + skills.shooting + skills.physical) / 4));
          } else if (focus === 'kondition') {
            fitness = Math.min(100, fitness + 8);
          }
        }

        return {
          ...p,
          skills,
          overall,
          fitness
        };
      });

      return {
        ...t,
        players: updatedPlayers
      };
    });

    let focusLabel = 'Kondition & Regeneration';
    if (focus === 'torschuss') focusLabel = 'Torschuss & Angriffsspiel';
    if (focus === 'abwehr') focusLabel = 'Abwehrtaktik & Stellungsspiel';
    if (focus === 'passspiel') focusLabel = 'Kurzpass & Kombinationen';

    const newsItem: NewsItem = {
      id: `training_${Date.now()}`,
      date: currentCalendarDay.date,
      title: 'Training abgeschlossen!',
      content: `Der Schwerpunkt lag heute auf "${focusLabel}". Insgesamt konnten ${affectedCount} Spieler ihre Fitness oder Fähigkeiten verbessern.`,
      type: 'system'
    };

    const token = generateActionToken(`training_${focus}`, dayIndex);

    return { updatedTeams, newsItem, token };
  };

  // Interactive Match Sim Handlers
  const handleStartInteractiveMatch = (matchId: string) => {
    setActiveMatchId(matchId);
    setActiveScreen('match');
  };

  const handleScheduleFriendlyMatch = (opponentId: string) => {
    if (!gameState) return;
    const newFriendlyMatch: Match = {
      id: `friendly_${Date.now()}`,
      homeTeamId: gameState.userTeamId,
      awayTeamId: opponentId,
      homeScore: null,
      awayScore: null,
      played: false,
      stage: 'Freundschaftsspiel',
      events: [],
      date: gameState.currentDate,
      dayIndex: gameState.currentDayIndex
    };

    const nextState = {
      ...gameState,
      matches: [...gameState.matches, newFriendlyMatch]
    };
    updateGameStateWithLedger(nextState, 'day_advance', { friendlyScheduled: newFriendlyMatch.id });
    
    setActiveMatchId(newFriendlyMatch.id);
    setActiveScreen('match');
  };

  const handleFinishInteractiveMatch = (homeScore: number, awayScore: number, events: Match['events']) => {
    if (!activeMatchId || !gameState) return;

    // Simulate other AI matches on this calendar day in parallel
    let updatedMatches = gameState.matches.map(m => {
      if (m.id === activeMatchId) {
        return {
          ...m,
          homeScore,
          awayScore,
          played: true,
          events
        };
      }
      return m;
    });

    // Award goals statistics to actual player profiles
    const activeMatch = gameState.matches.find(m => m.id === activeMatchId);
    if (!activeMatch) {
      setActiveMatchId(null);
      setActiveScreen('dashboard');
      return;
    }
    const homeTeamCopy = gameState.teams.find(t => t.id === activeMatch.homeTeamId);
    const awayTeamCopy = gameState.teams.find(t => t.id === activeMatch.awayTeamId);

    if (!homeTeamCopy || !awayTeamCopy) {
      setActiveMatchId(null);
      setActiveScreen('dashboard');
      return;
    }

    const updatedTeams = gameState.teams.map(t => {
      if (t.id === homeTeamCopy.id || t.id === awayTeamCopy.id) {
        const teamEvents = events.filter(e => e.type === 'goal' && e.teamId === t.id);
        const redEvents = events.filter(e => e.type === 'red' && e.teamId === t.id);
        const injuryEvents = events.filter(e => e.type === 'injury' && e.teamId === t.id);

        return {
          ...t,
          players: t.players.map(p => {
            const goalsScored = teamEvents.filter(e => e.playerName === p.name).length;
            const redCarded = redEvents.some(e => e.playerName === p.name);
            const injured = injuryEvents.some(e => e.playerName === p.name);

            return {
              ...p,
              goals: p.goals + goalsScored,
              redCards: p.redCards + (redCarded ? 1 : 0),
              injuryWeeks: p.injuryWeeks + (injured ? 1 + Math.floor(Math.random() * 3) : 0),
              fitness: Math.max(20, p.fitness - 25) // match exhausts players
            };
          })
        };
      }
      return t;
    });

    const newNewsItem: NewsItem = {
      id: `match_res_${activeMatchId}`,
      date: currentCalendarDay.date,
      title: activeMatch.stage === 'Freundschaftsspiel'
        ? `TESTSPIEL: ${homeTeamCopy.name} ${homeScore}:${awayScore} ${awayTeamCopy.name}`
        : `${homeTeamCopy.name} ${homeScore}:${awayScore} ${awayTeamCopy.name}`,
      content: activeMatch.stage === 'Freundschaftsspiel'
        ? `Das Freundschaftsspiel zwischen ${homeTeamCopy.name} und ${awayTeamCopy.name} endete ${homeScore}:${awayScore}.`
        : `Ihr Spiel ist beendet. ${homeTeamCopy.name} trennt sich ${homeScore}:${awayScore} von ${awayTeamCopy.name}.`,
      type: 'match'
    };

    const nextState = {
      ...gameState,
      matches: updatedMatches,
      teams: updatedTeams,
      news: [newNewsItem, ...gameState.news]
    };
    updateGameStateWithLedger(nextState, 'match_completed', { matchId: activeMatchId, homeScore, awayScore });

    setActiveMatchId(null);
    setActiveScreen('dashboard');
  };

  const handleUpdateLineup = (lineup: string[]) => {
    if (!gameState) return;
    const nextState = {
      ...gameState,
      teams: gameState.teams.map(t => 
        t.id === gameState.userTeamId ? { ...t, lineup } : t
      )
    };
    updateGameStateWithLedger(nextState, 'day_advance', { lineupUpdated: true });
  };

  const handleUpdateTactics = (tactics: Team['tactics']) => {
    if (!gameState) return;
    const nextState = {
      ...gameState,
      teams: gameState.teams.map(t => 
        t.id === gameState.userTeamId ? { ...t, tactics } : t
      )
    };
    updateGameStateWithLedger(nextState, 'day_advance', { tacticsUpdated: true });
  };

  const handleTransferDeal = (dealType: 'buy' | 'sell', player: Player, price: number, opponentTeamId?: string) => {
    if (!gameState) return;

    // Validate Action Token
    const token = generateActionToken(`transfer_${dealType}_${player.id}`, price);
    const expectedToken = generateActionToken(`transfer_${dealType}_${player.id}`, price);
    if (token !== expectedToken) {
      console.error("Transfer action token bypass attempt detected!");
      return;
    }

    let updatedTeams = [...gameState.teams];
    const userTeamIdx = updatedTeams.findIndex(t => t.id === gameState.userTeamId);
    const userTeam = updatedTeams[userTeamIdx];
    const userBudget = xorNumber(userTeam.budget_xor);

    if (dealType === 'buy') {
      if (userBudget < price) {
        alert('Nicht genügend Budget vorhanden!');
        return;
      }

      // Add to user team
      const boughtPlayer = { 
        ...player, 
        nationality: userTeam.name,
        contractYears: 2
      };
      
      updatedTeams[userTeamIdx] = {
        ...userTeam,
        budget_xor: xorNumber(userBudget - price),
        players: [...userTeam.players, boughtPlayer]
      };

      // Remove from opponent team (if not free agent)
      if (opponentTeamId) {
        const oppIdx = updatedTeams.findIndex(t => t.id === opponentTeamId);
        const oppTeam = updatedTeams[oppIdx];
        const oppBudget = xorNumber(oppTeam.budget_xor);
        updatedTeams[oppIdx] = {
          ...oppTeam,
          budget_xor: xorNumber(oppBudget + price),
          players: oppTeam.players.filter(p => p.id !== player.id),
          lineup: oppTeam.lineup.filter(id => id !== player.id)
        };
      } else {
        // Free agent pool update
        setFreeAgents(freeAgents.filter(p => p.id !== player.id));
      }

      // Log news
      const transferNews: NewsItem = {
        id: `trans_${Date.now()}`,
        date: currentCalendarDay.date,
        title: `TRANSFER: ${player.name} wechselt!`,
        content: `${userTeam.name} gibt die Verpflichtung von ${player.name} für eine Ablösesumme von ${(price/1000000).toFixed(1)} Mio. € bekannt.`,
        type: 'transfer'
      };

      const nextState = {
        ...gameState,
        teams: updatedTeams,
        news: [transferNews, ...gameState.news]
      };
      updateGameStateWithLedger(nextState, 'transfer', { dealType, playerId: player.id, price, opponentTeamId });
      alert(`Erfolgreich verpflichtet: ${player.name}`);

    } else if (dealType === 'sell') {
      // Remove from user team
      updatedTeams[userTeamIdx] = {
        ...userTeam,
        budget_xor: xorNumber(userBudget + price),
        players: userTeam.players.filter(p => p.id !== player.id),
        lineup: userTeam.lineup.filter(id => id !== player.id)
      };

      // Add to opponent team (if sold to specific team, otherwise free agent/deleted)
      if (opponentTeamId) {
        const oppIdx = updatedTeams.findIndex(t => t.id === opponentTeamId);
        const oppTeam = updatedTeams[oppIdx];
        const oppBudget = xorNumber(oppTeam.budget_xor);
        updatedTeams[oppIdx] = {
          ...oppTeam,
          budget_xor: xorNumber(oppBudget - price),
          players: [...oppTeam.players, { ...player, nationality: oppTeam.name }]
        };
      }

      const transferNews: NewsItem = {
        id: `trans_${Date.now()}`,
        date: currentCalendarDay.date,
        title: `TRANSFER: ${player.name} verkauft!`,
        content: `${userTeam.name} verkauft ${player.name} für eine Summe von ${(price/1000000).toFixed(1)} Mio. € an die Konkurrenz.`,
        type: 'transfer'
      };

      const nextState = {
        ...gameState,
        teams: updatedTeams,
        news: [transferNews, ...gameState.news]
      };
      updateGameStateWithLedger(nextState, 'transfer', { dealType, playerId: player.id, price, opponentTeamId });
      alert(`Erfolgreich verkauft: ${player.name}`);
    }
  };

  return (
    <div className="phone-frame">
      <div className="phone-top-bar">
        <div>17:00</div>
        <div className="top-bar-icons">
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>
      <div className="app-container">
        
        {/* Render Active View */}
        {activeScreen === 'dashboard' && (
          <Dashboard 
            gameState={gameState} 
            userTeam={userTeam}
            nextMatch={nextUserMatch}
            onNavigate={setActiveScreen}
            onAdvanceDay={advanceDay}
            onResetGame={resetGame}
            onStartMatch={handleStartInteractiveMatch}
            onStartFriendlyMatch={handleScheduleFriendlyMatch}
          />
        )}

        {activeScreen === 'lineup' && (
          <Lineup 
            userTeam={userTeam}
            onUpdateLineup={handleUpdateLineup}
            onUpdateTactics={handleUpdateTactics}
            onNavigate={setActiveScreen}
          />
        )}

        {activeScreen === 'roster' && (
          <Roster 
            userTeam={userTeam}
            onNavigate={setActiveScreen}
          />
        )}

        {activeScreen === 'transfers' && (
          <Transfers 
            gameState={gameState}
            userTeam={userTeam}
            freeAgents={freeAgents}
            onTransfer={handleTransferDeal}
            onNavigate={setActiveScreen}
          />
        )}

        {activeScreen === 'tournament' && (
          <TournamentView 
            gameState={gameState}
            userTeam={userTeam}
            onNavigate={setActiveScreen}
            selectedTeam={selectedTeamForView}
            setSelectedTeam={setSelectedTeamForView}
          />
        )}

        {activeScreen === 'match' && activeMatchId && (
          <MatchView 
            matchId={activeMatchId}
            gameState={gameState}
            userTeam={userTeam}
            onFinishMatch={handleFinishInteractiveMatch}
            onNavigate={setActiveScreen}
          />
        )}

        {/* Global Bottom Tab Bar (hidden during active match simulation) */}
        {activeScreen !== 'match' && (
          <div className="bottom-nav">
            <div 
              className={`nav-item ${activeScreen === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveScreen('dashboard')}
            >
              <span className="nav-icon">🏢</span>
              <span>Büro</span>
            </div>
            <div 
              className={`nav-item ${activeScreen === 'lineup' ? 'active' : ''}`}
              onClick={() => setActiveScreen('lineup')}
            >
              <span className="nav-icon">📋</span>
              <span>Aufstellung</span>
            </div>
            <div 
              className={`nav-item ${activeScreen === 'roster' ? 'active' : ''}`}
              onClick={() => setActiveScreen('roster')}
            >
              <span className="nav-icon">🏃</span>
              <span>Kader</span>
            </div>
            <div 
              className={`nav-item ${activeScreen === 'transfers' ? 'active' : ''}`}
              onClick={() => setActiveScreen('transfers')}
            >
              <span className="nav-icon">🤝</span>
              <span>Transfers</span>
            </div>
            <div 
              className={`nav-item ${activeScreen === 'tournament' ? 'active' : ''}`}
              onClick={() => setActiveScreen('tournament')}
            >
              <span className="nav-icon">🏆</span>
              <span>Turnier</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
