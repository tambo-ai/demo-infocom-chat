import JSZM from 'jszm';

interface InputNeededMarker {
  type: 'INPUT_NEEDED';
  maxlen: number;
}

const SAVE_KEY_PREFIX = 'infocom-chat-save-';

function getSaveKey(game: JSZM): string {
  return `${SAVE_KEY_PREFIX}${game.serial}-${game.zorkid}`;
}

function saveToLocalStorage(game: JSZM, data: Uint8Array): boolean {
  try {
    const base64 = btoa(String.fromCharCode(...data));
    localStorage.setItem(getSaveKey(game), base64);
    return true;
  } catch (err) {
    console.error('[ZMachine] Failed to save:', err);
    return false;
  }
}

function loadFromLocalStorage(game: JSZM): Uint8Array | null {
  try {
    const base64 = localStorage.getItem(getSaveKey(game));
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.error('[ZMachine] Failed to load save:', err);
    return null;
  }
}

export class ZMachineRunner {
  private game: JSZM;
  private gameGenerator: Generator | null = null;
  private outputBuffer = '';
  private waitingForInput = false;

  constructor(storyData: ArrayBuffer) {
    this.game = new JSZM(new Uint8Array(storyData));
    const self = this;

    // Override print - accumulate output (generator that doesn't yield)
    this.game.print = function* (text: string) {
      self.outputBuffer += text;
    };

    // Override read - yield marker, return input from next()
    this.game.read = function* (maxlen: number): Generator<InputNeededMarker, string, string> {
      self.waitingForInput = true;
      const input: string = yield { type: 'INPUT_NEEDED', maxlen };
      self.waitingForInput = false;
      return input;
    };

    // Save to localStorage
    this.game.save = function* (data: Uint8Array) {
      return saveToLocalStorage(self.game, data);
    };

    // Restore from localStorage
    this.game.restore = function* () {
      return loadFromLocalStorage(self.game);
    };
  }

  async start(): Promise<string> {
    this.gameGenerator = this.game.run() as Generator;
    const intro = this.runUntilInput();

    // Auto-restore if a save exists
    if (this.hasSavedGame()) {
      const restoreOutput = await this.sendCommand('RESTORE', false);
      return intro + '\n[Game restored from auto-save]\n\n' + restoreOutput;
    }

    return intro;
  }

  async sendCommand(command: string, autoSave = true): Promise<string> {
    if (!this.gameGenerator) {
      throw new Error('Game not started');
    }
    if (!this.waitingForInput) {
      throw new Error('Game is not waiting for input');
    }

    this.outputBuffer = '';
    const result = this.gameGenerator.next(command);
    const output = this.runUntilInputFromResult(result);

    // Auto-save after each command (silently)
    if (autoSave && this.waitingForInput && command.toUpperCase() !== 'SAVE' && command.toUpperCase() !== 'RESTORE') {
      this.outputBuffer = '';
      const saveResult = this.gameGenerator.next('SAVE');
      this.runUntilInputFromResult(saveResult);
    }

    return output;
  }

  hasSavedGame(): boolean {
    return localStorage.getItem(getSaveKey(this.game)) !== null;
  }

  clearSave(): void {
    localStorage.removeItem(getSaveKey(this.game));
  }

  isWaitingForInput(): boolean {
    return this.waitingForInput;
  }

  private runUntilInput(): string {
    if (!this.gameGenerator) {
      throw new Error('Game not started');
    }
    const result = this.gameGenerator.next();
    return this.runUntilInputFromResult(result);
  }

  private runUntilInputFromResult(result: IteratorResult<unknown>): string {
    if (!this.gameGenerator) {
      throw new Error('Game not started');
    }

    while (!result.done) {
      const value = result.value as InputNeededMarker | undefined;
      if (value?.type === 'INPUT_NEEDED') {
        return this.outputBuffer;
      }
      result = this.gameGenerator.next();
    }

    // Game ended
    this.waitingForInput = false;
    return this.outputBuffer;
  }
}

// Singleton instance for the current game
let currentRunner: ZMachineRunner | null = null;

export async function initializeGame(storyUrl: string): Promise<string> {
  const response = await fetch(storyUrl);
  if (!response.ok) {
    throw new Error(`Failed to load game: ${response.status}`);
  }
  const storyData = await response.arrayBuffer();
  currentRunner = new ZMachineRunner(storyData);
  return currentRunner.start();
}

export function getGameRunner(): ZMachineRunner | null {
  return currentRunner;
}

export function isGameInitialized(): boolean {
  return currentRunner !== null;
}

export function clearGameSave(): void {
  if (currentRunner) {
    currentRunner.clearSave();
  }
}
