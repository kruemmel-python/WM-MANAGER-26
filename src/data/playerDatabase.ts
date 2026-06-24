import { Player, Team, PlayerPosition, PlayerSkills, TeamTactics } from '../types';
import { xorNumber } from '../utils/cryptoLedger';
import { Pcg32, generateRandomCCQMatrix } from '../utils/substrateEngine';

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Custom generator for player skills based on position and overall rating
export function generateSkills(position: PlayerPosition, overall: number): PlayerSkills {
  const base = overall;
  const spread = 8;
  const randomFactor = () => Math.floor(Math.random() * spread) - spread / 2;

  const high = () => Math.min(99, Math.max(30, base + 10 + randomFactor()));
  const med = () => Math.min(99, Math.max(30, base + randomFactor()));
  const low = () => Math.min(99, Math.max(30, base - 15 + randomFactor()));

  switch (position) {
    case 'TW':
      return {
        goalkeeping: high(),
        physical: med(),
        passing: med(),
        shooting: low(),
        defending: low()
      };
    case 'ABW':
      return {
        defending: high(),
        physical: med(),
        passing: med(),
        shooting: low(),
        goalkeeping: low()
      };
    case 'MF':
      return {
        passing: high(),
        physical: med(),
        shooting: med(),
        defending: med(),
        goalkeeping: low()
      };
    case 'ANG':
      return {
        shooting: high(),
        physical: med(),
        passing: med(),
        defending: low(),
        goalkeeping: low()
      };
  }
}

// Calculate player value based on overall, age and position
function calculateValueAndSalary(overall: number, age: number): { value: number; salary: number } {
  // Value curve
  let multiplier = 1.0;
  if (age < 23) multiplier = 1.3; // Youth premium
  else if (age > 30) multiplier = Math.max(0.3, 1.0 - (age - 30) * 0.15); // Age penalty

  let baseValue = 0;
  if (overall >= 90) {
    baseValue = 80000000 + (overall - 90) * 15000000;
  } else if (overall >= 85) {
    baseValue = 35000000 + (overall - 85) * 9000000;
  } else if (overall >= 80) {
    baseValue = 12000000 + (overall - 80) * 4600000;
  } else if (overall >= 75) {
    baseValue = 4000000 + (overall - 75) * 1600000;
  } else if (overall >= 70) {
    baseValue = 1000000 + (overall - 70) * 600000;
  } else {
    baseValue = 150000 + (overall - 50) * 35000;
  }

  const value = Math.round(baseValue * multiplier);
  const salary = Math.round((value * 0.002) + (overall * 500)); // Weekly salary approximation

  return { value, salary };
}

interface TeamConfig {
  id: string;
  name: string;
  flag: string;
  group: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  stars: { name: string; position: PlayerPosition; overall: number; age: number }[];
  firstNames: string[];
  lastNames: string[];
}

const TEAMS_CONFIG: TeamConfig[] = [
  {
    id: 'GER',
    name: 'Deutschland',
    flag: '🇩🇪',
    group: 'A',
    stars: [
      { name: 'Florian Wirtz', position: 'MF', overall: 89, age: 23 },
      { name: 'Jamal Musiala', position: 'MF', overall: 89, age: 23 },
      { name: 'Kai Havertz', position: 'ANG', overall: 85, age: 27 },
      { name: 'Leroy Sané', position: 'ANG', overall: 84, age: 30 },
      { name: 'Joshua Kimmich', position: 'ABW', overall: 86, age: 31 },
      { name: 'Antonio Rüdiger', position: 'ABW', overall: 87, age: 33 },
      { name: 'Jonathan Tah', position: 'ABW', overall: 84, age: 30 },
      { name: 'Marc-André ter Stegen', position: 'TW', overall: 87, age: 34 },
      { name: 'Niclas Füllkrug', position: 'ANG', overall: 81, age: 33 },
      { name: 'Robert Andrich', position: 'MF', overall: 82, age: 31 }
    ],
    firstNames: ['Thomas', 'Maximilian', 'Lukas', 'Leon', 'Jonas', 'Emil', 'David', 'Felix', 'Nico', 'Robin'],
    lastNames: ['Müller', 'Schulz', 'Becker', 'Hoffmann', 'Schmid', 'Wagner', 'Fischer', 'Weber', 'Kopf', 'Kramer']
  },
  {
    id: 'FRA',
    name: 'Frankreich',
    flag: '🇫🇷',
    group: 'A',
    stars: [
      { name: 'Kylian Mbappé', position: 'ANG', overall: 92, age: 27 },
      { name: 'Antoine Griezmann', position: 'MF', overall: 87, age: 35 },
      { name: 'Ousmane Dembélé', position: 'ANG', overall: 85, age: 29 },
      { name: 'Aurélien Tchouaméni', position: 'MF', overall: 86, age: 26 },
      { name: 'Eduardo Camavinga', position: 'MF', overall: 84, age: 23 },
      { name: 'William Saliba', position: 'ABW', overall: 89, age: 25 },
      { name: 'Dayot Upamecano', position: 'ABW', overall: 83, age: 27 },
      { name: 'Theo Hernandez', position: 'ABW', overall: 86, age: 28 },
      { name: 'Mike Maignan', position: 'TW', overall: 87, age: 30 }
    ],
    firstNames: ['Lucas', 'Hugo', 'Arthur', 'Mathieu', 'Jules', 'Enzo', 'Pierre', 'Clement', 'Paul', 'Rayan'],
    lastNames: ['Dubois', 'Laurent', 'Moreau', 'Simon', 'Michel', 'Martin', 'Bernard', 'Leroy', 'Petit', 'Gérard']
  },
  {
    id: 'ARG',
    name: 'Argentinien',
    flag: '🇦🇷',
    group: 'B',
    stars: [
      { name: 'Lionel Messi', position: 'ANG', overall: 89, age: 39 },
      { name: 'Julián Álvarez', position: 'ANG', overall: 85, age: 26 },
      { name: 'Lautaro Martínez', position: 'ANG', overall: 88, age: 28 },
      { name: 'Enzo Fernández', position: 'MF', overall: 84, age: 25 },
      { name: 'Alexis Mac Allister', position: 'MF', overall: 86, age: 27 },
      { name: 'Rodrigo De Paul', position: 'MF', overall: 84, age: 32 },
      { name: 'Cristian Romero', position: 'ABW', overall: 87, age: 28 },
      { name: 'Lisandro Martínez', position: 'ABW', overall: 84, age: 28 },
      { name: 'Emiliano Martínez', position: 'TW', overall: 87, age: 33 }
    ],
    firstNames: ['Santiago', 'Mateo', 'Juan', 'Tomas', 'Nicolas', 'Bautista', 'Agustin', 'Franco', 'Lucas', 'Leandro'],
    lastNames: ['Gonzalez', 'Rodriguez', 'Lopez', 'Gomez', 'Diaz', 'Alvarez', 'Fernandez', 'Perez', 'Romero', 'Silva']
  },
  {
    id: 'BRA',
    name: 'Brasilien',
    flag: '🇧🇷',
    group: 'B',
    stars: [
      { name: 'Vinícius Júnior', position: 'ANG', overall: 91, age: 25 },
      { name: 'Rodrygo', position: 'ANG', overall: 86, age: 25 },
      { name: 'Neymar Jr', position: 'ANG', overall: 85, age: 34 },
      { name: 'Bruno Guimarães', position: 'MF', overall: 86, age: 28 },
      { name: 'Lucas Paquetá', position: 'MF', overall: 83, age: 28 },
      { name: 'Marquinhos', position: 'ABW', overall: 86, age: 32 },
      { name: 'Éder Militão', position: 'ABW', overall: 85, age: 28 },
      { name: 'Gabriel Magalhães', position: 'ABW', overall: 86, age: 28 },
      { name: 'Alisson Becker', position: 'TW', overall: 89, age: 33 },
      { name: 'Ederson', position: 'TW', overall: 88, age: 32 }
    ],
    firstNames: ['Lucas', 'Gabriel', 'Mateus', 'Felipe', 'Thiago', 'Pedro', 'Rafael', 'Bruno', 'Arthur', 'Diego'],
    lastNames: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Gomes']
  },
  {
    id: 'ENG',
    name: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    group: 'C',
    stars: [
      { name: 'Harry Kane', position: 'ANG', overall: 90, age: 32 },
      { name: 'Jude Bellingham', position: 'MF', overall: 90, age: 22 },
      { name: 'Bukayo Saka', position: 'ANG', overall: 88, age: 24 },
      { name: 'Phil Foden', position: 'MF', overall: 88, age: 26 },
      { name: 'Declan Rice', position: 'MF', overall: 87, age: 27 },
      { name: 'Cole Palmer', position: 'MF', overall: 86, age: 24 },
      { name: 'John Stones', position: 'ABW', overall: 85, age: 32 },
      { name: 'Trent Alexander-Arnold', position: 'ABW', overall: 85, age: 27 },
      { name: 'Kyle Walker', position: 'ABW', overall: 83, age: 36 },
      { name: 'Jordan Pickford', position: 'TW', overall: 83, age: 32 }
    ],
    firstNames: ['Jack', 'Oliver', 'Harry', 'George', 'Charlie', 'Noah', 'Leo', 'Arthur', 'Oscar', 'Freddie'],
    lastNames: ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Robinson', 'Walker']
  },
  {
    id: 'ESP',
    name: 'Spanien',
    flag: '🇪🇸',
    group: 'C',
    stars: [
      { name: 'Lamine Yamal', position: 'ANG', overall: 88, age: 18 },
      { name: 'Nico Williams', position: 'ANG', overall: 85, age: 23 },
      { name: 'Dani Olmo', position: 'MF', overall: 86, age: 28 },
      { name: 'Rodri', position: 'MF', overall: 91, age: 30 },
      { name: 'Pedri', position: 'MF', overall: 86, age: 23 },
      { name: 'Gavi', position: 'MF', overall: 83, age: 21 },
      { name: 'Dani Carvajal', position: 'ABW', overall: 85, age: 34 },
      { name: 'Aymeric Laporte', position: 'ABW', overall: 83, age: 32 },
      { name: 'Marc Cucurella', position: 'ABW', overall: 82, age: 27 },
      { name: 'Unai Simón', position: 'TW', overall: 85, age: 29 }
    ],
    firstNames: ['Alejandro', 'Daniel', 'David', 'Pablo', 'Alvaro', 'Adrian', 'Marcos', 'Javier', 'Hugo', 'Sergio'],
    lastNames: ['Garcia', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Martin', 'Ruiz']
  },
  {
    id: 'ITA',
    name: 'Italien',
    flag: '🇮🇹',
    group: 'D',
    stars: [
      { name: 'Gianluigi Donnarumma', position: 'TW', overall: 88, age: 27 },
      { name: 'Alessandro Bastoni', position: 'ABW', overall: 86, age: 27 },
      { name: 'Federico Dimarco', position: 'ABW', overall: 84, age: 28 },
      { name: 'Nicolò Barella', position: 'MF', overall: 87, age: 29 },
      { name: 'Davide Frattesi', position: 'MF', overall: 81, age: 26 },
      { name: 'Federico Chiesa', position: 'ANG', overall: 83, age: 28 },
      { name: 'Mateo Retegui', position: 'ANG', overall: 80, age: 27 },
      { name: 'Gianluca Scamacca', position: 'ANG', overall: 81, age: 27 }
    ],
    firstNames: ['Francesco', 'Alessandro', 'Lorenzo', 'Mattia', 'Leonardo', 'Gabriele', 'Andrea', 'Riccardo', 'Tommaso', 'Giuseppe'],
    lastNames: ['Rossi', 'Ferrari', 'Russo', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno']
  },
  {
    id: 'POR',
    name: 'Portugal',
    flag: '🇵🇹',
    group: 'D',
    stars: [
      { name: 'Cristiano Ronaldo', position: 'ANG', overall: 86, age: 41 },
      { name: 'Rafael Leão', position: 'ANG', overall: 86, age: 27 },
      { name: 'Bruno Fernandes', position: 'MF', overall: 87, age: 31 },
      { name: 'Bernardo Silva', position: 'MF', overall: 87, age: 31 },
      { name: 'Rúben Dias', position: 'ABW', overall: 89, age: 29 },
      { name: 'João Cancelo', position: 'ABW', overall: 84, age: 32 },
      { name: 'Diogo Costa', position: 'TW', overall: 85, age: 26 }
    ],
    firstNames: ['João', 'Francisco', 'Santiago', 'Afonso', 'Duarte', 'Tomas', 'Martim', 'Rodrigo', 'Lourenço', 'Miguel'],
    lastNames: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Almeida', 'Lopes', 'Carvalho']
  },
  {
    id: 'NED',
    name: 'Niederlande',
    flag: '🇳🇱',
    group: 'E',
    stars: [
      { name: 'Virgil van Dijk', position: 'ABW', overall: 88, age: 34 },
      { name: 'Frenkie de Jong', position: 'MF', overall: 86, age: 29 },
      { name: 'Cody Gakpo', position: 'ANG', overall: 83, age: 27 },
      { name: 'Memphis Depay', position: 'ANG', overall: 81, age: 32 },
      { name: 'Xavi Simons', position: 'MF', overall: 85, age: 23 },
      { name: 'Nathan Aké', position: 'ABW', overall: 84, age: 31 },
      { name: 'Bart Verbruggen', position: 'TW', overall: 81, age: 23 }
    ],
    firstNames: ['Daan', 'Luuk', 'Bram', 'Sem', 'Milan', 'Levi', 'Lucas', 'Finn', 'Noud', 'Mees'],
    lastNames: ['de Jong', 'de Vries', 'van de Berg', 'van Dijk', 'Bakker', 'Janssen', 'Visser', 'Smit', 'Meijer', 'de Graaf']
  },
  {
    id: 'BEL',
    name: 'Belgien',
    flag: '🇧🇪',
    group: 'E',
    stars: [
      { name: 'Kevin De Bruyne', position: 'MF', overall: 89, age: 34 },
      { name: 'Romelu Lukaku', position: 'ANG', overall: 82, age: 33 },
      { name: 'Jérémy Doku', position: 'ANG', overall: 83, age: 24 },
      { name: 'Amadou Onana', position: 'MF', overall: 82, age: 24 },
      { name: 'Wout Faes', position: 'ABW', overall: 79, age: 28 },
      { name: 'Koen Casteels', position: 'TW', overall: 82, age: 33 }
    ],
    firstNames: ['Arthur', 'Noah', 'Lucas', 'Liam', 'Louis', 'Adam', 'Jules', 'Victor', 'Gabriel', 'Mathis'],
    lastNames: ['Peeters', 'Janssens', 'Maes', 'Jacobs', 'Mertens', 'Willems', 'Claes', 'Goossens', 'Wouters', 'De Smet']
  },
  {
    id: 'CRO',
    name: 'Kroatien',
    flag: '🇭🇷',
    group: 'F',
    stars: [
      { name: 'Luka Modrić', position: 'MF', overall: 85, age: 40 },
      { name: 'Joško Gvardiol', position: 'ABW', overall: 86, age: 24 },
      { name: 'Mateo Kovačić', position: 'MF', overall: 83, age: 32 },
      { name: 'Andrej Kramarić', position: 'ANG', overall: 80, age: 35 },
      { name: 'Dominik Livaković', position: 'TW', overall: 81, age: 31 }
    ],
    firstNames: ['Luka', 'Ivan', 'David', 'Jakov', 'Petar', 'Mateo', 'Karlo', 'Fran', 'Filip', 'Borna'],
    lastNames: ['Horvat', 'Kovačević', 'Babić', 'Marić', 'Jurić', 'Novak', 'Kovačić', 'Vuković', 'Knežević', 'Marković']
  },
  {
    id: 'MAR',
    name: 'Marokko',
    flag: '🇲🇦',
    group: 'F',
    stars: [
      { name: 'Achraf Hakimi', position: 'ABW', overall: 85, age: 27 },
      { name: 'Yassine Bounou', position: 'TW', overall: 84, age: 35 },
      { name: 'Sofyan Amrabat', position: 'MF', overall: 80, age: 29 },
      { name: 'Hakim Ziyech', position: 'ANG', overall: 80, age: 33 },
      { name: 'Brahim Díaz', position: 'MF', overall: 83, age: 26 }
    ],
    firstNames: ['Mohamed', 'Youssef', 'Amine', 'Yassine', 'Anass', 'Adam', 'Hamza', 'Mehdi', 'Omar', 'Karim'],
    lastNames: ['Alami', 'Benjelloun', 'El Amrani', 'Naji', 'Chraibi', 'Mansouri', 'Sebaï', 'Alaoui', 'Tazi', 'Kabbaj']
  },
  {
    id: 'JPN',
    name: 'Japan',
    flag: '🇯🇵',
    group: 'G',
    stars: [
      { name: 'Kaoru Mitoma', position: 'ANG', overall: 83, age: 29 },
      { name: 'Takefusa Kubo', position: 'ANG', overall: 82, age: 25 },
      { name: 'Wataru Endo', position: 'MF', overall: 80, age: 33 },
      { name: 'Hiroki Ito', position: 'ABW', overall: 80, age: 27 },
      { name: 'Zion Suzuki', position: 'TW', overall: 76, age: 23 }
    ],
    firstNames: ['Hiroto', 'Ren', 'Sota', 'Yuto', 'Haruto', 'Sora', 'Minato', 'Yuma', 'Itsuki', 'Taiga'],
    lastNames: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato']
  },
  {
    id: 'USA',
    name: 'USA',
    flag: '🇺🇸',
    group: 'G',
    stars: [
      { name: 'Christian Pulisic', position: 'ANG', overall: 83, age: 27 },
      { name: 'Weston McKennie', position: 'MF', overall: 80, age: 27 },
      { name: 'Antonee Robinson', position: 'ABW', overall: 80, age: 28 },
      { name: 'Tyler Adams', position: 'MF', overall: 79, age: 27 },
      { name: 'Matt Turner', position: 'TW', overall: 77, age: 31 }
    ],
    firstNames: ['Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander'],
    lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor']
  },
  {
    id: 'URU',
    name: 'Uruguay',
    flag: '🇺🇾',
    group: 'H',
    stars: [
      { name: 'Federico Valverde', position: 'MF', overall: 88, age: 27 },
      { name: 'Darwin Núñez', position: 'ANG', overall: 82, age: 26 },
      { name: 'Ronald Araújo', position: 'ABW', overall: 85, age: 27 },
      { name: 'Rodrigo Bentancur', position: 'MF', overall: 81, age: 28 },
      { name: 'Sergio Rochet', position: 'TW', overall: 79, age: 33 }
    ],
    firstNames: ['Mateo', 'Santiago', 'Matías', 'Sebastián', 'Nicolás', 'Diego', 'Felipe', 'Lucas', 'Joaquín', 'Ignacio'],
    lastNames: ['Rodríguez', 'González', 'Pérez', 'Silva', 'Fernández', 'García', 'López', 'Martínez', 'Sánchez', 'Gómez']
  },
  {
    id: 'SUI',
    name: 'Schweiz',
    flag: '🇨🇭',
    group: 'H',
    stars: [
      { name: 'Yann Sommer', position: 'TW', overall: 84, age: 37 },
      { name: 'Manuel Akanji', position: 'ABW', overall: 85, age: 30 },
      { name: 'Granit Xhaka', position: 'MF', overall: 84, age: 33 },
      { name: 'Denis Zakaria', position: 'MF', overall: 81, age: 29 },
      { name: 'Breel Embolo', position: 'ANG', overall: 78, age: 29 }
    ],
    firstNames: ['Noah', 'Leon', 'Luan', 'Liam', 'Luca', 'Gabriel', 'Elia', 'Nico', 'Samuel', 'Julian'],
    lastNames: ['Müller', 'Meier', 'Schmid', 'Keller', 'Weber', 'Schneider', 'Meyer', 'Steiner', 'Gerber', 'Brunner']
  }
];

const REMAINING_TEAMS_DATA = [
  { id: 'SEN', name: 'Senegal', flag: '🇸🇳', group: 'A' as const },
  { id: 'DEN', name: 'Dänemark', flag: '🇩🇰', group: 'B' as const },
  { id: 'MEX', name: 'Mexiko', flag: '🇲🇽', group: 'C' as const },
  { id: 'POL', name: 'Polen', flag: '🇵🇱', group: 'D' as const },
  { id: 'KOR', name: 'Südkorea', flag: '🇬🇭', group: 'E' as const }, // group E helper mapping
  { id: 'AUS', name: 'Australien', flag: '🇦🇺', group: 'F' as const },
  { id: 'CMR', name: 'Kamerun', flag: '🇨🇲', group: 'G' as const },
  { id: 'CAN', name: 'Kanada', flag: '🇨🇦', group: 'H' as const },
  { id: 'CRC', name: 'Costa Rica', flag: '🇨🇷', group: 'A' as const },
  { id: 'ECU', name: 'Ecuador', flag: '🇪🇨', group: 'B' as const },
  { id: 'GHA', name: 'Ghana', flag: '🇬🇭', group: 'C' as const },
  { id: 'IRN', name: 'Iran', flag: '🇮🇷', group: 'D' as const },
  { id: 'KSA', name: 'Saudi-Arabien', flag: '🇸🇦', group: 'E' as const },
  { id: 'SRB', name: 'Serbien', flag: '🇷🇸', group: 'F' as const },
  { id: 'TUN', name: 'Tunesien', flag: '🇹🇳', group: 'G' as const },
  { id: 'WAL', name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', group: 'H' as const }
];

const GENERIC_FIRST_NAMES = ['David', 'Daniel', 'Michael', 'Alex', 'John', 'Marcus', 'Eric', 'Paul', 'Robert', 'Chris'];
const GENERIC_LAST_NAMES = ['Silva', 'Jones', 'Smith', 'Müller', 'Hernandez', 'Kim', 'Ali', 'Williams', 'Santos', 'Okafor'];

export function generateInitialTeams(): Team[] {
  const result: Team[] = [];
  const prng = new Pcg32(99n);

  // 1. Process explicit configurations (16 teams)
  for (const config of TEAMS_CONFIG) {
    const players = generatePlayersForConfig(config);
    const lineup = selectDefaultLineup(players);
    const tactics: TeamTactics = {
      formation: '4-4-2',
      style: 'ausgeglichen',
      passing: 'gemischt',
      aggression: 3
    };

    result.push({
      id: config.id,
      name: config.name,
      flag: config.flag,
      players,
      lineup,
      captainId: lineup[0],
      penaltyTakerId: lineup[1],
      budget_xor: xorNumber(60000000), // 60 Million obfuscated
      tactics,
      isUser: false,
      ccqMatrix: generateRandomCCQMatrix(prng)
    });
  }

  // 2. Process remaining config (16 teams)
  for (const generic of REMAINING_TEAMS_DATA) {
    // Generate programmatic config
    const config: TeamConfig = {
      id: generic.id,
      name: generic.name,
      flag: generic.flag,
      group: generic.group,
      stars: [],
      firstNames: GENERIC_FIRST_NAMES,
      lastNames: GENERIC_LAST_NAMES
    };

    // Add 1 or 2 stars programmatically to make them interesting
    const starCount = 2;
    for (let i = 0; i < starCount; i++) {
      const positions: PlayerPosition[] = ['ABW', 'MF', 'ANG'];
      const pos = positions[Math.floor(Math.random() * positions.length)];
      const overall = 78 + Math.floor(Math.random() * 5); // 78 - 82
      config.stars.push({
        name: `${config.firstNames[Math.floor(Math.random() * config.firstNames.length)]} ${config.lastNames[Math.floor(Math.random() * config.lastNames.length)]}`,
        position: pos,
        overall,
        age: 21 + Math.floor(Math.random() * 10)
      });
    }

    const players = generatePlayersForConfig(config);
    const lineup = selectDefaultLineup(players);
    const tactics: TeamTactics = {
      formation: '4-4-2',
      style: 'ausgeglichen',
      passing: 'gemischt',
      aggression: 3
    };

    result.push({
      id: config.id,
      name: config.name,
      flag: config.flag,
      players,
      lineup,
      captainId: lineup[0],
      penaltyTakerId: lineup[1],
      budget_xor: xorNumber(40000000), // 40 Million obfuscated
      tactics,
      isUser: false,
      ccqMatrix: generateRandomCCQMatrix(prng)
    });
  }

  return result;
}

// Generate full roster (16 players: 2 GK, 5 DF, 5 MF, 4 FW)
function generatePlayersForConfig(config: TeamConfig): Player[] {
  const players: Player[] = [];
  const nationality = config.name;

  const positionNeeds: { pos: PlayerPosition; count: number }[] = [
    { pos: 'TW', count: 2 },
    { pos: 'ABW', count: 5 },
    { pos: 'MF', count: 5 },
    { pos: 'ANG', count: 4 }
  ];

  for (const { pos, count } of positionNeeds) {
    for (let i = 0; i < count; i++) {
      const matchingStar = config.stars.find((s) => s.position === pos && !players.some(p => p.name === s.name));

      if (matchingStar) {
        const { value, salary } = calculateValueAndSalary(matchingStar.overall, matchingStar.age);
        players.push({
          id: generateId(),
          name: matchingStar.name,
          nationality,
          age: matchingStar.age,
          position: pos,
          overall: matchingStar.overall,
          fitness: 100,
          form: 75,
          morale: 80,
          skills: generateSkills(pos, matchingStar.overall),
          value,
          salary,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          injuryWeeks: 0,
          contractYears: 2 + Math.floor(Math.random() * 3),
          atp: 100.0,
          glycogen: 100.0,
          aerobic: matchingStar.overall // physical base rating
        });
      } else {
        const firstName = config.firstNames[Math.floor(Math.random() * config.firstNames.length)];
        const lastName = config.lastNames[Math.floor(Math.random() * config.lastNames.length)];
        const name = `${firstName} ${lastName}`;

        const finalName = players.some(p => p.name === name) ? `${firstName} ${lastName} Jr.` : name;

        const topTeams = ['GER', 'FRA', 'ARG', 'BRA', 'ENG', 'ESP', 'ITA', 'POR', 'NED'];
        const isTop = topTeams.includes(config.id);
        const baseMin = isTop ? 75 : 68;
        const baseSpread = isTop ? 10 : 8;
        const overall = baseMin + Math.floor(Math.random() * baseSpread);

        const age = 18 + Math.floor(Math.random() * 16); // 18 - 34
        const { value, salary } = calculateValueAndSalary(overall, age);

        players.push({
          id: generateId(),
          name: finalName,
          nationality,
          age,
          position: pos,
          overall,
          fitness: 90 + Math.floor(Math.random() * 11),
          form: 60 + Math.floor(Math.random() * 31),
          morale: 70 + Math.floor(Math.random() * 21),
          skills: generateSkills(pos, overall),
          value,
          salary,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          injuryWeeks: 0,
          contractYears: 1 + Math.floor(Math.random() * 4),
          atp: 100.0,
          glycogen: 100.0,
          aerobic: overall
        });
      }
    }
  }

  return players;
}

function selectDefaultLineup(players: Player[]): string[] {
  const getSortedByPos = (pos: PlayerPosition) => 
    players.filter(p => p.position === pos).sort((a, b) => b.overall - a.overall);

  const gks = getSortedByPos('TW');
  const dfs = getSortedByPos('ABW');
  const mfs = getSortedByPos('MF');
  const fws = getSortedByPos('ANG');

  const lineup: string[] = [];

  if (gks[0]) lineup.push(gks[0].id);

  for (let i = 0; i < 4; i++) {
    if (dfs[i]) lineup.push(dfs[i].id);
  }
  for (let i = 0; i < 4; i++) {
    if (mfs[i]) lineup.push(mfs[i].id);
  }
  for (let i = 0; i < 2; i++) {
    if (fws[i]) lineup.push(fws[i].id);
  }

  while (lineup.length < 11 && players.length > lineup.length) {
    const nextPlayer = players.find(p => !lineup.includes(p.id));
    if (nextPlayer) lineup.push(nextPlayer.id);
  }

  return lineup;
}

export function generateFreeAgents(): Player[] {
  const freeAgents: Player[] = [];
  const firstNames = ['Marco', 'Luka', 'Ivan', 'James', 'Sven', 'Karim', 'Diego', 'Christian', 'Kevin', 'Oliver'];
  const lastNames = ['Reus', 'Modric', 'Perisic', 'Rodriguez', 'Bender', 'Benzema', 'Costa', 'Eriksen', 'De Bruyne', 'Kahn'];
  const positions: PlayerPosition[] = ['TW', 'ABW', 'MF', 'ANG'];

  for (let i = 0; i < 15; i++) {
    const pos = positions[Math.floor(Math.random() * positions.length)];
    const overall = 72 + Math.floor(Math.random() * 12);
    const age = 30 + Math.floor(Math.random() * 8);
    const { value, salary } = calculateValueAndSalary(overall, age);

    freeAgents.push({
      id: generateId(),
      name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
      nationality: 'Vereinslos',
      age,
      position: pos,
      overall,
      fitness: 85,
      form: 50,
      morale: 60,
      skills: generateSkills(pos, overall),
      value: Math.round(value * 0.4),
      salary: Math.round(salary * 0.8),
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      injuryWeeks: 0,
      contractYears: 0,
      atp: 100.0,
      glycogen: 100.0,
      aerobic: overall
    });
  }

  return freeAgents;
}
