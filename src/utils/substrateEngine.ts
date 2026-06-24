import { Player, Team, Match, MatchEvent, PlayerPosition, TeamTactics } from '../types';

// Deterministic PCG32 PRNG Implementation
export class Pcg32 {
  private state: bigint;
  private inc: bigint;

  constructor(seed: bigint) {
    this.state = BigInt.asUintN(64, seed);
    this.inc = 1n;
  }

  // Returns a float value in the range [0.0, 1.0)
  nextFloat(): number {
    const oldstate = this.state;
    // LCG step
    this.state = BigInt.asUintN(64, oldstate * 6364136223846793005n + this.inc);
    // Xorshift & Rot
    const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) & 0xffffffff;
    const rot = Number(BigInt.asUintN(64, oldstate) >> 59n);
    const u32 = ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
    return u32 / 4294967296;
  }

  // Returns integer in range [min, max] inclusive
  nextInt(min: number, max: number): number {
    const f = this.nextFloat();
    return min + Math.floor(f * (max - min + 1));
  }
}

// 2D Vector definition for agent simulation
export interface Vector2D {
  x: number;
  y: number;
}

// Player biomechanical state inside the simulation (SoA wrapper mapping)
export interface SubstratePlayerState {
  id: string;
  name: string;
  position: PlayerPosition;
  teamId: string;
  x: number;          // 2D X on field (0 - 105)
  y: number;          // 2D Y on field (0 - 68)
  atp: number;        // Biomechanical ATP-CP (0 - 100)
  glycogen: number;   // Biomechanical Glycogen (0 - 100)
  aerobic: number;    // Base recovery aerobic capacity
  speedCap: number;   // Max speed multiplier based on energy (0.35 - 1.0)
  overall: number;
  shooting: number;
  passing: number;
  defending: number;
  goalkeeping: number;
}

// 1. Biomechanical Metabolism Differential Integration (ATP/Glycogen)
// dt is in seconds (typically 5 seconds per tick in our engine)
export function integrateMetabolism(
  player: SubstratePlayerState,
  isSprinting: boolean,
  dt: number
): { atp: number; glycogen: number; speedCap: number } {
  let atp = player.atp;
  let glycogen = player.glycogen;
  const aerobic = player.aerobic;

  if (isSprinting) {
    // Sprinting uses ATP rapidly (anaerobic phosphagen system)
    const atpDepletionRate = 7.5; // d(ATP)/dt
    atp = Math.max(0, atp - atpDepletionRate * dt);

    // Glycogen begins to break down anaerobically
    const glycogenDepletionRate = 1.8; // d(Glycogen)/dt
    glycogen = Math.max(0, glycogen - glycogenDepletionRate * dt);
  } else {
    // Recovery: Aerobic system regenerates ATP
    // Rate is proportional to aerobic capacity. If glycogen is empty, recovery is halved (fatigue)
    const glycogenMultiplier = glycogen > 0 ? 1.0 : 0.4;
    const atpRecoveryRate = (1.5 + (aerobic / 100) * 2.0) * glycogenMultiplier;
    atp = Math.min(100, atp + atpRecoveryRate * dt);

    // Glycogen recovers extremely slowly during active play
    glycogen = Math.min(100, glycogen + 0.1 * dt);
  }

  // If ATP is depleted, player's max speed is capped (emergent walk/jog behavior)
  let speedCap = 1.0;
  if (atp < 15) {
    speedCap = 0.35; // Player is exhausted, cannot sprint
  } else if (atp < 40) {
    speedCap = 0.70; // Moderately fatigued
  }

  return { atp, glycogen, speedCap };
}

// 2. Vektor-Feld Multi-Agent Pitch Simulation (105m x 68m)
// Returns the target formation coordinates on the field
export function getFormationCentroid(
  playerPosType: PlayerPosition,
  indexInPos: number,
  formation: TeamTactics['formation'],
  isHome: boolean
): Vector2D {
  // Field dimensions: Home attacks Left-to-Right (X: 0 -> 105), Away Left-to-Right (X: 105 -> 0)
  // We define standard positions for Home team (X: 0 to 105, Y: 0 to 68)
  let targetX = 52.5;
  let targetY = 34.0;

  if (playerPosType === 'TW') {
    targetX = 5.0;
    targetY = 34.0;
  } else if (playerPosType === 'ABW') {
    targetX = 25.0;
    // Simple vertical distribution
    if (indexInPos === 0) targetY = 12.0; // LV
    else if (indexInPos === 1) targetY = 26.0; // IV L
    else if (indexInPos === 2) targetY = 42.0; // IV R
    else if (indexInPos === 3) targetY = 56.0; // RV
    else targetY = 34.0; // 5th Defender
  } else if (playerPosType === 'MF') {
    targetX = 50.0;
    if (indexInPos === 0) targetY = 15.0; // LM
    else if (indexInPos === 1) targetY = 30.0; // ZM L
    else if (indexInPos === 2) targetY = 38.0; // ZM R
    else if (indexInPos === 3) targetY = 53.0; // RM
    else targetY = 34.0;
  } else if (playerPosType === 'ANG') {
    targetX = 75.0;
    if (indexInPos === 0) targetY = 24.0; // ST L
    else if (indexInPos === 1) targetY = 44.0; // ST R
    else targetY = 34.0;
  }

  // Adjust for Formation variations
  if (formation === '4-3-3') {
    if (playerPosType === 'MF') {
      targetX = 48.0;
      if (indexInPos === 1) { targetX = 40.0; targetY = 34.0; } // DM
    } else if (playerPosType === 'ANG') {
      targetX = 78.0;
      if (indexInPos === 0) { targetX = 74.0; targetY = 15.0; } // LF
      if (indexInPos === 1) { targetX = 82.0; targetY = 34.0; } // ST
      if (indexInPos === 2) { targetX = 74.0; targetY = 53.0; } // RF
    }
  } else if (formation === '3-5-2') {
    if (playerPosType === 'ABW') {
      targetX = 22.0;
      if (indexInPos === 0) targetY = 18.0;
      if (indexInPos === 1) targetY = 34.0;
      if (indexInPos === 2) targetY = 50.0;
    } else if (playerPosType === 'MF') {
      targetX = 52.0;
      if (indexInPos === 0) { targetX = 48.0; targetY = 10.0; } // LM
      if (indexInPos === 4) { targetX = 48.0; targetY = 58.0; } // RM
    }
  } else if (formation === '5-3-2') {
    if (playerPosType === 'ABW') {
      targetX = 20.0;
      if (indexInPos === 0) { targetX = 25.0; targetY = 10.0; } // LWB
      if (indexInPos === 4) { targetX = 25.0; targetY = 58.0; } // RWB
    } else if (playerPosType === 'MF') {
      targetX = 48.0;
    }
  }

  // If Away team, invert X coordinate (attacks in opposite direction)
  if (!isHome) {
    targetX = 105.0 - targetX;
    targetY = 68.0 - targetY;
  }

  return { x: targetX, y: targetY };
}

// Simulate an entire match deterministically using 2D physical vector fields
export function simulateSubstrateMatch(
  homeTeam: Team,
  awayTeam: Team,
  stage: Match['stage'],
  date: string,
  dayIndex: number,
  startMinute = 1,
  currentHomeScore = 0,
  currentAwayScore = 0,
  initialEvents: MatchEvent[] = [],
  redCardedIds: string[] = []
): Match {
  // Generate deterministic seed for PCG32
  // Hash combining Team IDs, Stage, DayIndex
  const hashString = homeTeam.id + awayTeam.id + stage + dayIndex;
  let seedValue = 12345n;
  for (let i = 0; i < hashString.length; i++) {
    seedValue = seedValue * 31n + BigInt(hashString.charCodeAt(i));
  }
  const prng = new Pcg32(seedValue);

  // Initialize flat Structure-of-Arrays (SoA) memory buffer
  // We represent 22 players on the pitch: index 0-10 Home, 11-21 Away
  const totalPlayers = 22;
  const playerStates: SubstratePlayerState[] = [];

  const initSquad = (team: Team, isHome: boolean) => {
    const active = team.players.filter(p => team.lineup.includes(p.id));
    // Sort to align with coordinate indices
    const gks = active.filter(p => p.position === 'TW');
    const dfs = active.filter(p => p.position === 'ABW');
    const mfs = active.filter(p => p.position === 'MF');
    const fws = active.filter(p => p.position === 'ANG');

    const ordered = [...gks, ...dfs, ...mfs, ...fws].slice(0, 11);
    
    // In case squad is incomplete, pad it
    while (ordered.length < 11) {
      ordered.push(team.players[0]);
    }

    ordered.forEach((p, index) => {
      // Find position index counts
      const posType = p.position;
      let posIdx = 0;
      if (posType === 'ABW') posIdx = dfs.indexOf(p);
      else if (posType === 'MF') posIdx = mfs.indexOf(p);
      else if (posType === 'ANG') posIdx = fws.indexOf(p);

      const centroid = getFormationCentroid(posType, posIdx, team.tactics.formation, isHome);

      playerStates.push({
        id: p.id,
        name: p.name,
        position: posType,
        teamId: team.id,
        x: centroid.x,
        y: centroid.y,
        atp: 100.0,
        glycogen: 100.0,
        aerobic: p.skills ? p.skills.physical : p.overall, // use physical skill as aerobic base
        speedCap: 1.0,
        overall: p.overall,
        shooting: p.skills ? p.skills.shooting : p.overall,
        passing: p.skills ? p.skills.passing : p.overall,
        defending: p.skills ? p.skills.defending : p.overall,
        goalkeeping: p.skills ? p.skills.goalkeeping : p.overall
      });
    });
  };

  initSquad(homeTeam, true);
  initSquad(awayTeam, false);

  // Ball physical properties
  let ballX = 52.5;
  let ballY = 34.0;
  let ballVx = 0.0;
  let ballVy = 0.0;
  let ballPossessorIdx: number | null = null; // index 0-21, or null if loose ball

  let homeScore = currentHomeScore;
  let awayScore = currentAwayScore;
  const events: MatchEvent[] = [...initialEvents];
  const activeRedCardedIds: string[] = [...redCardedIds];

  const dt = 5; // 5-second ticks (12 ticks per minute)
  const totalMinutes = 90;
  const totalTicks = totalMinutes * 12;
  const startTick = (startMinute - 1) * 12 + 1;

  if (startMinute === 1) {
    events.push({
      minute: 1,
      type: 'text',
      description: `Anpfiff! Das Spiel zwischen ${homeTeam.name} und ${awayTeam.name} ist freigegeben.`
    });
  }

  // Main physical simulation loop
  for (let tick = 1; tick <= totalTicks; tick++) {
    const minute = Math.ceil(tick / 12);
    const tickOfMinute = tick % 12;
    const isPastStart = tick >= startTick;

    // 1. Update Player Positions using Vector Fields
    for (let i = 0; i < totalPlayers; i++) {
      const p = playerStates[i];
      const isHome = i < 11;
      const team = isHome ? homeTeam : awayTeam;
      
      if (activeRedCardedIds.includes(p.id)) continue;

      // Centroid base
      const posType = p.position;
      const activeList = playerStates.slice(isHome ? 0 : 11, isHome ? 11 : 22);
      const posIdx = activeList.filter(x => x.position === posType && !activeRedCardedIds.includes(x.id)).indexOf(p);
      const baseCentroid = getFormationCentroid(posType, Math.max(0, posIdx), team.tactics.formation, isHome);

      // Playstyle shifts
      // 'defensiv' | 'konter' | 'ausgeglichen' | 'ballbesitz' | 'offensiv' | 'brechstange'
      let shiftX = 0;
      if (team.tactics.style === 'offensiv') shiftX = isHome ? 12 : -12;
      else if (team.tactics.style === 'brechstange') shiftX = isHome ? 25 : -25;
      else if (team.tactics.style === 'defensiv') shiftX = isHome ? -12 : 12;

      const tacticalTarget: Vector2D = {
        x: Math.max(2, Math.min(103, baseCentroid.x + shiftX)),
        y: baseCentroid.y
      };

      // VECTORS
      // A. Vector towards tactical centroid
      const vecTac = { x: tacticalTarget.x - p.x, y: tacticalTarget.y - p.y };
      const distTac = Math.sqrt(vecTac.x * vecTac.x + vecTac.y * vecTac.y) || 1;

      // B. Vector towards ball
      const vecBall = { x: ballX - p.x, y: ballY - p.y };
      const distBall = Math.sqrt(vecBall.x * vecBall.x + vecBall.y * vecBall.y) || 1;

      // Determine weights based on position
      let wTac = 0.6;
      let wBall = 0.4;
      
      // Goalkeeper stays near goal
      if (p.position === 'TW') {
        wTac = 0.95;
        wBall = 0.05;
      } else if (p.position === 'ABW') {
        // Defenders only chase if ball is in their quarter
        const inDefZone = isHome ? (ballX < 45) : (ballX > 60);
        if (!inDefZone) {
          wTac = 0.9;
          wBall = 0.1;
        }
      } else if (p.position === 'ANG') {
        wTac = 0.3;
        wBall = 0.7;
      }

      // Check if player is sprinting
      // Sprinting if chasing ball closely (< 15m) or carrying the ball
      const isCloseToBall = distBall < 15.0;
      const isCarryingBall = ballPossessorIdx === i;
      const isSprinting = (isCloseToBall || isCarryingBall) && p.position !== 'TW';

      // Integrate metabolism
      const { atp, glycogen, speedCap } = integrateMetabolism(p, isSprinting, dt);
      p.atp = atp;
      p.glycogen = glycogen;
      p.speedCap = speedCap;

      // Max speed (OVR affects base, speedCap affects fatigue)
      const baseMaxSpeed = 3.0 + (p.overall / 100) * 2.5; // m/s
      const currentSpeed = baseMaxSpeed * speedCap;

      // Combined force vector
      const fx = (vecTac.x / distTac) * wTac + (vecBall.x / distBall) * wBall;
      const fy = (vecTac.y / distTac) * wTac + (vecBall.y / distBall) * wBall;
      const fLen = Math.sqrt(fx * fx + fy * fy) || 1;

      // Update coordinate
      const deltaX = (fx / fLen) * currentSpeed * dt * 0.4; // scale multiplier
      const deltaY = (fy / fLen) * currentSpeed * dt * 0.4;

      p.x = Math.max(0, Math.min(105, p.x + deltaX));
      p.y = Math.max(0, Math.min(68, p.y + deltaY));
    }

    // 2. Ball Simulation
    if (ballPossessorIdx !== null) {
      // Ball is carried by player
      const possessor = playerStates[ballPossessorIdx];
      ballX = possessor.x;
      ballY = possessor.y;
      ballVx = 0;
      ballVy = 0;

      // Action logic for possessor (1 tick is 5s)
      // Check shooting or passing
      const isPossessorHome = ballPossessorIdx < 11;
      const distToOpponentGoal = isPossessorHome 
        ? Math.sqrt((105 - ballX) * (105 - ballX) + (34 - ballY) * (34 - ballY))
        : Math.sqrt((0 - ballX) * (0 - ballX) + (34 - ballY) * (34 - ballY));

      const shootingRange = 26.0;
      
      if (distToOpponentGoal < shootingRange && prng.nextFloat() < 0.40) {
        // SHOOT!
        const goalTargetX = isPossessorHome ? 105.0 : 0.0;
        const goalTargetY = 34.0 + prng.nextInt(-3, 3); // target goal center

        const dx = goalTargetX - ballX;
        const dy = goalTargetY - ballY;
        const dLen = Math.sqrt(dx * dx + dy * dy) || 1;

        // Kick ball towards goal
        ballVx = (dx / dLen) * 18.0; // m/s ball speed
        ballVy = (dy / dLen) * 18.0;
        ballPossessorIdx = null; // Ball is free

        // Calculate if it's a Goal or Save
        const oppGkIdx = isPossessorHome ? 11 : 0;
        const gk = playerStates[oppGkIdx];

        const shootRating = possessor.shooting + prng.nextInt(-15, 20);
        const gkRating = gk.goalkeeping + prng.nextInt(-10, 25);

        if (tickOfMinute === 0 && isPastStart) { // Limit logs to prevent overflow
          events.push({
            minute,
            type: 'text',
            description: `${possessor.name} zieht aus der Distanz ab!`
          });
        }

        if (shootRating > gkRating) {
          // GOAL!
          if (isPastStart) {
            if (isPossessorHome) homeScore++;
            else awayScore++;

            events.push({
              minute,
              type: 'goal',
              teamId: isPossessorHome ? homeTeam.id : awayTeam.id,
              playerName: possessor.name,
              description: `TOR! ${possessor.name} überwindet den Keeper mit einem wuchtigen Schuss ins Eck! (${homeScore}:${awayScore})`
            });
          }

          // Reset to kickoff
          ballX = 52.5;
          ballY = 34.0;
          ballVx = 0;
          ballVy = 0;
        } else {
          // Saved
          if (isPastStart) {
            events.push({
              minute,
              type: 'text',
              description: `Starke Parade! ${gk.name} lenkt den Ball ins Toraus.`
            });
          }
          // Kick corners / resets
          ballX = isPossessorHome ? 105.0 : 0.0;
          ballY = prng.nextFloat() < 0.5 ? 0.0 : 68.0;
        }
      } else {
        // PASS!
        const teammates = isPossessorHome 
          ? playerStates.slice(0, 11).filter((_, idx) => idx !== ballPossessorIdx && !activeRedCardedIds.includes(_.id))
          : playerStates.slice(11, 22).filter((_, idx) => idx !== (ballPossessorIdx! - 11) && !activeRedCardedIds.includes(_.id));

        // Find best teammate (open space)
        let bestTeammate = teammates[0];
        let maxOpenness = -9999;

        for (const tm of teammates) {
          // Openness = distance to nearest opponent
          const opponents = isPossessorHome 
            ? playerStates.slice(11, 22).filter(_ => !activeRedCardedIds.includes(_.id))
            : playerStates.slice(0, 11).filter(_ => !activeRedCardedIds.includes(_.id));
          
          let minDist = 9999;
          for (const opp of opponents) {
            const d = Math.sqrt((opp.x - tm.x) * (opp.x - tm.x) + (opp.y - tm.y) * (opp.y - tm.y));
            if (d < minDist) minDist = d;
          }

          if (minDist > maxOpenness) {
            maxOpenness = minDist;
            bestTeammate = tm;
          }
        }

        // Kick pass
        const dx = bestTeammate.x - ballX;
        const dy = bestTeammate.y - ballY;
        const dLen = Math.sqrt(dx * dx + dy * dy) || 1;

        ballVx = (dx / dLen) * 12.0; // pass speed
        ballVy = (dy / dLen) * 12.0;
        ballPossessorIdx = null; // Ball is free
      }
    } else {
      // Ball is moving freely
      ballX += ballVx * dt * 0.15;
      ballY += ballVy * dt * 0.15;
      
      // Decelerate ball slightly
      ballVx *= 0.85;
      ballVy *= 0.85;

      // Ball boundaries
      if (ballX < 0 || ballX > 105 || ballY < 0 || ballY > 68) {
        // Out of bounds - Reset ball to nearest player
        const randPlayerIdx = prng.nextInt(0, 21);
        ballPossessorIdx = activeRedCardedIds.includes(playerStates[randPlayerIdx].id) ? 0 : randPlayerIdx;
      }

      // Check intercept
      for (let i = 0; i < totalPlayers; i++) {
        if (activeRedCardedIds.includes(playerStates[i].id)) continue;
        const dx = playerStates[i].x - ballX;
        const dy = playerStates[i].y - ballY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2.0) {
          ballPossessorIdx = i; // Intercepted!
          break;
        }
      }
    }

    // 3. Random Match Events (cards, injuries)
    if (prng.nextFloat() < 0.005) { // 0.5% chance per tick of cards/injuries
      const randomPlayerIdx = prng.nextInt(0, 21);
      const targetPlayer = playerStates[randomPlayerIdx];
      const isHome = randomPlayerIdx < 11;
      
      if (!activeRedCardedIds.includes(targetPlayer.id)) {
        const eventRand = prng.nextFloat();
        if (eventRand < 0.6) {
          // Yellow card
          if (isPastStart) {
            events.push({
              minute,
              type: 'yellow',
              teamId: isHome ? homeTeam.id : awayTeam.id,
              playerName: targetPlayer.name,
              description: `Gelbe Karte für ${targetPlayer.name} nach einem taktischen Halten.`
            });
          }
        } else if (eventRand < 0.8) {
          // Red card
          activeRedCardedIds.push(targetPlayer.id);
          if (isPastStart) {
            events.push({
              minute,
              type: 'red',
              teamId: isHome ? homeTeam.id : awayTeam.id,
              playerName: targetPlayer.name,
              description: `ROTE KARTE! ${targetPlayer.name} sieht glatt Rot nach einer brutalen Grätsche!`
            });
          }
        } else {
          // Injury
          if (isPastStart) {
            events.push({
              minute,
              type: 'injury',
              teamId: isHome ? homeTeam.id : awayTeam.id,
              playerName: targetPlayer.name,
              description: `Verletzung! ${targetPlayer.name} muss das Feld humpelnd verlassen.`
            });
          }
        }
      }
    }

    // Halftime / Fulltime tick overrides
    if (tick === totalTicks / 2 && startMinute <= 45) {
      events.push({
        minute: 45,
        type: 'text',
        description: `Halbzeit! Der Schiedsrichter pfeift ab. Spielstand: ${homeTeam.name} ${homeScore}:${awayScore} ${awayTeam.name}`
      });
      // reset ball position
      ballX = 52.5;
      ballY = 34.0;
      ballPossessorIdx = null;
    }
  }

  // Knockout resolving
  const isKnockout = !stage.startsWith('Gruppe');
  if (isKnockout && homeScore === awayScore && startMinute <= 90) {
    events.push({
      minute: 90,
      type: 'text',
      description: "Unentschieden nach 90 Minuten! Das Elfmeterschießen entscheidet."
    });
    // Deterministisches Elfmeterschießen
    let homePens = 0;
    let awayPens = 0;
    let round = 1;
    while (round <= 5 || homePens === awayPens) {
      const homeScores = prng.nextFloat() < 0.75;
      if (homeScores) homePens++;
      
      const awayScores = prng.nextFloat() < 0.75;
      if (awayScores) awayPens++;
      
      if (round >= 5 && homePens !== awayPens) break;
      round++;
    }
    events.push({
      minute: 90,
      type: 'text',
      description: `Entscheidung im Elfmeterschießen! ${homePens > awayPens ? homeTeam.name : awayTeam.name} gewinnt.`
    });
    if (homePens > awayPens) homeScore++;
    else awayScore++;
  }

  if (startMinute <= 90) {
    events.push({
      minute: 90,
      type: 'text',
      description: `Abpfiff! Das Spiel ist aus. Endstand: ${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}.`
    });
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

// CCQ4 Matrix Engine Decision Maker for KI Transfers
// Returns an match rating (float) for a candidate player
export function evaluateKiPlayerCCQ(team: Team, player: Player): number {
  // Candidate vector: [OVR, Age, Value, PositionWeight]
  const ovrNormalized = player.overall / 100;
  const ageNormalized = (38 - player.age) / 20; // younger = higher rating
  const valueNormalized = player.value / 100000000; // relative to 100M
  
  let posWeight = 0.5;
  // If team has fewer players in candidate's position, prioritize it
  const posCount = team.players.filter(p => p.position === player.position).length;
  if (posCount < 3) posWeight = 0.9;
  else if (posCount > 5) posWeight = 0.2;

  const candidateVector = [ovrNormalized, ageNormalized, valueNormalized, posWeight];

  // ccqMatrix size 4x4
  // We compute the scalar product: Matrix * Vector
  // We sum the product of candidate vector and CCQ weights
  let score = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      score += candidateVector[c] * team.ccqMatrix[r][c];
    }
  }

  return score;
}

// Generate a random 4x4 matrix for KI team strategic tendencies
export function generateRandomCCQMatrix(prng: Pcg32): number[][] {
  const matrix: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const row = [];
    for (let j = 0; j < 4; j++) {
      row.push(prng.nextFloat() * 0.5); // weights between 0.0 and 0.5
    }
    matrix.push(row);
  }
  return matrix;
}
