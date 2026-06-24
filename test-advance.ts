import { generateInitialTeams } from './src/data/playerDatabase';
import { generateGroupMatches, calculateGroupStandings, generateRoundOf16, generateQuarterfinals, generateSemifinals, generateFinals, getWinners, GAME_CALENDAR } from './src/utils/tournamentEngine';
import { simulateFullMatch } from './src/utils/gameEngine';

// Simulating the training routine code from App.tsx
const runTrainingRoutine = (teams: any[], focus: string) => {
  let affectedCount = 0;
  const updatedTeams = teams.map(t => {
    const updatedPlayers = t.players.map((p: any) => {
      const skills = p.skills ? { ...p.skills } : { shooting: 50, passing: 50, defending: 50, physical: 50, goalkeeping: 50 };
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

  return { updatedTeams };
};

const runFullTournamentTest = () => {
  console.log("Starting full 17-day tournament simulation test...");
  
  const initialTeams = generateInitialTeams();
  const userTeamId = 'GER';
  let teams = initialTeams.map(t => ({
    ...t,
    isUser: t.id === userTeamId
  }));
  
  let matches = generateGroupMatches(teams);
  let stage = 'group_stage';
  
  for (let currentDayIndex = 0; currentDayIndex < GAME_CALENDAR.length - 1; currentDayIndex++) {
    const currentCalendarDay = GAME_CALENDAR[currentDayIndex];
    console.log(`\n--- Day ${currentDayIndex}: ${currentCalendarDay.label} (${currentCalendarDay.date}) ---`);
    
    // Simulate User Match if any (simulate it as a full match since we are auto-testing)
    const userTeam = teams.find(t => t.id === userTeamId)!;
    const userMatches = matches.filter(m => m.homeTeamId === userTeam.id || m.awayTeamId === userTeam.id);
    const nextUserMatch = userMatches.find(m => m.dayIndex === currentDayIndex && !m.played);
    
    if (nextUserMatch) {
      console.log(`User team ${userTeam.name} has a match against ${nextUserMatch.homeTeamId === userTeamId ? nextUserMatch.awayTeamId : nextUserMatch.homeTeamId}`);
      const home = teams.find(t => t.id === nextUserMatch.homeTeamId)!;
      const away = teams.find(t => t.id === nextUserMatch.awayTeamId)!;
      const result = simulateFullMatch(home, away, nextUserMatch.stage, nextUserMatch.date, nextUserMatch.dayIndex);
      
      const idx = matches.findIndex(m => m.id === nextUserMatch.id);
      matches[idx] = {
        ...nextUserMatch,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        played: true,
        events: result.events
      };
      console.log(`Match played: ${home.name} ${result.homeScore}:${result.awayScore} ${away.name}`);
    }

    // Now call advanceDay logic for the current day index
    const nextDayIndex = currentDayIndex + 1;
    const nextDay = GAME_CALENDAR[nextDayIndex];
    
    // 1. Training logic
    if (currentCalendarDay.type === 'training') {
      const trainingResult = runTrainingRoutine(teams, 'kondition');
      teams = trainingResult.updatedTeams;
      console.log("Training simulated.");
    }
    
    // 2. Simulate AI matches (and user matches if not played yet, e.g. if user skipped)
    const todayMatches = matches.filter(m => m.dayIndex === currentDayIndex && !m.played);
    console.log(`Simulating ${todayMatches.length} remaining matches for today...`);
    
    for (const match of todayMatches) {
      const home = teams.find(t => t.id === match.homeTeamId);
      const away = teams.find(t => t.id === match.awayTeamId);
      
      if (!home || !away) {
        console.error(`Teams not found: ${match.homeTeamId} or ${match.awayTeamId}`);
        continue;
      }
      
      const result = simulateFullMatch(home, away, match.stage, match.date, match.dayIndex);
      const idx = matches.findIndex(m => m.id === match.id);
      matches[idx] = {
        ...match,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        played: true,
        events: result.events
      };
    }
    
    // 3. Decrement injuries
    teams = teams.map(t => ({
      ...t,
      players: t.players.map(p => ({
        ...p,
        injuryWeeks: p.injuryWeeks > 0 ? p.injuryWeeks - 1 : 0,
        fitness: currentCalendarDay.type === 'training' ? Math.min(100, p.fitness + 12) : Math.min(100, p.fitness + 5)
      }))
    }));
    
    // 4. Bracket generation
    if (nextDayIndex === 9 && stage === 'group_stage') {
      console.log("Generating Round of 16...");
      const r16Matches = generateRoundOf16(matches, teams);
      matches = [...matches, ...r16Matches];
      stage = 'round_of_16';
    }
    
    if (nextDayIndex === 11) {
      console.log("Generating Quarterfinals...");
      const r16Played = matches.filter(m => m.stage === 'Achtelfinale');
      const vfMatches = generateQuarterfinals(r16Played);
      matches = [...matches, ...vfMatches];
      stage = 'quarterfinals';
    }
    
    if (nextDayIndex === 13) {
      console.log("Generating Semifinals...");
      const vfPlayed = matches.filter(m => m.stage === 'Viertelfinale');
      const hfMatches = generateSemifinals(vfPlayed);
      matches = [...matches, ...hfMatches];
      stage = 'semifinals';
    }
    
    if (nextDayIndex === 15) {
      console.log("Generating Finals...");
      const hfPlayed = matches.filter(m => m.stage === 'Halbfinale');
      const finalMatches = generateFinals(hfPlayed);
      matches = [...matches, ...finalMatches];
      stage = 'final';
    }
    
    if (nextDayIndex >= 16) {
      const finalsPlayed = matches.filter(m => m.stage === 'Finale' && m.played);
      if (finalsPlayed.length > 0) {
        stage = 'finished';
        const winnerId = getWinners(finalsPlayed)[0];
        const winner = teams.find(t => t.id === winnerId);
        console.log(`Tournament Winner: ${winner?.name}!`);
      }
    }
  }
  
  console.log("\nFull 17-day simulation test completed successfully with no crashes!");
};

runFullTournamentTest();
