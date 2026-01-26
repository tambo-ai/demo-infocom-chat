import { useEffect, useState, useRef, useCallback } from 'react';
import {
  TamboProvider,
  TamboThreadProvider,
  TamboThreadInputProvider,
  useTamboThread,
  useTamboThreadInput,
  type InitialTamboThreadMessage,
} from '@tambo-ai/react';
import { tools } from './lib/tambo';
import { initializeGame, isGameInitialized } from './lib/zmachine';
import './App.css';

const systemMessage: InitialTamboThreadMessage = {
  role: 'system',
  content: [
    {
      type: 'text',
      text: `You ARE the text adventure game. You are not an assistant or helper - you are the game itself, enhanced with natural language understanding.

CRITICAL RULES:
1. Call sendGameCommand for EVERY user message. No exceptions.
2. Your responses must feel like they come from the game world itself - never break the fourth wall.
3. NEVER add commentary, suggestions, or meta-discussion. No "Let's see...", "Would you like to...", or "The game says...".
4. When the game returns an error or doesn't understand, translate it into an in-world response:
   - Parser errors → describe what happens when the player tries (e.g., "You look around for something to paint with, but find nothing suitable.")
   - "I don't understand" → rephrase as the character being confused or the action not making sense in context
   - Keep the player immersed - they should feel like the game just got smarter, not like there's an AI mediating
5. For successful commands, return the game's output directly or with minimal, in-world embellishment.
6. If the user's message contains multiple actions, make SEPARATE sequential tool calls for each.
7. Interpret casual language as game commands:
   - Greetings → LOOK
   - "what do I have?" → INVENTORY
   - Questions about surroundings → LOOK or EXAMINE

You are the narrator of this interactive fiction. Stay in character. Stay in the world.`,
    },
  ],
};

function ChatInterface({ gameIntro, onScroll }: { gameIntro: string | null; onScroll: (scrollTop: number) => void }) {
  const { thread } = useTamboThread();
  const { value, setValue, submit, isPending } = useTamboThreadInput();
  const messagesRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages, isPending]);

  // Show thinking indicator only before assistant starts responding
  const lastMessage = thread.messages[thread.messages.length - 1];
  const showThinking = isPending && lastMessage?.role !== 'assistant';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isPending) return;
    await submit({ streamResponse: true });
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
          .map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-role">{message.role === 'user' ? '>' : 'Game:'}</div>
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
          ))}
        {showThinking && (
          <div className="message assistant loading">
            <div className="message-role">Game:</div>
            <div className="message-content">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What do you want to do?"
          disabled={isPending}
          autoFocus
        />
        <button type="submit" disabled={isPending || !value.trim()}>
          {isPending ? '...' : '>'}
        </button>
      </form>
    </div>
  );
}

function GameLoader({ onScroll }: { onScroll: (scrollTop: number) => void }) {
  const [gameOutput, setGameOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGameInitialized()) {
      setLoading(false);
      return;
    }

    initializeGame('/zork1.z3')
      .then((output) => {
        setGameOutput(output);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load game');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <h1>Loading game...</h1>
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
      </div>
    );
  }

  return <ChatInterface gameIntro={gameOutput} onScroll={onScroll} />;
}

function App() {
  const apiKey = import.meta.env.VITE_TAMBO_API_KEY;
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const handleScroll = useCallback((scrollTop: number) => {
    setHeaderCollapsed(scrollTop > 50);
  }, []);

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
    <TamboProvider apiKey={apiKey} tools={tools}>
      <TamboThreadProvider initialMessages={[systemMessage]}>
        <TamboThreadInputProvider>
          <div className="app">
            <header className={headerCollapsed ? 'collapsed' : ''}>
              <h1>Infocom Chat</h1>
              <p>Play text adventures with natural language</p>
            </header>
            <main>
              <GameLoader onScroll={handleScroll} />
            </main>
            <footer>
              Built with ❤️ with <a href="https://tambo.co" target="_blank" rel="noopener noreferrer">Tambo</a>
            </footer>
          </div>
        </TamboThreadInputProvider>
      </TamboThreadProvider>
    </TamboProvider>
  );
}

export default App;
