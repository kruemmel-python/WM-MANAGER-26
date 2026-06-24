import { generateInitialTeams } from './src/data/playerDatabase';
import { simulateSubstrateMatch, Pcg32, integrateMetabolism, evaluateKiPlayerCCQ, SubstratePlayerState } from './src/utils/substrateEngine';
import { verifyStateLedger, appendLedgerEvent, xorNumber, generateActionToken } from './src/utils/cryptoLedger';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== RUNNING SUBSTRAT ENGINE UNIT TESTS ===");

// Test 1: PCG32 & Match Determinism
console.log("Testing PCG32 & Match Determinism...");
const initialTeams = generateInitialTeams();
const teamHome = initialTeams.find(t => t.id === 'GER')!;
const teamAway = initialTeams.find(t => t.id === 'FRA')!;

const match1 = simulateSubstrateMatch(teamHome, teamAway, 'Finale', '2026-07-19', 15);
const match2 = simulateSubstrateMatch(teamHome, teamAway, 'Finale', '2026-07-19', 15);

assert(match1.homeScore === match2.homeScore, "Deterministic home scores do not match");
assert(match1.awayScore === match2.awayScore, "Deterministic away scores do not match");
assert(match1.events.length === match2.events.length, "Event counts do not match");
for (let i = 0; i < match1.events.length; i++) {
  assert(match1.events[i].description === match2.events[i].description, `Event ${i} descriptions do not match`);
}
console.log("✓ PCG32 & Match Determinism Passed!");

// Test 2: Biomechanical Metabolism (ATP / Glykogen)
console.log("Testing Biomechanical Metabolism Integration...");
const player: SubstratePlayerState = {
  id: "p1",
  name: "Test Player",
  position: "ANG",
  teamId: "GER",
  x: 50,
  y: 34,
  atp: 100.0,
  glycogen: 100.0,
  aerobic: 80.0,
  speedCap: 1.0,
  overall: 80,
  shooting: 80,
  passing: 80,
  defending: 80,
  goalkeeping: 50
};

// Sprinting: ATP and Glykogen must drop
const sprintStep = integrateMetabolism(player, true, 5.0); // 5s tick
assert(sprintStep.atp < 100.0, "ATP did not deplete during sprinting");
assert(sprintStep.glycogen < 100.0, "Glycogen did not deplete during sprinting");

// Capped speed when ATP drops below 15 during sprint
const lowAtpPlayer = { ...player, atp: 12.0 };
const sprintDepletedStep = integrateMetabolism(lowAtpPlayer, true, 1.0); // 1s tick, drops to 4.5
assert(sprintDepletedStep.atp < 15.0, "ATP should be below 15");
assert(sprintDepletedStep.speedCap === 0.35, "Player speed should be capped when ATP is depleted (<15)");

// Recovering: ATP must recover
const recoveryPlayer = { ...player, atp: 10.0, glycogen: 50.0 };
const recoveryStep = integrateMetabolism(recoveryPlayer, false, 5.0);
assert(recoveryStep.atp > 10.0, "ATP did not recover during rest");
console.log("✓ Biomechanical Metabolism Passed!");

// Test 3: Cryptographic Merkle State Ledger Chaining
console.log("Testing Cryptographic Append-Only State Ledger...");
let ledger: any[] = [];
let hash1Obj = appendLedgerEvent(ledger, 'init', { userTeamId: 'GER' });
ledger = hash1Obj.ledger;

let hash2Obj = appendLedgerEvent(ledger, 'day_advance', { dayIndex: 1 });
ledger = hash2Obj.ledger;

// Verify valid ledger
assert(verifyStateLedger(ledger) === true, "Valid ledger returned false during verification");

// Mutate ledger (simulate hacking / DevTools bypass)
const mutatedLedger = JSON.parse(JSON.stringify(ledger));
mutatedLedger[0].payload = JSON.stringify({ userTeamId: 'FRA' }); // change team from GER to FRA

// Verify invalid ledger
assert(verifyStateLedger(mutatedLedger) === false, "Mutated ledger returned true during verification! Security breach!");
console.log("✓ Cryptographic State Ledger Passed!");

// Test 4: Memory Obfuscation
console.log("Testing Memory Obfuscation...");
const originalBudget = 60000000;
const obfuscated = xorNumber(originalBudget);
assert(obfuscated !== originalBudget, "Obfuscation did not change budget value");
assert(xorNumber(obfuscated) === originalBudget, "Symmetric XOR did not decode budget correctly");
assert((obfuscated ^ 0x5E3A9C7B) === originalBudget, "XOR mask is not 0x5E3A9C7B");
console.log("✓ Memory Obfuscation Passed!");

// Test 5: KI-Kognitionsmatrix (CCQ-Matrix)
console.log("Testing KI strategic decisions (CCQ-Matrix)...");
const testPlayerObj = teamAway.players[0];
const kiRating = evaluateKiPlayerCCQ(teamHome, testPlayerObj);
assert(typeof kiRating === 'number' && !isNaN(kiRating), "CCQ evaluation did not return a valid number");
console.log("✓ CCQ-Matrix Passed!");

// Test 6: Differential Execution Validation (Action Tokens)
console.log("Testing Action Tokens...");
const token = generateActionToken("advance_day", 5);
const valid = token === generateActionToken("advance_day", 5);
const invalid = token === generateActionToken("advance_day", 6);
assert(valid === true, "Valid action token failed validation");
assert(invalid === false, "Invalid action token passed validation");
console.log("✓ Action Tokens Passed!");

console.log("\nALL 6 SUBSTRATE SUB-SYSTEM TESTS PASSED SUCCESSFULLY!");
