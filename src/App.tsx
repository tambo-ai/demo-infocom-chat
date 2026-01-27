import { useEffect, useState, useRef, useCallback } from 'react';
import {
  TamboProvider,
  useTamboThread,
  useTamboThreadInput,
} from '@tambo-ai/react';
import { tools } from './lib/tambo';
import { initializeGame, isGameInitialized, clearGameSave, resetGame } from './lib/zmachine';
import { games, getLastPlayedGame, setLastPlayedGame, getGameById, type GameInfo } from './lib/games';
import './App.css';

const systemPrompt = `You ARE the text adventure game. You are not an assistant or helper - you are the game itself, enhanced with natural language understanding.

CRITICAL RULES:
1. Call sendGameCommand for EVERY user message. No exceptions.
2. Your responses must feel like they come from the game world itself - never break the fourth wall.
3. NEVER add commentary, suggestions, or meta-discussion. No "Let's see...", "Would you like to...", or "The game says...".
4. When the game returns an error or doesn't understand, translate it into an in-world response:
   - Parser errors → describe what happens when the player tries (e.g., "You look around for something to paint with, but find nothing suitable.")
   - "I don't understand" → rephrase as the character being confused or the action not making sense in context
   - Keep the player immersed - they should feel like the game just got smarter, not like there's an AI mediating
5. For successful commands, you MUST include the game's actual output. You may augment it by slightly rewording, adding flavor text, or providing commentary relevant to the user's intent - but never hide, omit, or summarize away what the game actually said. The player should always know what happened.
6. If the user's message contains multiple actions, make SEPARATE sequential tool calls for each.
7. Interpret casual language as game commands:
   - Greetings → LOOK
   - "what do I have?" → INVENTORY
   - Questions about surroundings → LOOK or EXAMINE

You are the narrator of this interactive fiction. Stay in character. Stay in the world.`;

interface ChatInterfaceProps {
  gameIntro: string | null;
  onScroll: (scrollTop: number) => void;
  showCommands: boolean;
}

// Extract sendGameCommand calls from message toolCallRequest
function extractGameCommand(message: unknown): string | null {
  if (
    typeof message === 'object' &&
    message !== null &&
    'toolCallRequest' in message &&
    typeof message.toolCallRequest === 'object' &&
    message.toolCallRequest !== null
  ) {
    const request = message.toolCallRequest as {
      toolName?: string;
      parameters?: Array<{ parameterName?: string; parameterValue?: string }>;
    };
    if (request.toolName === 'sendGameCommand' && Array.isArray(request.parameters)) {
      const commandParam = request.parameters.find(p => p.parameterName === 'command');
      if (commandParam?.parameterValue) {
        return commandParam.parameterValue;
      }
    }
  }
  return null;
}

function ChatInterface({ gameIntro, onScroll, showCommands }: ChatInterfaceProps) {
  const { thread } = useTamboThread();
  const { value, setValue, submit, isPending } = useTamboThreadInput();
  const messagesRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages, isPending]);

  // Refocus input when submission completes
  useEffect(() => {
    if (!isPending) {
      inputRef.current?.focus();
    }
  }, [isPending]);

  // Show thinking indicator only before assistant starts responding
  const lastMessage = thread.messages[thread.messages.length - 1];
  const showThinking = isPending && lastMessage?.role !== 'assistant';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isPending) return;
    submit({ streamResponse: true });
  };

  const handleScroll = useCallback(() => {
    if (messagesRef.current) {
      onScroll(messagesRef.current.scrollTop);
    }
  }, [onScroll]);

  return (
    <div className="chat-container">
      <div className="messages" ref={messagesRef} onScroll={handleScroll}>
        {gameIntro && (
          <div className="message game-intro-message">
            <pre>{gameIntro}</pre>
          </div>
        )}
        {thread.messages
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .map((message) => {
            const command = message.role === 'assistant' ? extractGameCommand(message) : null;

            return (
              <div key={message.id} className="message-group">
                <div className={`message ${message.role}`}>
                  <div className="message-content">
                    {typeof message.content === 'string'
                      ? message.content
                      : Array.isArray(message.content)
                        ? message.content.map((part, i) =>
                            'text' in part && part.text ? <span key={i}>{part.text}</span> : null
                          )
                        : null}
                  </div>
                </div>
                {/* Show command after assistant response */}
                {showCommands && command && (
                  <div className="message command">
                    <div className="message-content">{command}</div>
                  </div>
                )}
              </div>
            );
          })}
        {showThinking && (
          <div className="message assistant loading">
            <div className="message-content">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What do you want to do?"
          disabled={isPending}
          autoFocus
        />
        <button
          type="submit"
          disabled={isPending || !value.trim()}
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
        >
          {isPending ? '...' : '>'}
        </button>
      </form>
    </div>
  );
}

function InfoModal({ onClose }: { onClose: () => void }) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        <h2>How It Works</h2>

        <section>
          <h3>Z-Machine Engine</h3>
          <p>
            The game runs entirely in your browser using{' '}
            <a href="https://github.com/DLehenbauer/jszm" target="_blank" rel="noopener noreferrer">
              JSZM
            </a>
            , a JavaScript implementation of the Z-machine virtual machine that Infocom
            created in the 1980s to run their text adventures across different platforms.
          </p>
        </section>

        <section>
          <h3>Natural Language via Tambo</h3>
          <p>
            The chat interface is powered by{' '}
            <a href="https://tambo.co" target="_blank" rel="noopener noreferrer">
              Tambo
            </a>
            , which manages conversation history, streaming responses, and tool orchestration.
            When you type a message, the LLM translates it into commands the game understands
            via simple tool calls.
          </p>
        </section>

        <section>
          <h3>Try These Examples</h3>
          <p>The LLM can handle surprisingly complex instructions:</p>
          <ul className="examples-list">
            <li>"Walk clockwise starting with north"</li>
            <li>"Eat everything in the sack"</li>
            <li>"Explore the house and collect everything you find"</li>
            <li>"What's the most interesting thing here?"</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function GameSelector({ onSelectGame }: { onSelectGame: (game: GameInfo) => void }) {
  return (
    <div className="game-selector">
      <h2>Choose Your Adventure</h2>
      <div className="game-list">
        {games.map((game) => (
          <button
            key={game.id}
            className="game-option"
            onClick={() => onSelectGame(game)}
          >
            <span className="game-name">{game.name}</span>
            {game.description && <span className="game-description">{game.description}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

interface GameLoaderProps {
  game: GameInfo;
  onScroll: (scrollTop: number) => void;
  onChangeGame: () => void;
  showCommands: boolean;
}

function GameLoader({ game, onScroll, onChangeGame, showCommands }: GameLoaderProps) {
  const [gameOutput, setGameOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGameInitialized()) {
      setLoading(false);
      return;
    }

    initializeGame(game.file)
      .then((output) => {
        setGameOutput(output);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load game');
        setLoading(false);
      });
  }, [game.file]);

  if (loading) {
    return (
      <div className="loading-screen">
        <h1>Loading {game.name}...</h1>
        <p>Preparing your adventure</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
        <button onClick={onChangeGame}>Choose Different Game</button>
      </div>
    );
  }

  return <ChatInterface gameIntro={gameOutput} onScroll={onScroll} showCommands={showCommands} />;
}

function App() {
  const { startNewThread } = useTamboThread();
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Initialize selected game from URL path, localStorage, or null
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(() => {
    // Check URL path first (e.g., /zork1)
    const pathGameId = window.location.pathname.slice(1); // Remove leading /
    if (pathGameId) {
      const pathGame = getGameById(pathGameId);
      if (pathGame) {
        return pathGame;
      }
    }

    // Fall back to localStorage
    const lastGameId = getLastPlayedGame();
    if (lastGameId) {
      return getGameById(lastGameId) || null;
    }
    // Auto-select if only one game available
    if (games.length === 1) {
      return games[0];
    }
    return null;
  });

  // Sync URL with selected game on initial load
  useEffect(() => {
    if (selectedGame && window.location.pathname !== `/${selectedGame.id}`) {
      window.history.replaceState({}, '', `/${selectedGame.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally run only on mount
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const pathGameId = window.location.pathname.slice(1);
      if (pathGameId) {
        const game = getGameById(pathGameId);
        if (game) {
          resetGame();
          setSelectedGame(game);
          startNewThread();
          return;
        }
      }
      // No valid game in URL, go to selector
      resetGame();
      setSelectedGame(null);
      startNewThread();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [startNewThread]);

  const handleScroll = useCallback((scrollTop: number) => {
    setHeaderCollapsed(scrollTop > 50);
  }, []);

  const handleSelectGame = useCallback((game: GameInfo) => {
    setLastPlayedGame(game.id);
    setSelectedGame(game);
    // Update URL to match selected game
    window.history.pushState({}, '', `/${game.id}`);
  }, []);

  const handleChangeGame = useCallback(() => {
    resetGame();
    setSelectedGame(null);
    startNewThread();
    // Update URL back to root
    window.history.pushState({}, '', '/');
  }, [startNewThread]);

  const handleNewGame = useCallback(() => {
    if (confirm('Start a new game? Your progress will be lost.')) {
      clearGameSave();
      resetGame();
      startNewThread();
      // If multiple games, go back to selector
      if (games.length > 1) {
        setSelectedGame(null);
        window.history.pushState({}, '', '/');
      }
      // Otherwise stay on current game with fresh thread
    }
  }, [startNewThread]);

  return (
    <div className="app">
      <header className={headerCollapsed ? 'collapsed' : ''}>
        <h1>
          <a href="/" onClick={(e) => { e.preventDefault(); handleChangeGame(); }}>
            Infocom Chat
          </a>
        </h1>
        <p>{selectedGame ? selectedGame.name : 'Play text adventures with natural language'}</p>
        <div className="header-buttons">
          {selectedGame && (
            <>
              <button
                className={`toggle-button ${showCommands ? 'active' : ''}`}
                onClick={() => setShowCommands(!showCommands)}
                title={showCommands ? 'Hide game commands' : 'Show game commands'}
              >
                <span className="toggle-icon">&gt;_</span>
              </button>
              <button className="reset-button" onClick={handleNewGame}>
                New Game
              </button>
            </>
          )}
          <button
            className="info-button"
            onClick={() => setShowInfo(true)}
            title="How it works"
          >
            ?
          </button>
        </div>
      </header>
      <main>
        {selectedGame ? (
          <GameLoader game={selectedGame} onScroll={handleScroll} onChangeGame={handleChangeGame} showCommands={showCommands} />
        ) : (
          <GameSelector onSelectGame={handleSelectGame} />
        )}
      </main>
      <footer>
        Built with ❤️ with <a href="https://tambo.co" target="_blank" rel="noopener noreferrer">Tambo</a> | <a href="https://github.com/tambo-ai/demo-infocom-chat" target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
    </div>
  );
}

const initialMessages = [
  {
    id: 'system-message',
    role: 'system' as const,
    content: [{ type: 'text' as const, text: systemPrompt }],
    createdAt: new Date().toISOString(),
    componentState: {},
  },
];

function AppWithProviders() {
  const apiKey = import.meta.env.VITE_TAMBO_API_KEY;

  if (!apiKey) {
    return (
      <div className="error-screen">
        <h1>Missing API Key</h1>
        <p>Please set VITE_TAMBO_API_KEY in your .env file</p>
        <p>Copy .env.example to .env and add your Tambo API key</p>
      </div>
    );
  }

  return (
    <TamboProvider apiKey={apiKey} tools={tools} initialMessages={initialMessages}>
      <App />
    </TamboProvider>
  );
}

export default AppWithProviders;
