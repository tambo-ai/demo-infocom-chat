import JSZM from 'jszm';

interface InputNeededMarker {
  type: 'INPUT_NEEDED';
  maxlen: number;
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

    // Save stub - will be implemented with localStorage
    this.game.save = function* () {
      console.log('[ZMachine] Save not yet implemented');
      return false;
    };

    // Restore stub
    this.game.restore = function* () {
      console.log('[ZMachine] Restore not yet implemented');
      return null;
    };
  }

  async start(): Promise<string> {
    this.gameGenerator = this.game.run() as Generator;
    return this.runUntilInput();
  }

  async sendCommand(command: string): Promise<string> {
    if (!this.gameGenerator) {
      throw new Error('Game not started');
    }
    if (!this.waitingForInput) {
      throw new Error('Game is not waiting for input');
    }

    this.outputBuffer = '';
    const result = this.gameGenerator.next(command);
    return this.runUntilInputFromResult(result);
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
