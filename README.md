# 🏙️ Three.js City Simulation

A SimCity-style city builder that runs entirely in the browser. Zone land, lay roads, and watch your city grow: buildings develop and level up, citizens move in and look for jobs, traffic appears on your streets - and neglected neighborhoods fall into abandonment.

Built with **Three.js** and **TypeScript**. No framework, no backend - just a simulation model, a renderer, and a grid full of possibilities.

<!-- TODO: add screenshot or GIF here -->
<!-- ![screenshot](docs/screenshot.png) -->

## ✨ Features

- **Zoning** - place residential, commercial, and industrial zones. Zones with road access develop on their own: construction site → building → upgrades through 3 levels, with randomized building styles for visual variety.
- **Roads that connect themselves** - road tiles automatically become straights, corners, T-junctions, and intersections based on their neighbors.
- **A living population** - citizens move into residential zones with names, ages, and an employment lifecycle (school, working age, retirement). Workers search nearby commercial and industrial zones for jobs.
- **Traffic** - vehicles spawn on the road network and drive it lane-by-lane, scaled to your population.
- **Urban decay** - cut off a neighborhood from the road network and buildings will eventually be abandoned. Reconnect it and they can redevelop.
- **Inspection tools** - select any tile to see its building state, level, and a list of its residents or workers. Pause the simulation at any time.
- **Isometric-style camera** - orbit, pan, and zoom over your city (orthographic projection, soft shadows).

## 🎮 Controls

| Action | Input |
|---|---|
| Use active tool (place / select / bulldoze) | Left click (drag to paint) |
| Orbit camera | Right click + drag |
| Pan camera | Ctrl + right click + drag (or two-finger drag on touch) |
| Zoom | Mouse wheel |
| Switch tools | Toolbar (select, residential, commercial, industrial, road, bulldoze) |
| Pause / resume | Toolbar pause button |

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

- **Simulation model** (`src/city`) - pure TypeScript data: a tile grid, buildings composed from small attribute objects (development, residents, jobs, road access), and citizens. It ticks once per second.
- **Render layer** (`src/sceneManager`, `src/assetManager`, `src/cameraManager`) - Three.js. After each tick, only buildings flagged as changed get their meshes rebuilt; rendering itself runs at full display rate.

Roughly 40 low-poly GLB models are mapped to building type + style + level, and all simulation balance (development chances, construction time, job search distance, vehicle behavior…) lives in one config file: `src/config.ts`. Tweak it and see your city behave differently.

For the full picture - data flow, the development state machine, the vehicle graph, and step-by-step recipes for adding new building types or mechanics - see:

- [`AGENTS.md`](AGENTS.md) - contributor guide with conventions, commands, and known gotchas (agent-agnostic: usable as CLAUDE.md, Cursor rules, or Copilot instructions).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - deep-dive into every system, plus extension recipes.

## 🛠️ Tech stack

- [Three.js](https://threejs.org/) - rendering (orthographic camera, GLTF models, shadows)
- TypeScript (strict mode)
- Webpack 5 - dev server + production build with Three.js minification
- Plain DOM for UI - no framework

## 🗺️ Ideas / roadmap

- Save & load (the model is close to serializable - see notes in `docs/ARCHITECTURE.md`)
- More building types already sitting in `src/assetManager/models/glb` (parks, schools, skyscrapers, harbors…)
- Utilities and services: power, land value, happiness - the attribute system was designed for exactly this
- Real commuting: pathfinding over the existing directional road graph instead of random vehicle wandering
- Larger maps with instanced rendering

## 📄 License

ISC
