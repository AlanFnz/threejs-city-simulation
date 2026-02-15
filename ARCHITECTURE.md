# Architecture - threejs-city-simulation

## 1. The two worlds

The codebase is split into a **simulation model** and a **render layer**, connected only through `Game` and `SceneManager.update()`.

```
                    ┌──────────────────────────────┐
                    │            Game              │
                    │  tool state · tick · input   │
                    └───────┬──────────────┬───────┘
              step() 1x/sec │              │ mouse/touch events
                            ▼              ▼
   ┌────────────────────────────┐   ┌─────────────────────────────┐
   │      SIMULATION MODEL      │   │        RENDER LAYER         │
   │        (src/city)          │   │ (sceneManager, assetManager,│
   │                            │   │        cameraManager)       │
   │ City                       │   │                             │
   │  └─ Tile[16][16]           │   │ SceneManager                │
   │      ├─ RoadAccessAttr     │◄──┤  ├─ terrain[][]  (meshes)   │
   │      └─ Building?          │   │  ├─ buildings[][] (meshes)  │
   │          ├─ Zone           │   │  ├─ VehicleGraph (Group)    │
   │          │   ├─ Development│   │  ├─ raycaster / picking     │
   │          │   ├─ Residents  │   │  └─ lights, grid            │
   │          │   │   └─Citizen*│   │ AssetManager (GLB cache)    │
   │          │   └─ Jobs       │   │ CameraManager (ortho cam)   │
   │          └─ Road           │   │                             │
   └────────────────────────────┘   └─────────────────────────────┘
```

Two clocks drive everything:

| Clock | Rate | Drives |
|---|---|---|
| `setInterval(step, 1000)` in `Game` | 1 Hz (see footgun #1 in AGENTS.md - currently registered twice) | `city.simulate()`, `sceneManager.update(city)`, top bar, info panel |
| `renderer.setAnimationLoop(draw)` | display refresh | `vehicleGraph.updateVehicles()`, `renderer.render()` |
| `setInterval(spawnVehicle, SPAWN_INTERVAL)` in `VehicleGraph` | 1 Hz | vehicle spawning |

A "day" in sim terms = one `step()` = one `simulate()` pass over every tile.

---

## 2. Simulation model (`src/city`)

### 2.1 City

`City` is a `size × size` grid of `Tile` (size from `CONFIG.CITY.SIZE`, currently 16). Key methods:

- `getTile(x, y)` / `getTileByCoordinate({x,y})` - bounds-checked access (the latter logs errors on bad input).
- `getTileNeighbors(x, y)` - 4-connected neighbors.
- `findTile(start, filter, maxDistance)` - **the workhorse**: BFS from a start coordinate, Manhattan-distance capped, returns first tile passing `filter`. Used for road-access checks and citizen job search. Note it BFSes through *all* tiles (not just roads), so "distance" is grid distance, not road-network distance.
- `getPopulation()` - sums residents across ResidentialZones, returns a **string**.
- `simulate()` - calls `tile.simulate(city)` on every tile.

### 2.2 Tile

Owns `terrain` (always `'ground'` today), an optional `building`, and a `RoadAccessAttribute`. `simulate()` forwards to building + roadAccess. `placeBuilding(type)` delegates to the factory; `removeBuilding()` disposes. `toHTML()` renders the info-panel content and appends the building's own `toHTML()`.

### 2.3 Buildings

Class hierarchy:

```
Building (id, name, type, isMeshOutOfDate, hideTerrain, rotation?)
├── Road            - auto-styling, hideTerrain = true
└── Zone            - style A–C (random), DevelopmentAttribute, rotation (random 0/90/180/270)
    ├── ResidentialZone  + ResidentsAttribute
    ├── CommercialZone   + JobsAttribute, generated shop name
    └── IndustrialZone   + JobsAttribute, generated factory name
```

`buildingCreator.ts` is the single factory (`createBuilding(x, y, type)`) and defines the `BuildingEntity` union. Anything that switches on building type lives either here or in `AssetManager.createBuildingMesh`.

**Road auto-styling**: `Road.simulate()` inspects its four neighbors for other roads and sets `style` (`END | STRAIGHT | CORNER | THREE-WAY | FOUR-WAY`) + `rotation.y`, then flags `isMeshOutOfDate`. This runs every tick, which also means placing/removing an adjacent road fixes itself on the next tick without explicit neighbor notification.

### 2.4 The attribute system (the key extension pattern)

Behaviors are composed, not inherited. Each attribute:

- takes its owner (`Zone` or `Tile`) in the constructor,
- exposes `simulate(city)` or `update(city)` called from the owner's `simulate()`,
- exposes `dispose()` and `toHTML()`,
- mutates owner state through setters that flag `isMeshOutOfDate` when visuals change.

Current attributes:

| Attribute | Owner | Responsibility |
|---|---|---|
| `RoadAccessAttribute` | Tile | BFS (`findTile`) for a road within `CONFIG.ATTRIBUTES.ROAD_ACCESS.SEARCH_DISTANCE`; sets boolean `value` |
| `DevelopmentAttribute` | Zone | State machine: `undeveloped → under-construction → developed ⇄ abandoned`, plus level 1–3. All transitions are chance-based via `CONFIG.ZONE.*`. Road access is both the development criterion and (absence of it) the abandonment criterion |
| `ResidentsAttribute` | ResidentialZone | Move-in chance per tick up to `MAX_RESIDENTS ^ level`; evicts all on abandonment; steps each `Citizen` |
| `JobsAttribute` | Commercial/IndustrialZone | Capacity `MAX_WORKERS ^ level`; lays off everyone on abandonment. Workers array is pushed into directly by `Citizen.findJob` |

**Development state machine** (all thresholds/chances in `config.ts`):

```
UNDEVELOPED ──(road access && REDEVELOP_CHANCE)──► UNDER_CONSTRUCTION
UNDER_CONSTRUCTION ──(CONSTRUCTION_TIME ticks)──► DEVELOPED (level 1)
DEVELOPED ──(no road access > ABANDONMENT_THRESHOLD ticks, then ABANDONMENT_CHANCE)──► ABANDONED
DEVELOPED ──(LEVEL_UP_CHANCE, level < maxLevel)──► level++
ABANDONED ──(road access restored, REDEVELOP_CHANCE)──► DEVELOPED
```

### 2.5 Citizens

Created by `ResidentsAttribute` with a random name and age 1–100. State machine per tick:

- age < 16 → `school`, age ≥ 65 → `retired` (both inert),
- `unemployed` → BFS via `city.findTile` (max `CONFIG.CITIZEN.MAX_JOB_SEARCH_DISTANCE`) for a Commercial/Industrial zone with `availableJobs > 0`; on success pushes itself into the zone's `jobs.workers` and becomes `employed`,
- `employed` → falls back to `unemployed` if workplace is nulled (layoffs).

Citizens exist only as data hanging off residential zones - they have no world position and no meshes. They're surfaced in the InfoPanel and drive the population counter (which in turn throttles vehicle spawning).

### 2.6 Vehicles (`src/city/vehicle`) - cosmetic layer

Despite living under `src/city`, this is render-side: `VehicleGraph extends THREE.Group` and is owned by `SceneManager`.

- **Graph**: each road tile gets a `VehicleGraphTile` subclass matching its style (end/straight/corner/tee/four-way), containing `VehicleGraphNode`s (points with directed `connect` edges) arranged for right-hand traffic. Tiles expose `getWorldLeftSide()` etc. (rotation-aware) so `VehicleGraph.updateTile` can stitch adjacent tiles' `in`/`out` nodes together when roads are placed/removed. `SceneManager.update` calls `updateTile(x, y, building|null)` whenever a road mesh is (re)built or removed.
- **Vehicles**: spawned on an interval, capped by population (`pop/2` - `CONFIG.VEHICLE.MAX_VEHICLE_COUNT` is currently unused). A `Vehicle` lerps between its origin and destination node positions over `distance / SPEED` ms, then picks a random next node (`getRandomNextNode`), fading in/out and dying after `MAX_LIFETIME`. There is **no pathfinding and no destination intent** - it's a random walk over the road graph.
- `VehicleGraphHelper` can visualize nodes/edges (debug aid).

If you add real traffic (commute simulation), the graph is already directional and per-lane; you'd add A* over `VehicleGraphNode`s and give vehicles a route queue instead of `getRandomNextNode`.

---

## 3. Render layer

### 3.1 AssetManager

- Loads every GLB listed in `assetManager/models/index.ts` at startup via `GLTFLoader`; fires `onLoad` when all are in. Webpack's `file-loader` turns GLB imports (`modelsFiles.ts`) into URLs.
- All models get a shared `MeshLambertMaterial` with the `base` texture + specular map, scaled by `scale/30`.
- `cloneMesh(name, transparent?, material?)` deep-clones with per-clone materials (required so highlight/abandonment tinting doesn't bleed across instances).
- **Name resolution contract**:
  - zones: `${zone.type}-${zone.style}${zone.development.level}` (e.g. `COMMERCIAL-A2`); under-construction/undeveloped → `UNDER-CONSTRUCTION`,
  - roads: `ROAD-${style}` (e.g. `ROAD-THREE-WAY`),
  - vehicles: random pick among models with `type === VEHICLE`.
- Abandoned zones get their material tinted grey (`0x707070`).
- Note: the `glb/` folder contains far more models than the ~40 registered in `models/index.ts` (parks, boats, skyscrapers, trains…). Adding variety is mostly a matter of registering them.

### 3.2 SceneManager

- Holds `terrain[][]` (grass meshes, one per tile, hidden when `building.hideTerrain`) and `buildings[][]` (nullable building meshes).
- `update(city)` per tile: remove mesh if building gone; rebuild mesh if `isMeshOutOfDate` (then clear the flag); notify `vehicleGraph.updateTile` for roads.
- **Picking**: `getSelectedObject(event)` raycasts against the whole scene and returns the first hit whose `userData.nonInteractive` isn't set. Because every tile/building mesh has `userData = tile` on the entire hierarchy, `Game` can treat any hit as a tile.
- Highlight (hover) and selection are done by setting material `emissive` (`0x555555` hover, `0xaaaa55` selected).
- Lights: one shadow-casting directional "sun" + low ambient. Shadow camera is tuned to a ~16-tile map; enlarge it if you grow `CITY.SIZE`.

### 3.3 CameraManager

Orthographic camera orbiting a `cameraOrigin` on a sphere (azimuth/elevation/radius-as-zoom). Right-drag orbits, Ctrl+right-drag pans, wheel zooms (clamped by constants in `cameraManager/constants.ts`), two-finger touch pans. `camera.zoom = cameraRadius` - "radius" is really zoom level.

### 3.4 UI (`src/ui`)

Pure DOM, created once by `createUi()`:

- **TopBar** - population counter (`#population-counter`), updated each tick.
- **ToolBar** - buttons generated from `TOOLBAR_BUTTONS` in `ui/constants.ts`; each carries `data-type` matching a `BUILDING_TYPE` (or SELECT/BULLDOZE/TOGGLE_PAUSE). `Game.onToolSelected` reads `data-type` into `activeToolId`.
- **InfoPanel** - `#info-overlay-details`, filled with `tile.toHTML()` for the focused object.

`Game.isEventFromUiElement` guards world input against clicks on `#ui-topbar`, `#ui-toolbar`, `#ui-info-overlay` - keep new UI containers in that list (or give them one of those ids as ancestor).

### 3.5 Input flow

```
mousedown (left) ─► Game.onMouseDown ─► raycast ─► useActiveTool(hit)
                                        SELECT   → setActiveObject + info panel
                                        BULLDOZE → tile.removeBuilding() + resim + update
                                        zone/road tool → tile.placeBuilding(activeToolId) + resim + update
mousemove ─► throttled 16ms ─► hover highlight; drag-paint (button held) reuses useActiveTool
           └► cameraManager.onMouseMove (orbit/pan on RMB)
wheel ─► cameraManager.onMouseScroll
```

Placement note: `useActiveTool` calls `tile.placeBuilding(this.activeToolId)` for *any* non-SELECT/BULLDOZE tool; invalid types just produce `undefined` from the factory. If you add non-building tools, branch before that fallback.

---

## 4. Extension recipes

### 4.1 Add a new building type (e.g. PARK or POWER_PLANT)

1. `src/city/building/constants/index.ts` - add to `BUILDING_TYPE` (and a `ROAD_TYPE`-style sub-enum if it has variants).
2. Create the class in `src/city/building/` (subclass `Building` for infrastructure, `Zone` if it should develop/abandon). Implement `simulate`, `dispose`, `toHTML`.
3. `buildingCreator.ts` - add a `case` and extend the `BuildingEntity` union.
4. Assets: add `ModelKey` entries (`assetManager/constants`), GLB import in `models/modelsFiles.ts` (many GLBs already exist in `models/glb/`), and a `models/index.ts` entry with `type: modelType.ZONE` (or a new type).
5. `AssetManager.createBuildingMesh` - route the new type to a mesh-creation branch (follow `createRoadMesh` for fixed models, `createZoneMesh` for style/level naming).
6. `ui/constants.ts` - add a toolbar button (`id` must equal the `BUILDING_TYPE` value so `activeToolId` flows through unchanged); add icon in `assetManager/icons` if needed.
7. If it affects other buildings (e.g. power, land value), model that as a new **attribute** (next recipe) rather than special-casing in `simulate` loops.

### 4.2 Add a new attribute (e.g. PowerAttribute, LandValueAttribute)

1. New file in `src/city/building/attributes/`, class holding the owner, with `simulate(city)`/`update(city)`, `dispose()`, `toHTML()`.
2. Read tunables from `config.ts` (add a section).
3. Compose it in the relevant zone(s): instantiate in constructor, call from `simulate`, `dispose`, `toHTML`.
4. If it changes visuals, mutate via setters that set `owner.isMeshOutOfDate = true`.
5. Mirror `RoadAccessAttribute` if it's tile-level rather than zone-level.

### 4.3 Add a stat to the top bar

Compute it on `City` (return a number, not a string), add a DOM node in `ui/TopBar`, update it in `Game.updateTitleBar`.

### 4.4 Save/load (not yet implemented - guidance)

The model is nearly serializable, but: (a) attributes hold back-references to owners and citizens hold zone references - serialize by id and rehydrate; (b) meshes must be rebuilt by flagging every building `isMeshOutOfDate` and calling `sceneManager.update(city)`; (c) `VehicleGraph` must be rebuilt from road tiles (`updateTile` per road); (d) introduce a seeded RNG first if you want reproducibility.

### 4.5 Growing the map

Bump `CONFIG.CITY.SIZE`, then also: enlarge the directional light's shadow camera bounds (`SceneManager.setupLights`), revisit `MIN/MAX_CAMERA_RADIUS` and initial `cameraOrigin`, and profile `findTile` - road access runs a BFS per tile per tick, which is the first thing to cache (e.g. dirty-flag road network changes and only recompute affected tiles).

---

## 5. Performance notes

- Meshes are cloned per tile (no instancing). Fine at 16×16; for bigger maps consider `InstancedMesh` for grass and repeated buildings.
- `RoadAccessAttribute` BFS per tile per tick is the main sim cost driver - O(tiles × search area) every second.
- `SceneManager.update` is already a diff (only `isMeshOutOfDate`), so keep the flag discipline.
- Vehicle count is population-coupled; if population scales up, re-enable `MAX_VEHICLE_COUNT` as a hard cap.

## 6. Build system

- `webpack.common.js`: entry `src/main.ts`, `ts-loader`, `raw-loader` for GLSL (no shaders yet), `file-loader` for images/GLB/fonts, HtmlWebpackPlugin off `html/index.html`.
- `webpack.dev.js`: dev server. `webpack.prod.js`: clean + copy + three-minifier.
- `src/types.d.ts` declares module types for asset imports (`assets` type root in tsconfig) and `CustomWindow` (exposes `window.game` for console debugging - useful: `window.game.togglePause()`, inspect `window.game['city']`).
