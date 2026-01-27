export interface GameInfo {
  id: string;
  name: string;
  file: string;
  description?: string;
}

export const games: GameInfo[] = [
  {
    id: 'zork1',
    name: 'Zork I',
    file: '/zork1.z3',
    description: 'The Great Underground Empire',
  },
  // Add more games here as they become available
  // {
  //   id: 'zork2',
  //   name: 'Zork II',
  //   file: '/zork2.z3',
  //   description: 'The Wizard of Frobozz',
  // },
];

const LAST_GAME_KEY = 'infocom-chat-last-game';

export function getLastPlayedGame(): string | null {
  return localStorage.getItem(LAST_GAME_KEY);
}

export function setLastPlayedGame(gameId: string): void {
  localStorage.setItem(LAST_GAME_KEY, gameId);
}

export function getGameById(id: string): GameInfo | undefined {
  return games.find((g) => g.id === id);
}
