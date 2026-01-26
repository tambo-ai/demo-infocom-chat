# Infocom Chat

Play classic Infocom text adventures using natural language, powered by [Tambo](https://tambo.co).

Instead of typing precise parser commands like `TAKE LAMP` or `GO NORTH`, just say what you want to do: "grab the lamp and head north." Tambo translates your natural language into game commands, making the experience feel like the game itself got smarter.

## Features

- **Natural Language Input**: Type conversational commands instead of learning parser syntax
- **Multi-step Commands**: Say "go north, open the mailbox, and read the leaflet" and watch it happen
- **Immersive Experience**: The AI acts as the game narrator, keeping you in the story
- **Any Z-machine Game**: Works with Infocom classics (.z3, .z5, .z8 files)
- **Runs in Browser**: No server required - the Z-machine interpreter runs entirely client-side

## Quick Start

```bash
npm install
cp .env.example .env
# Add your Tambo API key to .env
npm run dev
```

## How It Works

1. **JSZM** - A JavaScript Z-machine interpreter runs the original game files in the browser
2. **Tambo** - Provides the AI layer that translates natural language to parser commands via tool calling
3. The AI is prompted to stay in character as the game narrator, translating errors and responses to feel native to the game world

## Configuration

Set your Tambo API key in `.env`:

```
VITE_TAMBO_API_KEY=your_api_key_here
```

Get an API key at [tambo.co](https://tambo.co).

## Adding Games

Place Z-machine game files (.z3, .z5, .z8) in the `public/` directory and update the game path in `src/App.tsx`.

## Built With

- [Tambo](https://tambo.co) - AI tool calling and natural language processing
- [JSZM](https://github.com/AntoineSierra/jszm) - JavaScript Z-Machine interpreter
- [Vite](https://vitejs.dev) + [React](https://react.dev) - Frontend framework
