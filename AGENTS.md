# AGENTS.md - threejs-city-simulation

Agent-agnostic contributor guide (works as CLAUDE.md, AGENTS.md, .cursorrules source, or Copilot instructions).

SimCity-style city builder rendered with Three.js. TypeScript, no framework - plain DOM for UI, webpack for bundling. Single-player, browser-only, no backend. Persistence is local-only: one save slot in `localStorage` (`src/game/saveGame`).

## Commands

```bash
npm install
npm run dev        # webpack-dev-server (webpack.dev.js)
npm run build      # production build (webpack.prod.js, three-minifier)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run test       # vitest run
npm run format     # prettier --write .
```

TypeScript is `strict: true` - keep it that way. Run typecheck, lint, and test before committing; there is no CI.

## Architecture in one paragraph

`src/main.ts` instantiates `Game` (`src/game`). `Game` owns two worlds that must stay in sync: the **simulation model** (`City` → `Tile[][]` → `Building` + attribute objects, pure data, no Three.js) and the **render layer** (`SceneManager` + `AssetManager` + `CameraManager`, all Three.js). A single `setInterval(step, 1000)` ticks the sim once per second; each `step()` calls `city.simulate()` (every tile → building → attributes, economy accrual, `MilestoneTracker`/`RandomEventsSystem` checks), then `sceneManager.update(city)` which diff-rebuilds meshes flagged `isMeshOutOfDate`. Rendering runs independently at display rate via `renderer.setAnimationLoop`. Vehicles live in a separate `VehicleGraph` (a `THREE.Group` holding a node/edge network built from road tiles) and update every frame, not every sim tick. Cross-cutting state changes (a building placed, a citizen moving in, a zone leveling up, money changing) publish through a typed `EventBus` (`src/events`) rather than being read by polling. Game tools (select/bulldoze/zone/road/civic) implement a common `Tool` interface (`src/game/tools`) so `Game` dispatches through one path instead of an if/else chain. Every placement costs money and every tile of infrastructure accrues upkeep (`CONFIG.ECONOMY`); power plants and civic buildings (fire/police/hospital/school) each cover a bounded radius and gate progression through `MilestoneTracker`; the whole city state (economy, zones, citizens, milestones, zone level caps) round-trips through one `localStorage` save slot (`src/game/saveGame`).

See `docs/ARCHITECTURE.md` for the full deep dive, data-flow diagrams, and extension recipes.

## Directory map

```
src/
  main.ts              entry point; creates window.game = new Game()
  config.ts            ALL tunable sim constants (chances, thresholds, city size, vehicle params, debug flags), typed via a Config interface
  events/              typed EventBus + CityEventMap (buildingPlaced, developmentStateChanged, citizenMovedIn, roadNetworkChanged, ...)
  utils/rng.ts         seeded RNG (`random()`) - sim code uses this instead of bare Math.random() for determinism/testability
  game/                Game class: input routing, tool state, sim tick, UI refresh
    tools/             Tool interface + SelectTool/BulldozeTool/BuildingTool (roads/civic buildings are BuildingTool(BUILDING_TYPE.X))
    milestones/        MilestoneTracker - watches population/money/developedZoneCount, applies cash/upkeepDiscount/zoneLevelCap/unlockTool rewards once each
    randomEvents/      RandomEventsSystem - per-tick windfall/fire/layoffs rolls
    saveGame/          serialize/deserialize - single localStorage save slot, replays through public APIs (placeBuilding, development.state, jobs.hire)
  city/                simulation model (NO Three.js imports allowed here, except zone.ts's DEG2RAD)
    index.ts           City: tile grid, BFS findTile, population getter, economy (money/upkeep/netIncome), PowerGrid, civic-coverage recompute
    powerGrid.ts        PowerGrid: tracks plant capacity/load and tile→plant assignment (first-fit tryAssign)
    tile/              Tile: terrain + building slot + roadAccess/powerAccess/civic-coverage attributes
    building/
      building.ts      Building base class
      buildingCreator.ts  factory: BUILDING_TYPE → class; BuildingEntity union type
      road.ts          Road: auto-styles itself (straight/corner/tee/etc.) from neighbors every simulate() tick
      powerPlant.ts, powerLine.ts, fireStation.ts, policeStation.ts, hospital.ts, school.ts  fixed, non-developing buildings (no DevelopmentAttribute)
      zones/           Zone base (owns a DevelopmentAttribute with the zone's maxLevel, sourced from ZONE_LEVEL_CAPS) + Residential/Commercial/Industrial
      attributes/      composable behaviors: development, residents, jobs, roadAccess, powerAccess, civicCoverage
    citizen/           Citizen: age, employment state machine, job search (BFS, scaled by nearby job availability)
    vehicle/           VehicleGraph, VehicleGraphTile/Node, Vehicle (cosmetic traffic), VehicleGraphHelper (debug viz, gated by CONFIG.DEBUG.SHOW_VEHICLE_GRAPH)
  sceneManager/        Three.js scene, InstancedMesh lifecycle for terrain/buildings, raycasting/picking, highlight/select
  cameraManager/       orthographic camera: orbit (RMB), pan (Ctrl+RMB / two-finger), zoom (wheel); origin/zoom/shadow bounds scale with CONFIG.CITY.SIZE
  assetManager/        GLB loading, InstancedMesh pool geometry baking, model-name resolution, textures, icons
  ui/                  DOM-built UI: TopBar (population, money), ToolBar (tools, locked/unlocked via MilestoneTracker), InfoPanel (tile details incl. road/power/civic access, power-plant capacity), GoalsPanel (next milestone)
html/index.html        template; #render-target is the canvas host
```

## Core conventions

- **Model/render separation is sacred.** Simulation classes (`src/city/**`) never touch Three.js objects or the DOM (exception: `toHTML()` methods return HTML strings for the info panel). Rendering reads the model; the model never reads the scene.
- **Mesh invalidation**: any state change that should change a building's appearance must set `isMeshOutOfDate = true` (usually via a setter, see `DevelopmentAttribute.level/state`). `SceneManager.update()` picks it up on the next tick and re-resolves the tile's building instance - it also compares the newly-resolved model/transform/tint against what's already there, so a redundant flag-set (e.g. `Road.simulate()` sets it every tick regardless of whether connectivity actually changed) is a no-op rather than a pool churn.
- **Attribute composition over inheritance**: new building behaviors go in `src/city/building/attributes/` as classes that take the owning zone/tile in the constructor and expose `simulate/update(city)`, `dispose()`, `toHTML()`. Zones compose them and forward calls.
- **Determinism**: sim code uses `random()` from `src/utils/rng.ts`, not bare `Math.random()` - keep it that way so behavior stays seedable/testable. Rendering-only randomness (which vehicle model spawns) can stay on `Math.random()`.
- **Events over polling**: when one part of the sim needs to react to another (UI refresh, vehicle graph updates), prefer publishing/subscribing through the `EventBus` (`src/events`) over adding a new poll loop.
- **Adding a building type** touches, in order: `BUILDING_TYPE` constant → new class in `zones/` (or sibling of `road.ts`/`powerPlant.ts`) → `buildingCreator.ts` switch + `BuildingEntity` union → `ModelKey` enum + `models/index.ts` entry (+ GLB import in `modelsFiles.ts` - only imports listed there get bundled) → `AssetManager.resolveBuildingInstance` (or `resolveFixedBuildingInstance` for a fixed, non-developing building) → toolbar button in `ui/constants.ts` + `createTools()` → `CONFIG.ECONOMY.BUILD_COST`/`UPKEEP` entries → decide whether it starts in `STARTING_UNLOCKED_TOOLS` (`game/milestones/index.ts`) or is gated behind a new milestone.
- **Model naming contract**: zone meshes resolve to `${TYPE}-${style}${level}` (e.g. `RESIDENTIAL-B2`); roads to `ROAD-${style}`. `style` is a random letter A–C assigned at construction. GLB models only exist for **levels 1-3** for every zone type - a milestone can raise a zone's cap beyond that (`ZONE_LEVEL_CAPS`, `MilestoneTracker.raiseZoneLevelCap`), so `AssetManager.resolveZoneModelName` falls back to the highest modeled level ≤ the zone's actual level rather than looking up a nonexistent key. If you add real level-4+ models, extend that fallback's range accordingly - don't assume every level has a matching `ModelKey`.
- **All balance numbers live in `src/config.ts`** - never hardcode chances, distances, timings, costs, or upkeep in sim code.
- **Interfaces**: public shape of each class is declared as an `I`-prefixed interface next to it (or in `building/interfaces/`). Keep them updated when changing public members.
- **Raycast picking contract**: terrain and every building are each a shared `InstancedMesh` (one pool per distinct model), not one mesh per tile. A raycast hit's `intersection.instanceId` is resolved back to a tile via a per-pool lookup array, and the tile is stashed as `userData` on the shared mesh just before `getSelectedObject` returns it - this is only valid read synchronously by the caller in the same event handler, before any other raycast can run. Vehicles are still individual meshes with real per-object `userData`. Non-pickable objects (grid, preview ghosts) set `userData.nonInteractive = true`.
- **Highlight/tint contract**: instanced objects (terrain, buildings) are tinted via `InstancedMesh.setColorAt` (a lerp toward a highlight color, blended with the instance's base tint - normal vs. abandoned); non-instanced meshes (vehicles) still use `material.emissive`. A highlight color lerped toward pure white against a white base tint is a no-op - pick a color with visible contrast even at high brightness.

## When making changes

- Run `npm run typecheck && npm run lint && npm run test` before committing.
- Manual smoke test via `npm run dev`: place a power plant + power line + roads, zone all three types next to them, wait for construction → development → level-ups, verify vehicles spawn on roads, bulldoze works, select tool shows tile info (road/power/civic access, power-plant capacity), hover/select highlighting shows on both terrain and buildings, pause works, money decreases from upkeep and increases from taxes, the goals panel advances as milestones complete. Try a larger `CONFIG.CITY.SIZE` (e.g. 64) at least once after touching rendering/camera/shadow code - several past bugs only showed up off the default size-16 map. After touching save/load, milestones, or economy: save, reload the page, and confirm money/population/zones/milestones/unlocked tools all survive.
- Keep sim determinism in mind: sim randomness goes through `src/utils/rng.ts`'s `random()`, not bare `Math.random()`.
