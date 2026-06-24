import { Player, Team, Match, MatchEvent, PlayerPosition } from '../types';

// Helper to get active players in lineup
export function getActivePlayers(team: Team): Player[] {
  return team.players.filter(p => team.lineup.includes(p.id) && p.injuryWeeks === 0);
}

// Calculate team sector strengths based on active lineup
export interface TeamStrengths {
  goalkeeping: number;
  defense: number;
  midfield: number;
  attack: number;
}

export function calculateTeamStrengths(team: Team): TeamStrengths {
  const active = getActivePlayers(team);
  
  const gks = active.filter(p => p.position === 'TW');
  const dfs = active.filter(p => p.position === 'ABW');
  const mfs = active.filter(p => p.position === 'MF');
  const fws = active.filter(p => p.position === 'ANG');

  // Sector averages (default to 50 if empty, to avoid division by zero)
  const gkAvg = gks.length > 0 ? gks.reduce((sum, p) => sum + p.overall, 0) / gks.length : 50;
  const dfAvg = dfs.length > 0 ? dfs.reduce((sum, p) => sum + p.overall, 0) / dfs.length : 50;
  const mfAvg = mfs.length > 0 ? mfs.reduce((sum, p) => sum + p.overall, 0) / mfs.length : 50;
  const fwAvg = fws.length > 0 ? fws.reduce((sum, p) => sum + p.overall, 0) / fws.length : 50;

  // Apply tactical modifiers
  let gkMod = 1.0;
  let dfMod = 1.0;
  let mfMod = 1.0;
  let fwMod = 1.0;

  // Tactics styles: 'defensiv' | 'konter' | 'ausgeglichen' | 'ballbesitz' | 'offensiv' | 'brechstange'
  switch (team.tactics.style) {
    case 'defensiv':
      dfMod = 1.15;
      mfMod = 0.95;
      fwMod = 0.85;
      break;
    case 'konter':
      dfMod = 1.10;
      mfMod = 0.90;
      fwMod = 1.05; // Quick counter attack
      break;
    case 'ballbesitz':
      dfMod = 1.0;
      mfMod = 1.15; // Midfield control
      fwMod = 0.95;
      break;
    case 'offensiv':
      dfMod = 0.90;
      mfMod = 1.0;
      fwMod = 1.15;
      break;
    case 'brechstange':
      dfMod = 0.75; // Heavy risk
      mfMod = 0.90;
      fwMod = 1.30; // All-out attack
      break;
    case 'ausgeglichen':
    default:
      break;
  }

  // Passing styles: 'kurz' | 'lang' | 'gemischt'
  switch (team.tactics.passing) {
    case 'kurz':
      mfMod *= 1.05; // Helps possession
      break;
    case 'lang':
      fwMod *= 1.05; // Skips midfield, direct to forwards
      mfMod *= 0.95;
      break;
    default:
      break;
  }

  // Aggression modifier (1 to 5)
  // Higher aggression boosts defense and midfield physically, but increases card risks
  const aggBase = team.tactics.aggression; // default is 3
  const aggMultiplier = 1 + (aggBase - 3) * 0.03;
  dfMod *= aggMultiplier;
  mfMod *= (1 + (aggBase - 3) * 0.01);

  // Apply fitness penalty
  const avgFitness = active.reduce((sum, p) => sum + p.fitness, 0) / Math.max(1, active.length);
  const fitnessPenalty = avgFitness / 100;

  return {
    goalkeeping: Math.round(gkAvg * gkMod * fitnessPenalty),
    defense: Math.round(dfAvg * dfMod * fitnessPenalty),
    midfield: Math.round(mfAvg * mfMod * fitnessPenalty),
    attack: Math.round(fwAvg * fwMod * fitnessPenalty)
  };
}

// Commentary databases
const START_COMMENTARIES = [
  "Der Schiedsrichter pfeift an! Das Spiel beginnt.",
  "Die Teams laufen ein. Riesenstimmung im Stadion! Anpfiff!",
  "Der Ball rollt! Hoffen wir auf ein packendes WM-Duell."
];

const NORMAL_PLAY_COMMENTARIES = [
  "Abtasten im Mittelfeld. Beide Teams stehen defensiv sehr kompakt.",
  "Ein ruhiger Spielaufbau. Keine Lücke in Sicht.",
  "Intensives Zweikampfduell an der Außenlinie. Ein echter Abnutzungskampf.",
  "Beide Trainer gestikulieren wild an der Seitenlinie.",
  "Ein Fehlpass im Mittelfeld unterbricht den Angriff."
];

const SHOT_MISSED_COMMENTARIES = [
  "Knapp vorbei! {player} köpft den Ball Zentimeter über die Latte.",
  "Vergeben! Ein strammer Fernschuss von {player} geht links am Pfosten vorbei.",
  "Drüber! {player} probiert es mit Gewalt, jagt den Ball aber auf die Tribüne.",
  "Haarscharf! Ein Schlenzer von {player} küsst das Außennetz."
];

const SHOT_SAVED_COMMENTARIES = [
  "Klasse Parade! {gk} fischt den Ball mit den Fingerspitzen aus dem Winkel.",
  "Glanzparade! {gk} reagiert blitzschnell auf der Linie und begräbt den Ball unter sich.",
  "Kein Problem für {gk}. Der Keeper packt sicher zu.",
  "Der Ball flippert durch den Strafraum, doch {gk} stürzt sich entschlossen dazwischen."
];

const GOAL_COMMENTARIES = [
  "TOR!! {player} zieht aus 16 Metern ab und der Ball schlägt unhaltbar im Eck ein!",
  "TOOOOR! Nach einer präzisen Flanke steht {player} goldrichtig und köpft wuchtig ein!",
  "TOR! Ein sensationeller Sololauf von {player}, der eiskalt am Keeper vorbeischiebt!",
  "TOR! {player} profitiert von einem Abwehrfehler und netzt trocken ein!",
  "UNFASSBAR! Ein Sonntagsschuss von {player} passt genau in den Winkel! Tor!"
];

const CARD_YELLOW_COMMENTARIES = [
  "Gelbe Karte für {player} nach einem taktischen Foul im Mittelfeld.",
  "Der Schiedsrichter zeigt {player} Gelb wegen Meckerns.",
  "Harte Grätsche von {player}. Das gibt völlig zurecht den gelben Karton."
];

const CARD_RED_COMMENTARIES = [
  "ROTE KARTE! Grobes Foulspiel von {player}. Der Schiedsrichter zögert keine Sekunde und schickt ihn vorzeitig duschen!",
  "Gelb-Rot! {player} leistet sich das nächste taktische Foul und fliegt vom Platz!",
  "Tätlichkeit! {player} verliert die Nerven. Glatt Rot!"
];

const INJURY_COMMENTARIES = [
  "Oje, das sieht nicht gut aus. {player} greift sich an den Oberschenkel und muss auf dem Platz behandelt werden.",
  "Verletzung! {player} humpelt vom Feld. Er wird wohl ausgewechselt werden müssen.",
  "Schmerzhaft! {player} hat sich im Zweikampf wehgetan und signalisiert der Bank, dass es nicht weitergeht."
];

// Run a single minute simulation update
export function simulateMinute(
  minute: number,
  homeTeam: Team,
  awayTeam: Team,
  homeScore: number,
  awayScore: number,
  redCardedIds: string[]
): {
  event: MatchEvent | null;
  homeScoreDelta: number;
  awayScoreDelta: number;
  newRedCardId: string | null;
  newInjuryId: string | null;
} {
  let event: MatchEvent | null = null;
  let homeScoreDelta = 0;
  let awayScoreDelta = 0;
  let newRedCardId: string | null = null;
  let newInjuryId: string | null = null;

  const homeActive = getActivePlayers(homeTeam).filter(p => !redCardedIds.includes(p.id));
  const awayActive = getActivePlayers(awayTeam).filter(p => !redCardedIds.includes(p.id));

  // If one team has less than 7 players, they forfeit
  if (homeActive.length < 7 || awayActive.length < 7) {
    const isHomeForfeit = homeActive.length < 7;
    event = {
      minute,
      type: 'text',
      description: isHomeForfeit 
        ? `Abbruch! ${homeTeam.name} hat nicht mehr genügend Spieler auf dem Feld. Strafwertung 0:3.`
        : `Abbruch! ${awayTeam.name} hat nicht mehr genügend Spieler auf dem Feld. Strafwertung 3:0.`
    };
    return {
      event,
      homeScoreDelta: isHomeForfeit ? -homeScore : (3 - homeScore),
      awayScoreDelta: isHomeForfeit ? (3 - awayScore) : -awayScore,
      newRedCardId,
      newInjuryId
    };
  }

  const homeStrengths = calculateTeamStrengths(homeTeam);
  const awayStrengths = calculateTeamStrengths(awayTeam);

  // Check for start, halftime, and fulltime
  if (minute === 1) {
    event = {
      minute,
      type: 'text',
      description: START_COMMENTARIES[Math.floor(Math.random() * START_COMMENTARIES.length)]
    };
    return { event, homeScoreDelta, awayScoreDelta, newRedCardId, newInjuryId };
  }
  if (minute === 45) {
    event = {
      minute,
      type: 'text',
      description: "Halbzeit! Der Schiedsrichter pfeift zur Pause. Spielstand: " + homeScore + ":" + awayScore
    };
    return { event, homeScoreDelta, awayScoreDelta, newRedCardId, newInjuryId };
  }
  if (minute === 46) {
    event = {
      minute,
      type: 'text',
      description: "Die zweite Halbzeit läuft. Keine Wechsel auf beiden Seiten (oder siehe Aufstellung)."
    };
    return { event, homeScoreDelta, awayScoreDelta, newRedCardId, newInjuryId };
  }
  if (minute === 90) {
    event = {
      minute,
      type: 'text',
      description: `Abpfiff! Das Spiel ist aus. Endstand: ${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}.`
    };
    return { event, homeScoreDelta, awayScoreDelta, newRedCardId, newInjuryId };
  }

  // Base event probability per minute (e.g. 10% chance of a meaningful highlight)
  const eventChance = 0.09;
  if (Math.random() > eventChance) {
    // 3% chance of a generic normal play description for flavor
    if (Math.random() < 0.03) {
      event = {
        minute,
        type: 'text',
        description: NORMAL_PLAY_COMMENTARIES[Math.floor(Math.random() * NORMAL_PLAY_COMMENTARIES.length)]
      };
      return { event, homeScoreDelta, awayScoreDelta, newRedCardId, newInjuryId };
    }
    return { event: null, homeScoreDelta, awayScoreDelta, newRedCardId, newInjuryId };
  }

  // Deciding which team has the possession/attack based on Midfield Strength
  const totalMidfield = homeStrengths.midfield + awayStrengths.midfield;
  const homeAttackChance = homeStrengths.midfield / totalMidfield;
  const attackingTeam = Math.random() < homeAttackChance ? 'home' : 'away';

  const attacker = attackingTeam === 'home' ? homeTeam : awayTeam;
  const defender = attackingTeam === 'home' ? awayTeam : homeTeam;
  const attackStr = attackingTeam === 'home' ? homeStrengths.attack : awayStrengths.attack;
  const defenseStr = attackingTeam === 'home' ? awayStrengths.defense : homeStrengths.defense;
  const gkStr = attackingTeam === 'home' ? awayStrengths.goalkeeping : homeStrengths.goalkeeping;

  const attackerActive = attackingTeam === 'home' ? homeActive : awayActive;
  const defenderActive = attackingTeam === 'home' ? awayActive : homeActive;

  // Decide event type: 
  // 70% Shot, 15% Foul/Card, 10% Injury, 5% Offside
  const rand = Math.random();

  if (rand < 0.70) {
    // Attack / Shot
    // Attack Strength vs Defense Strength ratio
    const shotChance = attackStr / (attackStr + defenseStr) * 0.8;
    const attackerPlayers = attackerActive.filter(p => p.position === 'ANG' || p.position === 'MF');
    const shooter = attackerPlayers[Math.floor(Math.random() * attackerPlayers.length)] || attackerActive[0];

    if (Math.random() < shotChance) {
      // Shot on target! Let's check if it's a Goal
      // Shooter's Shooting Skill vs GK Strength
      const shootPower = shooter.skills.shooting + Math.floor(Math.random() * 20);
      const gkPower = gkStr + Math.floor(Math.random() * 20);

      const gkList = defenderActive.filter(p => p.position === 'TW');
      const goalkeeper = gkList[0] || defenderActive[0];

      if (shootPower > gkPower) {
        // GOAL!
        if (attackingTeam === 'home') homeScoreDelta = 1;
        else awayScoreDelta = 1;

        event = {
          minute,
          type: 'goal',
          teamId: attacker.id,
          playerName: shooter.name,
          description: GOAL_COMMENTARIES[Math.floor(Math.random() * GOAL_COMMENTARIES.length)]
            .replace('{player}', shooter.name)
        };
      } else {
        // Saved by Goalkeeper
        event = {
          minute,
          type: 'text',
          teamId: defender.id,
          playerName: goalkeeper.name,
          description: SHOT_SAVED_COMMENTARIES[Math.floor(Math.random() * SHOT_SAVED_COMMENTARIES.length)]
            .replace('{gk}', goalkeeper.name)
        };
      }
    } else {
      // Shot missed target
      event = {
        minute,
        type: 'text',
        teamId: attacker.id,
        playerName: shooter.name,
        description: SHOT_MISSED_COMMENTARIES[Math.floor(Math.random() * SHOT_MISSED_COMMENTARIES.length)]
          .replace('{player}', shooter.name)
      };
    }
  } else if (rand < 0.88) {
    // Foul / Card
    // Decided by defender's aggression
    const defenderAgg = defender.tactics.aggression;
    const cardChance = 0.1 * defenderAgg; // higher aggression = higher chance
    
    const defenderPlayers = defenderActive.filter(p => p.position === 'ABW' || p.position === 'MF');
    const fouler = defenderPlayers[Math.floor(Math.random() * defenderPlayers.length)] || defenderActive[0];

    if (Math.random() < cardChance) {
      const redChance = 0.05 * defenderAgg;
      if (Math.random() < redChance) {
        // Red Card
        newRedCardId = fouler.id;
        event = {
          minute,
          type: 'red',
          teamId: defender.id,
          playerName: fouler.name,
          description: CARD_RED_COMMENTARIES[Math.floor(Math.random() * CARD_RED_COMMENTARIES.length)]
            .replace('{player}', fouler.name)
        };
      } else {
        // Yellow Card
        event = {
          minute,
          type: 'yellow',
          teamId: defender.id,
          playerName: fouler.name,
          description: CARD_YELLOW_COMMENTARIES[Math.floor(Math.random() * CARD_YELLOW_COMMENTARIES.length)]
            .replace('{player}', fouler.name)
        };
      }
    } else {
      event = {
        minute,
        type: 'text',
        description: `Freistoß für ${attacker.name} nach einem Foul von ${fouler.name}. Die Chance verpufft.`
      };
    }
  } else if (rand < 0.96) {
    // Injury
    const allPlayers = [...homeActive, ...awayActive];
    const injured = allPlayers[Math.floor(Math.random() * allPlayers.length)];
    newInjuryId = injured.id;

    event = {
      minute,
      type: 'injury',
      teamId: injured.nationality === homeTeam.name ? homeTeam.id : awayTeam.id,
      playerName: injured.name,
      description: INJURY_COMMENTARIES[Math.floor(Math.random() * INJURY_COMMENTARIES.length)]
        .replace('{player}', injured.name)
    };
  } else {
    // Offside or simple text
    event = {
      minute,
      type: 'text',
      description: `Abseits! Der Linienrichter hebt die Fahne, der Angriff von ${attacker.name} wird abgepfiffen.`
    };
  }

  return { event, homeScoreDelta, awayScoreDelta, newRedCardId, newInjuryId };
}

// Simulates a full match in one go (for background simulation of AI-vs-AI matches)
export function simulateFullMatch(homeTeam: Team, awayTeam: Team, stage: Match['stage'], date: string, dayIndex: number): Match {
  let homeScore = 0;
  let awayScore = 0;
  const events: MatchEvent[] = [];
  const redCardedIds: string[] = [];
  const injuredIds: string[] = [];

  // Copy team tactics to not mutate original
  const homeTeamCopy: Team = JSON.parse(JSON.stringify(homeTeam));
  const awayTeamCopy: Team = JSON.parse(JSON.stringify(awayTeam));

  // Run 90 minutes
  for (let m = 1; m <= 90; m++) {
    const { event, homeScoreDelta, awayScoreDelta, newRedCardId, newInjuryId } = simulateMinute(
      m,
      homeTeamCopy,
      awayTeamCopy,
      homeScore,
      awayScore,
      redCardedIds
    );

    if (event) {
      events.push(event);
      // Handle forfait in background simulation
      if (event.description.includes("Abbruch!")) {
        homeScore += homeScoreDelta;
        awayScore += awayScoreDelta;
        break;
      }
    }

    homeScore += homeScoreDelta;
    awayScore += awayScoreDelta;

    if (newRedCardId) {
      redCardedIds.push(newRedCardId);
    }
    if (newInjuryId) {
      injuredIds.push(newInjuryId);
      // AI automatically substitutes injured player if they have backups
      const teamId = homeTeam.players.some(p => p.id === newInjuryId) ? 'home' : 'away';
      const team = teamId === 'home' ? homeTeamCopy : awayTeamCopy;
      const activeLineup = team.lineup;
      const playerIndex = activeLineup.indexOf(newInjuryId);

      if (playerIndex !== -1) {
        // Mark player in original state as injured
        const injuredPlayer = team.players.find(p => p.id === newInjuryId);
        if (injuredPlayer) injuredPlayer.injuryWeeks = 1 + Math.floor(Math.random() * 3);

        // Find a healthy backup in the same position
        const backup = team.players.find(p => 
          p.position === injuredPlayer?.position && 
          !activeLineup.includes(p.id) && 
          p.injuryWeeks === 0 && 
          !redCardedIds.includes(p.id)
        );

        if (backup) {
          activeLineup[playerIndex] = backup.id;
          events.push({
            minute: m,
            type: 'text',
            description: `Wechsel bei ${team.name}: ${backup.name} kommt für den verletzten ${injuredPlayer?.name}.`
          });
        }
      }
    }
  }

  // Resolve penalty shootout if it's a knockout match and there is a draw
  const isKnockout = !stage.startsWith('Gruppe');
  if (isKnockout && homeScore === awayScore) {
    // Simulating penalties
    events.push({
      minute: 90,
      type: 'text',
      description: "Verlängerung entfällt! Es geht direkt ins Elfmeterschießen!"
    });

    let homePens = 0;
    let awayPens = 0;
    let penRound = 1;

    // Simulate standard 5 rounds
    while (penRound <= 5 || (homePens === awayPens)) {
      // Home shot
      const homeGoal = Math.random() < 0.75;
      if (homeGoal) homePens++;
      events.push({
        minute: 90 + penRound,
        type: 'text',
        description: `Elfmeterschießen: ${homeTeam.name} ${homeGoal ? "trifft!" : "verschießt!"} (${homePens}:${awayPens})`
      });

      // Away shot
      const awayGoal = Math.random() < 0.75;
      if (awayGoal) awayPens++;
      events.push({
        minute: 90 + penRound,
        type: 'text',
        description: `Elfmeterschießen: ${awayTeam.name} ${awayGoal ? "trifft!" : "verschießt!"} (${homePens}:${awayPens})`
      });

      // Break if someone wins after round 5
      if (penRound >= 5 && homePens !== awayPens) {
        break;
      }
      penRound++;
    }

    events.push({
      minute: 95,
      type: 'text',
      description: `Entscheidung im Elfmeterschießen! ${homePens > awayPens ? homeTeam.name : awayTeam.name} gewinnt.`
    });

    if (homePens > awayPens) {
      homeScore += 1; // Represent knockout win
    } else {
      awayScore += 1;
    }
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeScore,
    awayScore,
    played: true,
    stage,
    events,
    date,
    dayIndex
  };
}
