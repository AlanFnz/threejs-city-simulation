# 🏙️ Three.js City Simulation

A SimCity-style city builder that runs entirely in the browser. Zone land, lay roads and power lines, build up civic services, and watch your city grow: buildings develop and level up, citizens move in and look for jobs, traffic appears on your streets - and neglected neighborhoods fall into abandonment (unless you've built the services to prevent it).

Built with **Three.js** and **TypeScript**. No framework, no backend - just a simulation model, a renderer, and a grid full of possibilities.

<!-- TODO: add screenshot or GIF here -->
<!-- ![screenshot](docs/screenshot.png) -->

## ✨ Features

- **Zoning** - place residential, commercial, and industrial zones from day one. Zones with road _and_ power access develop on their own: construction site → building → upgrades through several levels, with randomized building styles for visual variety.
- **Roads that connect themselves** - road tiles automatically become straights, corners, T-junctions, and intersections based on their neighbors.
- **Power grid with relay** - power plants and power lines form a grid; a zone doesn't need to be directly wired in - once connected, it relays power to its neighbors too. Each plant has a capacity, surfaced in its info panel.
- **A living population** - citizens move into residential zones with names, ages, and an employment lifecycle (school, working age, retirement). Workers search nearby commercial and industrial zones for jobs, and move-in slows down when there's nowhere to work.
- **Traffic** - vehicles spawn on the road network and drive it lane-by-lane, scaled to your population.
- **Urban decay** - cut off a neighborhood from the road network (or power grid) and buildings will eventually be abandoned. Reconnect it and they can redevelop.
- **Civic services** - fire stations, police stations, hospitals, and schools each protect or boost nearby zones (fire immunity, abandonment immunity, faster move-in, faster level-ups), unlocked as your population grows.
- **Economy** - every building costs money to place and money to maintain; residents and workers pay tax. Milestones grant cash bonuses, upkeep discounts, and raised zone level caps as your city grows.
- **Random events** - occasional windfalls, fires, and layoffs add variance on top of the steady simulation.
- **Goals** - a running list of population/money/zone-count milestones with real rewards (cash, discounts, unlocked civic tools, raised level caps).
- **Save & load** - your city persists in the browser (autosave + manual save/load/new game).
- **Inspection tools** - select any tile to see its building state, level, road/power/civic access, and a list of its residents or workers. Pause the simulation at any time.
- **Isometric-style camera** - orbit, pan, and zoom over your city (orthographic projection, soft shadows).

## 🎮 Controls

| Action                                      | Input                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Use active tool (place / select / bulldoze) | Left click (drag to paint)                                                                                                                     |
| Orbit camera                                | Right click + drag                                                                                                                             |
| Pan camera                                  | Ctrl + right click + drag (or two-finger drag on touch)                                                                                        |
| Zoom                                        | Mouse wheel                                                                                                                                    |
| Switch tools                                | Toolbar (select, residential, commercial, industrial, road, power plant, power line, fire station, police station, hospital, school, bulldoze) |
| Pause / resume                              | Toolbar pause button                                                                                                                           |
| Save / load / new game                      | Toolbar buttons (autosaves periodically too)                                                                                                   |

## 🚀 Getting started

```bash
git clone https://github.com/AlanFnz/threejs-city-simulation.git
cd threejs-city-simulation
npm install
npm run dev      # starts webpack-dev-server
```

Then open the URL printed in the terminal. For a production bundle:

```bash
npm run build
```

## 🧠 How it works (short version)

The code is split into two worlds that only meet at a sync point:

- **Simulation model** (`src/city`, `src/game`) - pure TypeScript data: a tile grid, buildings composed from small attribute objects (development, residents, jobs, road/power access, civic coverage), citizens, an economy (tax + upkeep), a power grid, milestones, and random events. It ticks once per second.
- **Render layer** (`src/sceneManager`, `src/assetManager`, `src/cameraManager`) - Three.js. After each tick, only buildings flagged as changed get their meshes rebuilt; rendering itself runs at full display rate.

44 low-poly GLB models are mapped to building type + style + level, and all simulation balance (development chances, construction time, job search distance, build costs, upkeep, milestone thresholds, random event odds, vehicle behavior…) lives in one config file: `src/config.ts`. Tweak it and see your city behave differently.

For the full picture - data flow, the development state machine, the vehicle graph, and step-by-step recipes for adding new building types or mechanics - see:

- [`AGENTS.md`](AGENTS.md) - contributor guide with conventions, commands, and known gotchas (agent-agnostic: usable as CLAUDE.md, Cursor rules, or Copilot instructions).
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - deep-dive into every system, plus extension recipes.

## 🛠️ Tech stack

- [Three.js](https://threejs.org/) - rendering (orthographic camera, GLTF models, shadows)
- [React](https://react.dev/) - typed, event-driven HUD
- TypeScript (strict mode)
- Webpack 5 - dev server + production build with Three.js minification

## 🗺️ Ideas / roadmap

- Real commuting: pathfinding over the existing directional road graph instead of random vehicle wandering
- More building types already sitting in `src/assetManager/models/glb` (parks, skyscrapers, harbors…)
- More utilities/services: land value, happiness, pollution - the attribute system was designed for exactly this
- Scenarios/difficulty modes and multiple save slots
- Audio and more ambient city feedback beyond the current typed notifications
- Larger maps, minimap, and further instanced-rendering scaling

## 📄 License

ISC
