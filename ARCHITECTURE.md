# Architecture - threejs-city-simulation

## 1. The two worlds

The codebase is split into a **simulation model** and a **render layer**. They used to be connected only through `Game` and `SceneManager.update()`; the simulation model now also talks to itself (and to `Game`/UI) through a typed event bus, rather than everything being read by polling.

```
                    ┌──────────────────────────────┐
                    │            Game              │
                    │  tool dispatch · tick · input │
                    └───────┬──────────────┬───────┘
              step() 1x/sec │              │ mouse/touch events, cityEvents
                            ▼              ▼
   ┌────────────────────────────┐   ┌─────────────────────────────┐
   │      SIMULATION MODEL      │   │        RENDER LAYER         │
   │        (src/city)          │   │ (sceneManager, assetManager,│
   │                            │   │        cameraManager)       │
   │ City ──cityEvents──┐       │   │                             │
   │  └─ Tile[size][size]│      │   │ SceneManager                │
   │      ├─ RoadAccessAttr│    │◄──┤  ├─ terrain: 1 InstancedMesh│
   │      └─ Building?    │     │   │  ├─ buildings: pool per model│
   │          ├─ Zone      │    │   │  ├─ VehicleGraph (Group)    │
   │          │   ├─ Development│  │  ├─ raycaster / picking     │
   │          │   ├─ Residents  │  │  └─ lights, grid            │
   │          │   │   └─Citizen*│  │ AssetManager (GLB cache,    │
   │          │   └─ Jobs       │  │   InstancedMesh geometry bake)│
   │          └─ Road           │   │ CameraManager (ortho cam,   │
   └────────────────────────────┘   │   scales with CITY.SIZE)    │
                                    └─────────────────────────────┘
```

Two clocks drive everything (a single, non-duplicated sim tick):

| Clock | Rate | Drives |
|---|---|---|
| `setInterval(step, 1000)` in `Game` | 1 Hz | `city.simulate()`, `sceneManager.update(city)`, top bar, info panel |
| `renderer.setAnimationLoop(draw)` | display refresh | `vehicleGraph.updateVehicles()`, `renderer.render()` |
| `setInterval(spawnVehicle, SPAWN_INTERVAL)` in `VehicleGraph` | 1 Hz | vehicle spawning |

A "day" in sim terms = one `step()` = one `simulate()` pass over every tile. Sim-affecting randomness (RNG, see §2.7) and event side effects (§2.8/§2.9) both happen inside that same pass, before `sceneManager.update()` reads the results.

---

## 2. Simulation model (`src/city`)

### 2.1 City

`City` is a `size × size` grid of `Tile` (size from `CONFIG.CITY.SIZE`). Key members:

- `getTile(x, y)` / `getTileByCoordinate({x,y})` - bounds-checked access (the latter logs errors on bad input).
- `getTileNeighbors(x, y)` - 4-connected neighbors.
- `findTile(start, filter, maxDistance)` - **the workhorse**: BFS from a start coordinate, Manhattan-distance capped, returns first tile passing `filter`. Used for road-access checks and citizen job search. Note it BFSes through *all* tiles (not just roads), so "distance" is grid distance, not road-network distance.
- `population` - a readonly getter, sums residents across ResidentialZones, returns a **number** (not a string - `ui/TopBar` and `VehicleGraph` both consume it directly).
- `simulate()` - calls `tile.simulate(city)` on every tile. Does **not** touch road access; that's handled reactively (§2.8).
- Constructor subscribes to `cityEvents` (`roadNetworkChanged` → `recomputeRoadAccessNear(x,y)`, `buildingPlaced` → recompute just the new tile) - see §2.8.

### 2.2 Tile

Owns `terrain` (always `'ground'` today), an optional `building`, and a `RoadAccessAttribute`. `simulate()` forwards to building + roadAccess. `placeBuilding(type)` delegates to the factory and emits `buildingPlaced` (plus `roadNetworkChanged` if the new building is a road); `removeBuilding()` disposes and emits `buildingRemoved` (plus `roadNetworkChanged` if the removed building was a road). `toHTML()` renders the info-panel content and appends the building's own `toHTML()`.

### 2.3 Buildings

Class hierarchy:

```
Building (id, name, type, isMeshOutOfDate, hideTerrain, rotation?)
├── Road            - auto-styling every tick, hideTerrain = true
└── Zone            - style A–C (random), DevelopmentAttribute, rotation (random 0/90/180/270)
    ├── ResidentialZone  + ResidentsAttribute
    ├── CommercialZone   + JobsAttribute, generated shop name
    └── IndustrialZone   + JobsAttribute, generated factory name
```

`buildingCreator.ts` is the single factory (`createBuilding(x, y, type)`) and defines the `BuildingEntity` union. Anything that switches on building type lives either here or in `AssetManager.resolveBuildingInstance` (§3.1).

**Road auto-styling**: `Road.simulate()` inspects its four neighbors for other roads and sets `style` (`END | STRAIGHT | CORNER | THREE-WAY | FOUR-WAY`) + `rotation.y`, then unconditionally flags `isMeshOutOfDate` - every tick, even when nothing about the neighbors actually changed. `SceneManager` compensates for this on the render side (§3.2) rather than `Road` gaining a "did anything change" guard, so placing/removing an adjacent road still fixes styling on the next tick with no explicit neighbor notification, but a no-op tick doesn't churn any rendering state.

### 2.4 The attribute system (the key extension pattern)

Behaviors are composed, not inherited. Each attribute:

- takes its owner (`Zone` or `Tile`) in the constructor,
- exposes `simulate(city)` or `update(city)` called from the owner's `simulate()`,
- exposes `dispose()` and `toHTML()`,
- mutates owner state through setters that flag `isMeshOutOfDate` when visuals change, and emit a `cityEvents` event when the change is one other systems (UI, other tiles) care about.

Current attributes:

| Attribute | Owner | Responsibility | Events emitted |
|---|---|---|---|
| `RoadAccessAttribute` | Tile | `value: boolean`, recomputed reactively (§2.8) rather than every tick | none (a pure value; other code reads `roadNetworkChanged`/`buildingPlaced` to know when to recompute it) |
| `DevelopmentAttribute` | Zone | State machine: `undeveloped → under-construction → developed ⇄ abandoned`, plus level 1–3. All transitions are chance-based via `CONFIG.ZONE.*` and use the seeded `random()` (§2.7). Road access is both the development criterion and (absence of it) the abandonment criterion | `developmentStateChanged`, `levelChanged` (both only on an actual transition, not every setter call) |
| `ResidentsAttribute` | ResidentialZone | Move-in chance per tick up to `MAX_RESIDENTS ^ level`; evicts all on abandonment; steps each `Citizen` | `citizenMovedIn`, `citizenMovedOut` |
| `JobsAttribute` | Commercial/IndustrialZone | Capacity `MAX_WORKERS ^ level`; `hire(citizen)`/`layOff(citizen)` manage the workers array; `layOffWorkers()` clears everyone on abandonment | `citizenEmployed`, `citizenUnemployed` |

**Development state machine** (all thresholds/chances in `config.ts`):

```
UNDEVELOPED ──(road access && REDEVELOP_CHANCE)──► UNDER_CONSTRUCTION
UNDER_CONSTRUCTION ──(CONSTRUCTION_TIME ticks)──► DEVELOPED (level 1)
DEVELOPED ──(no road access > ABANDONMENT_THRESHOLD ticks, then ABANDONMENT_CHANCE)──► ABANDONED
DEVELOPED ──(LEVEL_UP_CHANCE, level < maxLevel)──► level++
ABANDONED ──(road access restored, REDEVELOP_CHANCE)──► DEVELOPED
```

`maxLevel` is set once, per zone subclass, through the `Zone` constructor and stored solely on `DevelopmentAttribute` - there's no separate/duplicate cap anywhere else. `IndustrialZone` passes `1` ("limiting to one due to lack of industrial models"), `ResidentialZone`/`CommercialZone` pass `3`.

### 2.5 Citizens

Created by `ResidentsAttribute` with a random name and age 1–100 (via `random()`, §2.7). State machine per tick:

- age < 16 → `school`, age ≥ 65 → `retired` (both inert),
- `unemployed` → BFS via `city.findTile` (max `CONFIG.CITIZEN.MAX_JOB_SEARCH_DISTANCE`) for a Commercial/Industrial zone with `availableJobs > 0`; on success calls into that zone's `JobsAttribute.hire(citizen)` and becomes `employed` (which emits `citizenEmployed`),
- `employed` → falls back to `unemployed` if workplace is nulled (layoffs, which emit `citizenUnemployed`).

Citizens exist only as data hanging off residential zones - they have no world position and no meshes. They're surfaced in the InfoPanel and drive the population counter (which in turn throttles vehicle spawning), and their move-in/move-out/employment transitions are what `Game`'s event subscriptions (§2.9) listen for to refresh the UI without polling.

### 2.6 Vehicles (`src/city/vehicle`) - cosmetic layer

Despite living under `src/city`, this is render-side: `VehicleGraph extends THREE.Group` and is owned by `SceneManager`.

- **Graph**: each road tile gets a `VehicleGraphTile` subclass matching its style (end/straight/corner/tee/four-way), containing `VehicleGraphNode`s (points with directed `connect` edges) arranged for right-hand traffic. Tiles expose `getWorldLeftSide()` etc. (rotation-aware) so `VehicleGraph.updateTile` can stitch adjacent tiles' `in`/`out` nodes together when roads are placed/removed. `SceneManager.update` calls `updateTile(x, y, building|null)` whenever a road's rendered state actually changes (not on every redundant `isMeshOutOfDate`, per §3.2's dedup).
- **Vehicles**: spawned on an interval, capped by `Math.min(population-derived count, CONFIG.VEHICLE.MAX_VEHICLE_COUNT)` - the config cap is enforced today, not dead. A `Vehicle` lerps between its origin and destination node positions over `distance / SPEED` ms, then picks a random next node (`getRandomNextNode`, using bare `Math.random()` - cosmetic, not sim state, so it's exempt from the seeded-RNG rule), fading in/out and dying after `MAX_LIFETIME`. There is **no pathfinding and no destination intent** - it's a random walk over the road graph.
- `VehicleGraphHelper` visualizes nodes/edges, gated behind `CONFIG.DEBUG.SHOW_VEHICLE_GRAPH` (default `false`). It used to rebuild on every road edit regardless of whether anyone could see it (an O(citySize²) rebuild for a permanently-invisible mesh); it's now skipped entirely unless the flag is on.

If you add real traffic (commute simulation), the graph is already directional and per-lane; you'd add A* over `VehicleGraphNode`s and give vehicles a route queue instead of `getRandomNextNode`.

### 2.7 Seeded RNG (`src/utils/rng.ts`)

Sim code calls `random()` from `src/utils/rng.ts` instead of bare `Math.random()`:

```ts
export function mulberry32(seed: number): RNG { /* small, fast, deterministic PRNG */ }
let rng: RNG = mulberry32(Date.now());
export function setSeed(seed: number): void { rng = mulberry32(seed); }
export function random(): number { return rng(); }
```

Production defaults to a `Date.now()` seed (nondeterministic per page load, but every draw within a session comes from one shared generator); tests call `setSeed(...)` or mock the module directly for reproducible sequences. Every sim-affecting random choice goes through this - zone style/rotation, citizen age/name generation, and every chance-based transition in `DevelopmentAttribute`/`ResidentsAttribute`. The one known exception is `AssetManager`'s vehicle-model pick (`Math.floor(types.length * Math.random())`) and `VehicleGraphNode`'s next-node walk, both cosmetic/render-side choices rather than sim state, so nondeterminism there doesn't affect simulation reproducibility - if you ever need deterministic *replays* including vehicle visuals, that's the remaining gap to close.

### 2.8 Reactive road access

`RoadAccessAttribute.recompute(city)` runs the same BFS (`city.findTile` capped at `CONFIG.ATTRIBUTES.ROAD_ACCESS.SEARCH_DISTANCE`) it always did, but it's no longer called from `City.simulate()` every tick for every tile. Instead, `City`'s constructor subscribes:

```ts
cityEvents.on('roadNetworkChanged', ({ x, y }) => this.recomputeRoadAccessNear(x, y));
cityEvents.on('buildingPlaced', ({ x, y }) => this.getTile(x, y)?.roadAccess?.recompute(this));
```

`recomputeRoadAccessNear(x, y)` recomputes only the tiles within `SEARCH_DISTANCE` (the same Manhattan-distance diamond the BFS itself is bounded to) of the road that was just added or removed - exactly the set of tiles whose own search could possibly have reached that coordinate. A brand-new tile also gets one recompute on `buildingPlaced` since it's never been evaluated. The rest of the time, `tile.roadAccess.value` is just a cached boolean read every tick at zero cost. This closes what used to be the single biggest sim cost driver (O(tiles × search area) per second, unconditionally) down to "only recompute what a road edit could have affected."

### 2.9 Event bus (`src/events`)

A minimal typed pub/sub, generic over an event map:

```ts
export class EventBus<EventMap extends Record<string, unknown>> {
  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): Unsubscribe;
  off<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
}
export const cityEvents = new EventBus<CityEventMap>();
```

`CityEventMap` lists every event and its payload: `buildingPlaced`/`buildingRemoved` (`{x,y}` [+`buildingType`]), `developmentStateChanged`/`levelChanged` (`{x,y,state|level,previous...}`), `citizenMovedIn`/`citizenMovedOut`/`citizenEmployed`/`citizenUnemployed` (`{citizenId,x,y}`), `roadNetworkChanged` (`{x,y}`). Emitters are the attributes/`Tile` methods listed in §2.2/§2.4; there are two kinds of subscribers:

- **`City` itself** (§2.8) - reactive road access, the only subscriber that feeds back into simulation state.
- **`Game`** (`subscribeToCityEvents()`) - UI-only reactions: `citizenMovedIn`/`citizenMovedOut` update the population counter; all eight events call `refreshInfoOverlayIfFocused(payload)`, which only re-renders the info panel if the changed tile is the one currently selected.

The render layer (`SceneManager.update()`) deliberately does **not** subscribe to events - it still walks every tile once per tick and checks `isMeshOutOfDate`, since that flag-and-diff approach is simpler to reason about for mesh lifecycle than trying to map every event type to a partial re-render. If you add a new cross-cutting concern (a new UI panel that needs to react to a sim change, another system that needs to know when roads change), prefer subscribing to the relevant event over adding a new poll loop or threading a callback through several layers.

---

## 3. Render layer

### 3.1 AssetManager

- Loads every GLB registered in `assetManager/models/index.ts` at startup via `GLTFLoader`; fires `onLoad` when all are in. `modelsFiles.ts` only imports the ~38 GLBs actually referenced by the registry (pruned from an original 258 - unused imports were dead bundle weight, since webpack's `file-loader` emits whatever is imported regardless of whether it's ever used at runtime).
- All models get a shared `MeshLambertMaterial` with the `base` texture + specular map, scaled by `scale/30`.
- **Two ways a model becomes visible**, depending on whether it's rendered once or thousands of times:
  - `cloneMesh(name, transparent?, material?)` - deep-clones the loaded model with a per-clone material. Used for **vehicles** (moving, individually animated - instancing doesn't fit) and the **placement preview ghost** (one throwaway translucent mesh at a time).
  - `createModelInstancedMesh(modelKey, count)` / `createTerrainInstancedMesh(count)` - bakes the loaded model's transform (`matrixWorld`) into a cloned geometry once, then hands `SceneManager` a `THREE.InstancedMesh` with that baked geometry and a shared material. Used for **terrain** and **every placed building/road**, since those can number in the thousands on a large map and per-tile `Object3D`/material overhead stops being free well before that.
- **Name resolution contract** (unchanged by instancing - it's still how a tile's building maps to a model):
  - zones: `${zone.type}-${zone.style}${zone.development.level}` (e.g. `COMMERCIAL-A2`); under-construction/undeveloped → `UNDER-CONSTRUCTION`,
  - roads: `${road.type}-${road.style}` (e.g. `ROAD-THREE-WAY`),
  - vehicles: random pick among models with `type === VEHICLE`.
- `resolveBuildingInstance(tile)` replaces the old `createBuildingMesh` - instead of building a mesh, it returns `{ modelKey, matrix, abandoned }` (position/rotation as a `THREE.Matrix4`, plus whether the zone is abandoned, for the base tint). `SceneManager` is the one that actually places this into an instance pool - see §3.2.
- If you add a model, its `ModelKey` entry must exist in `models/index.ts` (with a matching GLB import in `modelsFiles.ts`) or resolution silently returns `null` and the tile renders nothing.

### 3.2 SceneManager

Terrain and every building are each backed by `InstancedMesh`, not one mesh per tile:

- **Terrain**: one `InstancedMesh` sized `citySize × citySize`, built once in `setupTerrain()`. Per-tile visibility (a building with `hideTerrain` covering the ground) is done by scaling that instance's matrix to zero rather than toggling a `visible` flag (`InstancedMesh` has no per-instance visibility), and only the instances whose hidden-state actually *changed* this tick get their matrix rewritten - not the whole buffer every tick.
- **Buildings**: one growable `InstancedMesh` **pool per distinct model** (`Map<ModelKey, BuildingPool>`), since there are ~20 distinct zone/road models rather than one repeated shape like grass. Each pool tracks a free-slot list and a `tileAtSlot` reverse-lookup array. Placing a building allocates a slot (doubling the pool's capacity via a brand-new `InstancedMesh` + copying every existing instance's matrix/color over, if the pool is full); bulldozing frees it (zero-scale + push the slot back onto the free list); a building leveling up or otherwise changing its resolved `ModelKey` frees its old slot and allocates a new one in the different pool. Crucially, `update()` compares the newly-`resolveBuildingInstance`-d model/transform/tint against what a tile's slot record already holds, and skips all of this entirely if nothing actually changed - which matters because `Road.simulate()` sets `isMeshOutOfDate` every tick regardless (§2.3), and without this check every road tile in the city would churn its pool slot every second.
- **Picking**: `getSelectedObject(event)` raycasts against the whole scene. A hit on an `InstancedMesh` (terrain or any building pool) carries `intersection.instanceId`, which is resolved back to a tile via that pool's `tileAtSlot` array, then stashed as `userData` on the shared mesh just before returning it - valid only because the very next thing the caller does (in the same synchronous mouse-event handler) is read that `userData`, before any other raycast can run and overwrite it. Vehicles are still individual meshes, but aren't tied to a single tile and don't carry tile `userData` at all - a raycast hit on one falls through to the generic non-`InstancedMesh` path with whatever default `userData` it has (which `Game`'s `typeof tile?.placeBuilding === "function"` guard then correctly rejects as "not a tile"). Non-pickable objects (the ground grid overlay, the preview ghost) set `userData.nonInteractive = true` and are skipped.
- **Highlight/selection**: an `InstancedMesh` has no per-instance emissive, so hover/select tinting is done via `InstancedMesh.setColorAt` - a lerp from the instance's stored *base* tint (white normally, grey `0x707070` if a zone is abandoned) toward a highlight color (pale blue for hover, warm gold for select), tracked as a single shared `(mesh, instanceIndex)` pair rather than a per-object flag. Two things to know if you touch this: a highlight color lerped toward pure white is a no-op against a white base tint (color-management gamma compression makes the shift imperceptible near the top of the range even before that) - pick a saturated color and a strong blend amount instead; and hovering the currently-*selected* tile must not clobber its select tint with the hover tint, which needs an explicit "is this the same (mesh, index) as the active selection" check rather than relying on object-reference equality (every terrain hover and every same-model building hover *is* the same shared mesh object). Vehicles, not being instanced, still use plain `mesh.material.emissive.setHex(color)`.
- Lights: one shadow-casting directional "sun" + low ambient, both the light's target and its shadow-camera frustum (`left/right/top/bottom/near/far`) derived from `CONFIG.CITY.SIZE` rather than hardcoded for a 16-tile map - grow the map and both scale automatically.

### 3.3 CameraManager

Orthographic camera orbiting a `cameraOrigin` on a sphere (azimuth/elevation/radius-as-zoom). Right-drag orbits, Ctrl+right-drag pans, wheel zooms, two-finger touch pans (no pinch-zoom yet). `camera.zoom = cameraRadius` - "radius" is really zoom level. The origin (map center), starting zoom (framed to show the whole map plus margin), and zoom-out limit all derive from `citySize` passed into the constructor, rather than being tuned only for size 16 - `MIN_CAMERA_RADIUS_AT_SIZE_16` in `constants.ts` documents its own scaling factor (`× 16/citySize`) in its name.

### 3.4 UI (`src/ui`)

Pure DOM, created once by `createUi()`:

- **TopBar** - population counter (`#population-counter`), refreshed on `citizenMovedIn`/`citizenMovedOut` events rather than every tick unconditionally.
- **ToolBar** - buttons generated from `TOOLBAR_BUTTONS` in `ui/constants.ts`; each carries `data-type` matching a `BUILDING_TYPE` (or SELECT/BULLDOZE/TOGGLE_PAUSE). `Game.onToolSelected` reads `data-type` into `activeToolId`, which is also the lookup key into the `Tool` registry (§3.5).
- **InfoPanel** - `#info-overlay-details`, filled with `tile.toHTML()` for the focused object, refreshed by the same event subscriptions that drive the top bar (only when the changed tile is the currently-focused one).

`Game.isEventFromUiElement` guards world input against clicks on `#ui-topbar`, `#ui-toolbar`, `#ui-info-overlay` - keep new UI containers in that list (or give them one of those ids as ancestor).

### 3.5 Tool system (`src/game/tools`)

```ts
interface GameContext {
  city: ICity;
  sceneManager: ISceneManager;
  assetManager: IAssetManager;
  setFocusedTile(tile: ITile | null): void;
}
interface ToolPreview { mesh: THREE.Object3D; valid: boolean; }
interface Tool {
  readonly id: string;
  onTileClick(tile: ITile, object: THREE.Object3D, context: GameContext): void;
  onDrag?(tile: ITile, object: THREE.Object3D, context: GameContext): void;   // falls back to onTileClick
  getPreview?(tile: ITile, context: GameContext): ToolPreview | null;         // ghost mesh while hovering
}
```

`createTools()` builds one instance each of `SelectTool`, `BulldozeTool`, and a `BuildingTool` per placeable type (`RESIDENTIAL`/`COMMERCIAL`/`INDUSTRIAL`/`ROAD` - roads are just `new BuildingTool(BUILDING_TYPE.ROAD)`, not a separate class), keyed into `Record<string, Tool>` by `tool.id`. `Game` holds that registry and `activeToolId`; dispatch is a table lookup, not an if/else chain:

```ts
const tool = this.activeToolId ? this.tools[this.activeToolId] : undefined;
const handler = (isDrag && tool.onDrag) || tool.onTileClick;
handler.call(tool, tile, object, this.gameContext);
```

Adding a new tool means implementing `Tool` and registering it in `createTools()` - `Game` needs no changes.

### 3.6 Placement preview

While hovering with a placement tool active, `Game.updatePreview()` calls `tool.getPreview(tile, context)` (only `BuildingTool` implements it; `SelectTool`/`BulldozeTool` show no ghost) and forwards the result to `sceneManager.showPreviewMesh(mesh, valid)`. For roads, `AssetManager.createPreviewMesh` builds a throwaway `Road` and calls `road.simulate(city)` against the real city *without inserting it into the grid*, so the ghost shows the correct connector style for the tile's actual current neighbors; other zone types show the generic `UNDER-CONSTRUCTION` model. `showPreviewMesh` tints the whole ghost green/red for valid/invalid, makes it translucent with depth-testing disabled and a high `renderOrder` (so an invalid ghost sitting on top of an existing building isn't hidden by it), and flags every descendant `userData.nonInteractive = true` - otherwise the ghost could intercept its own raycast, read as "no tile," hide itself, and reappear the next frame in an infinite flicker loop.

### 3.7 Input flow

```
mousedown (left) ─► Game.onMouseDown ─► raycast ─► useActiveTool(hit)
                                        tools[activeToolId].onTileClick(tile, object, context)
mousemove ─► throttled 16ms ─► hover highlight; updatePreview (ghost mesh); drag-paint (button held)
                                reuses useActiveTool with tool.onDrag ?? tool.onTileClick
           └► cameraManager.onMouseMove (orbit/pan on RMB)
wheel ─► cameraManager.onMouseScroll
```

`useActiveTool` guards on `typeof tile?.placeBuilding === "function"` (duck-typing "is this actually a tile" from whatever the raycast returned) before ever looking up a tool - see §3.2 for why a hit's `userData` might not be tile-shaped at all (a vehicle, or nothing).

---

## 4. Extension recipes

### 4.1 Add a new building type (e.g. PARK or POWER_PLANT)

1. `src/city/building/constants/index.ts` - add to `BUILDING_TYPE` (and a `ROAD_TYPE`-style sub-enum if it has variants).
2. Create the class in `src/city/building/` (subclass `Building` for infrastructure, `Zone` if it should develop/abandon). Implement `simulate`, `dispose`, `toHTML`.
3. `buildingCreator.ts` - add a `case` and extend the `BuildingEntity` union.
4. Assets: add `ModelKey` entries (`assetManager/constants`), GLB import in `models/modelsFiles.ts` (only imported GLBs get bundled - don't import ones nothing references), and a `models/index.ts` entry with `type: modelType.ZONE` (or a new type).
5. `AssetManager.resolveBuildingInstance` - route the new type to a resolver branch (follow `resolveRoadInstance` for fixed models, `resolveZoneInstance` for style/level naming). No `SceneManager` changes needed - a new `ModelKey` just gets its own instance pool lazily, the first time a tile resolves to it.
6. `ui/constants.ts` - add a toolbar button (`id` must equal the `BUILDING_TYPE` value so `activeToolId` flows through unchanged); add icon in `assetManager/icons` if needed. If the new type is placeable, `createTools()` needs a `new BuildingTool(BUILDING_TYPE.YOUR_TYPE)` entry.
7. If it affects other buildings (e.g. power, land value), model that as a new **attribute** (next recipe) rather than special-casing in `simulate` loops.

### 4.2 Add a new attribute (e.g. PowerAttribute, LandValueAttribute)

1. New file in `src/city/building/attributes/`, class holding the owner, with `simulate(city)`/`update(city)`, `dispose()`, `toHTML()`.
2. Read tunables from `config.ts` (add a section to the `Config` interface and the `CONFIG` object, with a JSDoc comment stating each field's unit - ticks, ms, probability 0-1, etc. - matching the existing sections).
3. Compose it in the relevant zone(s): instantiate in constructor, call from `simulate`, `dispose`, `toHTML`.
4. If it changes visuals, mutate via setters that set `owner.isMeshOutOfDate = true`.
5. If another system (UI, another tile) needs to react to the change, add an event to `CityEventMap` and `emit` it from the setter, rather than having that other system poll.
6. Mirror `RoadAccessAttribute` if it's tile-level rather than zone-level, and consider whether it needs a reactive-recompute pattern like road access (§2.8) instead of a per-tick pass, if the underlying computation is expensive and rarely-invalidated.

### 4.3 Add a stat to the top bar

Compute it on `City` as a getter returning a number (see `population`), add a DOM node in `ui/TopBar`, update it from the relevant `cityEvents` subscription in `Game` rather than polling every tick.

### 4.4 Save/load (not yet implemented - guidance)

The model is nearly serializable, but: (a) attributes hold back-references to owners and citizens hold zone references - serialize by id and rehydrate; (b) meshes must be rebuilt by flagging every building `isMeshOutOfDate` and calling `sceneManager.update(city)`; (c) `VehicleGraph` must be rebuilt from road tiles (`updateTile` per road); (d) a seeded RNG already exists (`src/utils/rng.ts`) - persist the seed (and ideally the draw count, or reseed at load and accept minor divergence) for reproducibility.

### 4.5 Growing the map

Bump `CONFIG.CITY.SIZE` - camera framing/zoom limits and the shadow-camera frustum both already scale with it, and road-access recomputation is already bounded to the area around each changed road rather than scanning the whole map (§2.8), so none of those need manual retuning anymore. What's still worth checking at a much larger size: how many distinct building-model pools end up in active use at once and how large the biggest one grows (each pool doubles its `InstancedMesh` capacity - and rebuilds it - when it fills up, so a map that ends up mostly one repeated building type will do a handful of pool-growth reallocations early on, not a problem in itself but worth being aware of if you're profiling), and whether `VehicleGraph`'s population-derived spawn count needs a smaller ratio at very large populations.

---

## 5. Performance notes

- Terrain and every placed building/road are `InstancedMesh` (one pool per distinct model), not a clone per tile - see §3.2 for the pool/picking/highlight mechanics this requires. Vehicles remain individual cloned meshes (moving, and few enough relative to buildings/terrain that instancing them hasn't been worth the added complexity of per-instance animation state - see §2.6 for what that would take).
- Road access is recomputed reactively on `roadNetworkChanged`/`buildingPlaced`, bounded to the search radius around the change, instead of a BFS per tile per tick (§2.8) - this was the main sim cost driver before the fix.
- `SceneManager.update` is still a full per-tile pass each tick, but it's a diff in two senses now: `isMeshOutOfDate` gates whether a tile's building is touched at all, and even when it is, the resolved model/transform/tint is compared against what's already in place before touching the instance pool (§3.2) - so a tile whose flag gets set redundantly (any road tile, every tick) costs a comparison, not a pool churn.
- Vehicle count is capped by `Math.min(population-derived, CONFIG.VEHICLE.MAX_VEHICLE_COUNT)` - both bounds apply.

## 6. Testing & tooling

- `npm run typecheck` (`tsc --noEmit`), `npm run lint` (ESLint), `npm run test` (Vitest) all exist and pass on `main` - run all three before committing, there's no CI.
- Tests live alongside the code they test (`*.test.ts`). Sim-affecting randomness should be seeded/mocked in tests via `src/utils/rng.ts`'s `setSeed` (or `vi.mock`) rather than left nondeterministic.
- `npm run format` (Prettier) is available but not enforced by a pre-commit hook - run it if you're touching a file with inconsistent formatting.

## 7. Build system

- `webpack.common.js`: entry `src/main.ts`, `ts-loader`, `raw-loader` for GLSL (no shaders yet), `file-loader` for images/GLB/fonts, HtmlWebpackPlugin off `html/index.html`.
- `webpack.dev.js`: dev server. `webpack.prod.js`: clean + copy + three-minifier.
- `src/types.d.ts` declares module types for asset imports (`assets` type root in tsconfig) and `CustomWindow` (exposes `window.game` for console debugging - useful: `window.game.togglePause()`, inspect `window.game['city']`).
