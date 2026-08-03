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

Two clocks drive everything (one simulation scheduler plus the independent render loop):

| Clock                                                         | Rate            | Drives                                                                                                                                                                       |
| ------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setInterval(runScheduledSteps, 1000)` in `Game`              | 1 Hz scheduler  | Runs zero to three `step()` calls from pause/1×/2×/3× state; each drives `city.simulate()` (tile pass + economy accrual), milestone/random-event checks, scene sync, and reactive UI events |
| `renderer.setAnimationLoop(draw)`                             | display refresh | `vehicleGraph.updateVehicles()`, `renderer.render()`                                                                                                                         |
| `setInterval(spawnVehicle, SPAWN_INTERVAL)` in `VehicleGraph` | 1 Hz            | vehicle spawning                                                                                                                                                             |

A "day" in sim terms = one `step()` = one `simulate()` pass over every tile plus one economy/tax/upkeep collection (§2.10). The 1 Hz scheduler runs zero days while paused or one, two, or three days at the selected speed. Sim-affecting randomness (RNG, see §2.7) and event side effects (§2.8/§2.9) both happen inside each pass, before `sceneManager.update()` reads the results. `Game.step()` also runs `RandomEventsSystem.tick()` (§2.14) right after `city.simulate()` - milestones (§2.13) react to events emitted during either.

---

## 2. Simulation model (`src/city`)

### 2.1 City

`City` is a `size × size` grid of `Tile` (size from `CONFIG.CITY.SIZE`). Key members:

- `getTile(x, y)` / `getTileByCoordinate({x,y})` - bounds-checked access (the latter logs errors on bad input).
- `getTileNeighbors(x, y)` - 4-connected neighbors.
- `findTile(start, filter, maxDistance)` - **the workhorse**: BFS from a start coordinate, Manhattan-distance capped, returns first tile passing `filter`. Used for road-access checks and citizen job search. Note it BFSes through _all_ tiles (not just roads), so "distance" is grid distance, not road-network distance. `findTiles` is the same BFS but collects every match instead of stopping at the first (used for power-plant candidate selection, §2.11).
- `population` - a readonly getter, sums residents across ResidentialZones, returns a **number** (not a string - `ui/TopBar` and `VehicleGraph` both consume it directly).
- `money`/`netIncome`/`upkeepDiscount` (readonly getters), `canAfford`/`spend`/`earn`/`applyUpkeepDiscount`/`loadEconomyState` - the economy API, see §2.10.
- `checkPowerAccess(tile)`/`getPowerPlantLoad(plant)` - the power grid API, see §2.11.
- `simulate()` - calls `tile.simulate(city)` on every tile, then `collectEconomy()` (§2.10). Does **not** touch road/power access or civic coverage; those are handled reactively (§2.8, §2.11, §2.12).
- Constructor owns a `PowerGrid` (§2.11) and subscribes to `cityEvents`: `roadNetworkChanged` → `recomputeRoadAccessNear(x,y)` (§2.8); `powerNetworkChanged` → register/unregister the plant then `cascadePowerAccessChange(x,y)` (§2.11); `civicCoverageChanged` → `recomputeCivicCoverageNear(x,y)` (§2.12); `buildingPlaced` → recompute the new tile's road access, cascade power access, recompute its own civic coverage flags; `buildingRemoved` → release the tile's power-grid slot and cascade power access to neighbors (freeing a slot can let a neighbor pick it up).

### 2.2 Tile

Owns `terrain` (always `'ground'` today), an optional `building`, a `RoadAccessAttribute`, a `PowerAccessAttribute`, and four `CivicCoverageAttribute`s (`fireStationCoverage`/`policeStationCoverage`/`hospitalCoverage`/`schoolCoverage`). `simulate()` forwards to building + roadAccess (power access and civic coverage are recomputed reactively, not every tick - §2.8/§2.11/§2.12). `placeBuilding(type)` delegates to the factory and emits `buildingPlaced`, plus `roadNetworkChanged` if the new building is a road, `powerNetworkChanged` if it's a power plant/line, or `civicCoverageChanged` if it's one of the four civic types; `removeBuilding()` disposes and emits `buildingRemoved` plus the same conditional network event for whatever type was removed. Tiles remain pure model data; `game/inspector.ts` maps a focused tile to the typed UI view model described in §3.4.

### 2.3 Buildings

Class hierarchy:

```
Building (id, name, type, isMeshOutOfDate, hideTerrain, rotation?)
├── Road            - auto-styling every tick, hideTerrain = true
├── PowerPlant, PowerLine                                    - fixed, no DevelopmentAttribute
├── FireStation, PoliceStation, Hospital, School (civic)      - fixed, no DevelopmentAttribute
└── Zone            - style A–C (random), DevelopmentAttribute, rotation (random 0/90/180/270)
    ├── ResidentialZone  + ResidentsAttribute
    ├── CommercialZone   + JobsAttribute, generated shop name
    └── IndustrialZone   + JobsAttribute, generated factory name
```

`PowerPlant`/`PowerLine` and the four civic buildings are simple, non-developing `Building` subclasses - same shape as `Road` minus the auto-styling, since none of them change appearance after placement. `buildingCreator.ts` is the single factory (`createBuilding(x, y, type)`) and defines the `BuildingEntity` union. Anything that switches on building type lives either here or in `AssetManager.resolveBuildingInstance` (§3.1).

**Road auto-styling**: `Road.simulate()` inspects its four neighbors for other roads and sets `style` (`END | STRAIGHT | CORNER | THREE-WAY | FOUR-WAY`) + `rotation.y`, then unconditionally flags `isMeshOutOfDate` - every tick, even when nothing about the neighbors actually changed. `SceneManager` compensates for this on the render side (§3.2) rather than `Road` gaining a "did anything change" guard, so placing/removing an adjacent road still fixes styling on the next tick with no explicit neighbor notification, but a no-op tick doesn't churn any rendering state.

### 2.4 The attribute system (the key extension pattern)

Behaviors are composed, not inherited. Each attribute:

- takes its owner (`Zone` or `Tile`) in the constructor,
- exposes `simulate(city)` or `update(city)` called from the owner's `simulate()`,
- exposes `dispose()` when it owns resources that need cleanup,
- mutates owner state through setters that flag `isMeshOutOfDate` when visuals change, and emit a `cityEvents` event when the change is one other systems (UI, other tiles) care about.

Current attributes:

| Attribute                | Owner                                  | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Events emitted                                                                                           |
| ------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `RoadAccessAttribute`    | Tile                                   | `value: boolean`, recomputed reactively (§2.8) rather than every tick                                                                                                                                                                                                                                                                                                                                                                                                      | none (a pure value; other code reads `roadNetworkChanged`/`buildingPlaced` to know when to recompute it) |
| `PowerAccessAttribute`   | Tile                                   | `value: boolean`; delegates the actual check to `City.checkPowerAccess` since power is a shared, capacity-limited resource, not a self-contained BFS (§2.11)                                                                                                                                                                                                                                                                                                               | none (recomputed via the `powerNetworkChanged`/`buildingPlaced`/`buildingRemoved` cascade)               |
| `CivicCoverageAttribute` | Tile (×4: fire/police/hospital/school) | `value: boolean`; one generic class parameterized by `(tile, buildingType, searchDistance)`, reused for all four civic types (§2.12)                                                                                                                                                                                                                                                                                                                                       | none (recomputed via `civicCoverageChanged`/`buildingPlaced`)                                            |
| `DevelopmentAttribute`   | Zone                                   | State machine: `undeveloped → under-construction → developed ⇄ abandoned`, plus level 1–maxLevel (3 by default, raisable per zone type via a milestone reward, §2.13). All transitions are chance-based via `CONFIG.ZONE.*` and use the seeded `random()` (§2.7); School coverage multiplies the level-up chance, Police coverage skips the abandonment roll entirely (§2.12). Road access is both the development criterion and (absence of it) the abandonment criterion | `developmentStateChanged`, `levelChanged` (both only on an actual transition, not every setter call)     |
| `ResidentsAttribute`     | ResidentialZone                        | Move-in chance per tick up to `MAX_RESIDENTS ^ level`, scaled down (not blocked) when no commercial/industrial zone within `CITIZEN.MAX_JOB_SEARCH_DISTANCE` has an open job, scaled up under Hospital coverage; evicts all on abandonment; steps each `Citizen`                                                                                                                                                                                                           | `citizenMovedIn`, `citizenMovedOut`                                                                      |
| `JobsAttribute`          | Commercial/IndustrialZone              | Capacity `MAX_WORKERS ^ level`; `hire(citizen)`/`layOff(citizen)` manage the workers array; `layOffWorkers()` clears everyone on abandonment (also used directly by the Layoffs random event, §2.14)                                                                                                                                                                                                                                                                       | `citizenEmployed`, `citizenUnemployed`                                                                   |

**Development state machine** (all thresholds/chances in `config.ts`):

```
UNDEVELOPED ──(road access && REDEVELOP_CHANCE)──► UNDER_CONSTRUCTION
UNDER_CONSTRUCTION ──(CONSTRUCTION_TIME ticks)──► DEVELOPED (level 1)
DEVELOPED ──(no road access > ABANDONMENT_THRESHOLD ticks, then ABANDONMENT_CHANCE)──► ABANDONED
DEVELOPED ──(LEVEL_UP_CHANCE, level < maxLevel)──► level++
ABANDONED ──(road access restored, REDEVELOP_CHANCE)──► DEVELOPED
```

`maxLevel` is read from `ZONE_LEVEL_CAPS` (`src/city/building/zones/zoneLevelCaps.ts`, a plain mutable module-level object keyed by `BuildingType`) at zone-construction time and stored on `DevelopmentAttribute`. Defaults: `RESIDENTIAL: 3`, `COMMERCIAL: 3`, `INDUSTRIAL: 1` ("limiting to one due to lack of industrial models"). A milestone reward (`{ type: 'zoneLevelCap' }`, §2.13) can raise a type's cap - `MilestoneTracker.raiseZoneLevelCap` mutates `ZONE_LEVEL_CAPS` in place (affecting every zone of that type built from then on) _and_ walks every already-placed zone of that type to bump its `development.maxLevel` retroactively, so the reward applies immediately rather than only to future construction. Since GLB models only exist for levels 1-3 (see §3.1's model-name fallback), a cap raised beyond 3 doesn't change which model a zone can render at 1-3 - it only lets `level` itself climb past 3, at which point `AssetManager.resolveZoneModelName`'s fallback keeps rendering the level-3 model rather than failing to resolve one.

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
export function mulberry32(seed: number): RNG {
  /* small, fast, deterministic PRNG */
}
let rng: RNG = mulberry32(Date.now());
export function setSeed(seed: number): void {
  rng = mulberry32(seed);
}
export function random(): number {
  return rng();
}
```

Production defaults to a `Date.now()` seed (nondeterministic per page load, but every draw within a session comes from one shared generator); tests call `setSeed(...)` or mock the module directly for reproducible sequences. Every sim-affecting random choice goes through this - zone style/rotation, citizen age/name generation, and every chance-based transition in `DevelopmentAttribute`/`ResidentsAttribute`. The one known exception is `AssetManager`'s vehicle-model pick (`Math.floor(types.length * Math.random())`) and `VehicleGraphNode`'s next-node walk, both cosmetic/render-side choices rather than sim state, so nondeterminism there doesn't affect simulation reproducibility - if you ever need deterministic _replays_ including vehicle visuals, that's the remaining gap to close.

### 2.8 Reactive road access

`RoadAccessAttribute.recompute(city)` runs the same BFS (`city.findTile` capped at `CONFIG.ATTRIBUTES.ROAD_ACCESS.SEARCH_DISTANCE`) it always did, but it's no longer called from `City.simulate()` every tick for every tile. Instead, `City`'s constructor subscribes:

```ts
cityEvents.on('roadNetworkChanged', ({ x, y }) =>
  this.recomputeRoadAccessNear(x, y)
);
cityEvents.on('buildingPlaced', ({ x, y }) =>
  this.getTile(x, y)?.roadAccess?.recompute(this)
);
```

`recomputeRoadAccessNear(x, y)` recomputes only the tiles within `SEARCH_DISTANCE` (the same Manhattan-distance diamond the BFS itself is bounded to) of the road that was just added or removed - exactly the set of tiles whose own search could possibly have reached that coordinate. A brand-new tile also gets one recompute on `buildingPlaced` since it's never been evaluated. The rest of the time, `tile.roadAccess.value` is just a cached boolean read every tick at zero cost. This closes what used to be the single biggest sim cost driver (O(tiles × search area) per second, unconditionally) down to "only recompute what a road edit could have affected."

### 2.9 Event bus (`src/events`)

A minimal typed pub/sub, generic over an event map:

```ts
export class EventBus<EventMap extends Record<string, unknown>> {
  on<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void
  ): Unsubscribe;
  off<K extends keyof EventMap>(
    event: K,
    listener: (payload: EventMap[K]) => void
  ): void;
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
}
export const cityEvents = new EventBus<CityEventMap>();
```

`CityEventMap` lists every event and its payload: `buildingPlaced`/`buildingRemoved` (`{x,y}` [+`buildingType`]), `developmentStateChanged`/`levelChanged` (`{x,y,state|level,previous...}`), `citizenMovedIn`/`citizenMovedOut`/`citizenEmployed`/`citizenUnemployed` (`{citizenId,x,y}`), `roadNetworkChanged`/`powerNetworkChanged`/`civicCoverageChanged` (`{x,y}`), `moneyChanged` (`{amount,balance}`), `economyUpdated` (`{income,upkeep,netIncome,balance}`), `milestoneCompleted` (`{id}`), `randomEventTriggered` (`{type,message}`). Emitters are the attributes/`Tile` methods listed in §2.2/§2.4 plus `City`'s economy methods (§2.10), `MilestoneTracker` (§2.13), and `RandomEventsSystem` (§2.14). There are three kinds of subscribers:

- **`City` itself** (§2.8, §2.11, §2.12) - reactive road access, power access, and civic coverage; the subscribers that feed back into simulation state.
- **`MilestoneTracker`** (§2.13) and **`RandomEventsSystem`** (§2.14) - each subscribes to the specific events its own conditions/bookkeeping depend on, so neither needs a per-tick full-grid scan in the common case.
- **`Game`** (`subscribeToCityEvents()`) - UI-only reactions: `citizenMovedIn`/`citizenMovedOut`/`citizenEmployed`/`citizenUnemployed` refresh the population counter and derived city metrics, while `moneyChanged`/`economyUpdated` update the balance and budget breakdown; every tile event calls `refreshInfoOverlayIfFocused(payload)`, which only re-renders the info panel if the changed tile is the one currently selected; `milestoneCompleted` and `randomEventTriggered` refresh the goals panel / surface a typed notification. Related events within one simulation stack are batched into a microtask before the census and zone-capacity helpers scan residents and buildings, so final workplace links are visible and a mass layoff produces one UI update rather than one per worker.

The render layer (`SceneManager.update()`) deliberately does **not** subscribe to events - it still walks every tile once per tick and checks `isMeshOutOfDate`, since that flag-and-diff approach is simpler to reason about for mesh lifecycle than trying to map every event type to a partial re-render. If you add a new cross-cutting concern (a new UI panel that needs to react to a sim change, another system that needs to know when roads change), prefer subscribing to the relevant event over adding a new poll loop or threading a callback through several layers.

### 2.10 Economy (`City`, `CONFIG.ECONOMY`)

`City` holds `_money` (starts at `CONFIG.ECONOMY.STARTING_MONEY`) and `_upkeepDiscount` (starts at `1`, multiplied down by milestone rewards, §2.13). Every tile placement is gated by `canAfford`/`spend` (rejects placement rather than allowing debt) against `CONFIG.ECONOMY.BUILD_COST[type]`; `earn` is unconditional (used for tax income and one-off rewards). Once per `simulate()` pass, `collectEconomy()` does a single grid scan that both taxes and charges upkeep in one pass:

- **Income**: `TAX_PER_RESIDENT` × residents in each developed `ResidentialZone`, plus `TAX_PER_WORKER` × filled jobs in each developed `CommercialZone`/`IndustrialZone`. Undeveloped/under-construction zones have no residents/workers yet, so they naturally contribute nothing.
- **Upkeep**: a flat `CONFIG.ECONOMY.UPKEEP[type]` per tile of `ROAD`/`POWER_PLANT`/`POWER_LINE`/`FIRE_STATION`/`POLICE_STATION`/`HOSPITAL`/`SCHOOL`, multiplied by `_upkeepDiscount`, charged unconditionally (a city can go into the red - upkeep never silently stops).
- `netIncome` (income minus discounted upkeep) is cached from this pass rather than recomputed elsewhere - `RandomEventsSystem`'s Layoffs check (§2.14) reads it directly instead of re-scanning the grid.

Every balance change emits `moneyChanged({amount, balance})` (`Game` uses it to refresh the top bar's money display, `MilestoneTracker` uses it to check `money`-type conditions). `loadEconomyState({money, upkeepDiscount})` is save/load-only (§2.15) - it sets an absolute balance rather than a delta and skips `spend`/`earn`'s side effects other than the change notification.

### 2.11 Power grid & relay (`PowerGrid`, `PowerAccessAttribute`, `City.checkPowerAccess`)

Unlike road access (a stateless "is there a road nearby" BFS), power is a **capacity-limited shared resource** - one plant can only power `CONFIG.ATTRIBUTES.POWER_ACCESS.CAPACITY` zone tiles (default 20), so the grid needs bookkeeping of which plant is serving which tile, not just a yes/no reachability check.

- **`PowerGrid`** (`src/city/powerGrid.ts`) tracks two maps: `capacityUsed` (plant coordinate → count) and `assignedPlant` (tile coordinate → plant coordinate). `registerPlant`/`unregisterPlant` are called when a `POWER_PLANT` tile is placed/removed (only plants hold capacity - lines never do). `tryAssign(tile, candidates, capacity)` first tries to keep the tile's existing assignment if that plant is still a valid candidate (avoids needless reshuffling), otherwise does first-fit over `candidates` in the order given. `release(tile)` frees a tile's slot (bulldozed, or no longer a zone).
- **Relay**: a zone doesn't need to be directly adjacent to a plant or line - `City.isPowerConductive(tile)` treats a tile as conducting power if it's a `POWER_LINE`/`POWER_PLANT`, _or_ if it's a zone whose `powerAccess.value` is already `true` (an already-connected zone relays to its neighbors). `findReachablePlants(start)` first finds every conductive entry point within `SEARCH_DISTANCE` (same "can this tile physically reach the grid" radius concept as road access), then BFSes outward through connected conductive tiles - unbounded by distance, since a cable run or a chain of powered zones can be as long as the player builds it - collecting every plant reached (a plant is always a traversal endpoint, never a pass-through).
- **Reactive recompute is an incremental worklist, not a bounded-radius sweep** (this differs from road access, §2.8, and civic coverage, §2.12, both of which _are_ plain bounded sweeps): because one tile's power state can ripple through a chain of relaying zones, `City.cascadePowerAccessChange(x, y)` seeds a queue with the bounded neighborhood around the edited tile, then only enqueues a tile's neighbors when that tile's own `powerAccess.value` actually flips (an unchanged tile can't newly affect what its neighbors see). Cost scales with the size of the network region that actually changes, not city size - this was an explicit design correction after an earlier full-grid-relaxation approach was rejected for not scaling to larger maps.
- The info panel surfaces `City.getPowerPlantLoad(plant)` (delegates to `PowerGrid.getCapacityUsed`) next to a focused power plant, so the hard per-plant cap isn't an invisible mystery once a city outgrows one plant.

### 2.12 Civic services (`CivicCoverageAttribute`, `CONFIG.CIVIC_SERVICES`)

Four civic building types, each with one focused gameplay effect on zones within a fixed radius - all reusing an existing probability roll rather than inventing new mechanics:

| Building       | Effect                                                 | Hooks into                                                                                         |
| -------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Fire Station   | Covered zones are immune to the Fire random event      | `RandomEventsSystem.findDevelopedZoneTiles` excludes covered tiles from the candidate pool (§2.14) |
| Police Station | Covered zones never abandon                            | `DevelopmentAttribute`'s abandonment roll is skipped entirely when covered                         |
| Hospital       | Covered residential zones get a boosted move-in chance | `ResidentsAttribute`'s move-in roll ×`CIVIC_SERVICES.HOSPITAL.MOVE_IN_CHANCE_MULTIPLIER`           |
| School         | Covered zones get a boosted level-up chance            | `DevelopmentAttribute`'s level-up roll ×`CIVIC_SERVICES.SCHOOL.LEVEL_UP_CHANCE_MULTIPLIER`         |

Fire/Police are deterministic immunity (a hard boolean gate, same flavor as road/power access); Hospital/School are probability multipliers (a boost has no natural ceiling the way immunity does for a bad outcome). Implementation is one generic `CivicCoverageAttribute` class (mirroring `RoadAccessAttribute`) parameterized by `(tile, buildingType, searchDistance)`, instantiated four times per `Tile` reading its own `CONFIG.CIVIC_SERVICES.<TYPE>.SEARCH_DISTANCE`. Recompute is a plain bounded-radius sweep (`City.recomputeCivicCoverageNear`, triggered by `civicCoverageChanged`/`buildingPlaced`) using the largest of the four search distances - unlike power access (§2.11), coverage doesn't chain through other coverage, so a one-shot sweep (not an incremental worklist) is enough.

### 2.13 Milestones (`MilestoneTracker`, `game/milestones`)

`MilestoneTracker` watches the fixed `MILESTONES` list (`game/milestones/constants.ts`) and applies each one's reward the first time its condition is met, tracked via a `completed: Set<string>` (never re-fires). Conditions: `population`/`money` (compared against `City.population`/`City.money`) or `developedZoneCount` (a full grid scan counting developed zones of a given type). Each incoming event only re-checks milestones whose condition category matches that event, so population/money checks are O(1) per milestone and the O(size²) zone-count scan only runs on `developmentStateChanged` rather than every tick. Rewards: `cash` (`City.earn`), `upkeepDiscount` (`City.applyUpkeepDiscount`, stacks multiplicatively), `zoneLevelCap` (bumps `ZONE_LEVEL_CAPS[type]` for future zones _and_ retroactively raises `development.maxLevel` on every already-placed zone of that type), `unlockTool` (adds to `unlockedToolIds`, read by `ToolBar`/`Game.useActiveTool` to gate tool selection). Emits `milestoneCompleted({id})`.

Current progression (`MILESTONES`, easy to retune): `RESIDENTIAL`/`COMMERCIAL`/`INDUSTRIAL`/`ROAD`/`POWER_PLANT`/`POWER_LINE`/`BULLDOZE`/`SELECT` are in `STARTING_UNLOCKED_TOOLS` from the start (a real city needs shops and jobs from day one) - population milestones (10/15/25/40/60) unlock a cash bonus then the four civic tools in sequence, a money milestone (\$25,000) grants an upkeep discount, and two `developedZoneCount` milestones (5 commercial, 5 industrial) raise the Residential/Commercial level cap to 4. `GoalsPanel` (`ui/GoalsPanel`) shows `nextMilestone` (first uncompleted, in list order).

### 2.14 Random events (`RandomEventsSystem`, `CONFIG.RANDOM_EVENTS`)

Occasional city-wide variance on top of the steady simulation - a windfall grant, a fire, or layoffs - each reusing an existing mechanic (`City.earn`, `DevelopmentAttribute.state`, `JobsAttribute.layOffWorkers`) rather than inventing new state. `Game.step()` calls `tick()` once per unpaused sim tick, right after `city.simulate()`; the three checks run in fixed priority order (windfall, then fire, then layoffs) and stop at the first that fires:

- **Windfall**: flat `RANDOM_EVENTS.WINDFALL.BASE_CHANCE` per tick; grants a random amount in `[MIN_AMOUNT, MAX_AMOUNT]`.
- **Fire**: chance rises with `CHANCE_PER_ABANDONED_ZONE` per currently-abandoned zone (an already-struggling city is more fire-prone); on success, picks a random developed zone _not_ under Fire Station coverage and abandons it.
- **Layoffs**: `BASE_CHANCE`, multiplied by `DEFICIT_MULTIPLIER` while `City.netIncome < 0`; on success, picks a random developed commercial/industrial zone with filled jobs and lays everyone off.

The steady-state per-tick decision stays O(1): `abandonedTileKeys` (a `Set<string>`) is maintained incrementally via `developmentStateChanged`/`buildingRemoved` subscriptions rather than rescanned every tick, and `netIncome` is read pre-computed from `City` (§2.10). Only the rare tick an event actually fires pays for an O(size²) grid scan to pick a target - a cost gated by low probability, not by map size. Each firing emits `randomEventTriggered({type,message})`; `Game` maps the event type to a success or warning notification.

### 2.15 Save/load (`game/saveGame`)

One save slot in `localStorage` (key `threejs-city-simulation/save`), versioned (`SaveGameV1.version: 1`) for future migrations. `Game` auto-loads on construction (`this.loadGame()`) and autosaves every 30 sim ticks (`AUTOSAVE_INTERVAL_TICKS`), plus explicit Save/Load/New-City actions in the top bar's management menu. The player-defined city name and current simulation day are game metadata owned by `Game`; renaming writes the slot immediately, each successful sim step advances the day, and old version-1 saves without either optional field fall back to `My City` and day 1.

- **`serialize(city, milestoneTracker, cityName, simulationDay)`** walks every tile and records `{x, y, buildingType}` plus, for zones, `{style, rotation, developmentState, developmentLevel, developmentMaxLevel}` and, for `ResidentialZone`, each citizen `{id, firstName, surname, age, state, workplace?}`. Also captures normalized game metadata, `city.money`, `city.upkeepDiscount`, a snapshot of `ZONE_LEVEL_CAPS`, and `milestoneTracker.getState()` (`{completed, unlockedToolIds}`).
- **`deserialize(data, city, milestoneTracker)`** clears every tile, restores `ZONE_LEVEL_CAPS` and economy state directly, then **replays the save through the same public APIs normal play uses** - `tile.placeBuilding(type)`, then patches `style`/`rotation`/`development.maxLevel`/`.state`/`.level` and rehires citizens via `jobs.hire` - rather than a bespoke bulk-hydrate path. Because `developmentStateChanged`/`buildingPlaced`/etc. all still fire during replay, `MilestoneTracker`'s and `RandomEventsSystem`'s own incremental trackers (`completed` set, `abandonedTileKeys`) rebuild themselves as a side effect instead of needing a dedicated restore path - their idempotent guards make the redundant re-checks harmless. `milestoneTracker.restoreState` **unions** `unlockedToolIds` with `STARTING_UNLOCKED_TOOLS` rather than replacing it outright, so a save written by an older build (e.g. predating Commercial/Industrial being unlocked from the start) can't accidentally re-lock a tool the current build guarantees is always available. One extra `city.simulate()` call at the end fixes up road styles immediately rather than waiting up to 1s for the next natural tick.
- **`newGame()`** confirms via `window.confirm` (the one deliberately irreversible action in the game), then deserializes `blankSave()` (fresh money, default zone caps, empty milestones/tools, no tiles) and clears the save key.
- Not currently persisted: the RNG seed/draw count (§2.7) - a reload reseeds from `Date.now()` rather than replaying the exact same random sequence, so a loaded city's _future_ random draws diverge from what they'd have been in the original session, even though every already-decided piece of state (who moved in, which zone is what level, etc.) is preserved exactly.

---

## 3. Render layer

### 3.1 AssetManager

- Loads every GLB registered in `assetManager/models/index.ts` at startup via `GLTFLoader`; fires `onLoad` when all are in. `modelsFiles.ts` only imports the ~38 GLBs actually referenced by the registry (pruned from an original 258 - unused imports were dead bundle weight, since webpack's `file-loader` emits whatever is imported regardless of whether it's ever used at runtime).
- All models get a shared `MeshLambertMaterial` with the `base` texture + specular map, scaled by `scale/30`.
- **Two ways a model becomes visible**, depending on whether it's rendered once or thousands of times:
  - `cloneMesh(name, transparent?, material?)` - deep-clones the loaded model with a per-clone material. Used for **vehicles** (moving, individually animated - instancing doesn't fit) and the **placement preview ghost** (one throwaway translucent mesh at a time).
  - `createModelInstancedMesh(modelKey, count)` / `createTerrainInstancedMesh(count)` - bakes the loaded model's transform (`matrixWorld`) into a cloned geometry once, then hands `SceneManager` a `THREE.InstancedMesh` with that baked geometry and a shared material. Used for **terrain** and **every placed building/road**, since those can number in the thousands on a large map and per-tile `Object3D`/material overhead stops being free well before that.
- **Name resolution contract** (unchanged by instancing - it's still how a tile's building maps to a model):
  - zones: `${zone.type}-${zone.style}${zone.development.level}` (e.g. `COMMERCIAL-A2`); under-construction/undeveloped → `UNDER-CONSTRUCTION`. **Models only exist for levels 1-3** for every zone type, but a milestone can raise a zone's `maxLevel`/`level` beyond 3 (§2.13) - `resolveZoneModelName(type, style, level)` searches downward from the actual level to the first level that has a registered model (`${type}-${style}3` in practice today) rather than looking up a key that doesn't exist. Without this fallback, a zone that leveled past 3 would resolve to a nonexistent `ModelKey`, silently render nothing, and (per §3.2's diff-check) never get another chance to re-resolve once its slot was freed.
  - roads: `${road.type}-${road.style}` (e.g. `ROAD-THREE-WAY`),
  - fixed buildings (power plant/line, the four civic buildings): one `ModelKey` per type, no style/level - `resolveFixedBuildingInstance(tile, modelKey)` is a single shared helper for all six, since they're all "fixed position, no rotation, no style" (`createPreviewMesh`'s ghost branches reuse the same consolidation),
  - vehicles: random pick among models with `type === VEHICLE`.
- `resolveBuildingInstance(tile)` replaces the old `createBuildingMesh` - instead of building a mesh, it returns `{ modelKey, matrix, abandoned }` (position/rotation as a `THREE.Matrix4`, plus whether the zone is abandoned, for the base tint). `SceneManager` is the one that actually places this into an instance pool - see §3.2.
- If you add a model, its `ModelKey` entry must exist in `models/index.ts` (with a matching GLB import in `modelsFiles.ts`) or resolution silently returns `null` and the tile renders nothing.

### 3.2 SceneManager

Terrain and every building are each backed by `InstancedMesh`, not one mesh per tile:

- **Terrain**: one `InstancedMesh` sized `citySize × citySize`, built once in `setupTerrain()`. Per-tile visibility (a building with `hideTerrain` covering the ground) is done by scaling that instance's matrix to zero rather than toggling a `visible` flag (`InstancedMesh` has no per-instance visibility), and only the instances whose hidden-state actually _changed_ this tick get their matrix rewritten - not the whole buffer every tick.
- **Buildings**: one growable `InstancedMesh` **pool per distinct model** (`Map<ModelKey, BuildingPool>`), since there are ~20 distinct zone/road models rather than one repeated shape like grass. Each pool tracks a free-slot list and a `tileAtSlot` reverse-lookup array. Placing a building allocates a slot (doubling the pool's capacity via a brand-new `InstancedMesh` + copying every existing instance's matrix/color over, if the pool is full); bulldozing frees it (zero-scale + push the slot back onto the free list); a building leveling up or otherwise changing its resolved `ModelKey` frees its old slot and allocates a new one in the different pool. Crucially, `update()` compares the newly-`resolveBuildingInstance`-d model/transform/tint against what a tile's slot record already holds, and skips all of this entirely if nothing actually changed - which matters because `Road.simulate()` sets `isMeshOutOfDate` every tick regardless (§2.3), and without this check every road tile in the city would churn its pool slot every second.
- **Picking**: `getSelectedObject(event)` raycasts against the whole scene. A hit on an `InstancedMesh` (terrain or any building pool) carries `intersection.instanceId`, which is resolved back to a tile via that pool's `tileAtSlot` array, then stashed as `userData` on the shared mesh just before returning it - valid only because the very next thing the caller does (in the same synchronous mouse-event handler) is read that `userData`, before any other raycast can run and overwrite it. Vehicles are still individual meshes, but aren't tied to a single tile and don't carry tile `userData` at all - a raycast hit on one falls through to the generic non-`InstancedMesh` path with whatever default `userData` it has (which `Game`'s `typeof tile?.placeBuilding === "function"` guard then correctly rejects as "not a tile"). Non-pickable objects (the ground grid overlay, the preview ghost) set `userData.nonInteractive = true` and are skipped.
- **Highlight/selection**: an `InstancedMesh` has no per-instance emissive, so hover/select tinting is done via `InstancedMesh.setColorAt` - a lerp from the instance's stored _base_ tint (white normally, grey `0x707070` if a zone is abandoned) toward a highlight color (pale blue for hover, warm gold for select), tracked as a single shared `(mesh, instanceIndex)` pair rather than a per-object flag. Two things to know if you touch this: a highlight color lerped toward pure white is a no-op against a white base tint (color-management gamma compression makes the shift imperceptible near the top of the range even before that) - pick a saturated color and a strong blend amount instead; and hovering the currently-_selected_ tile must not clobber its select tint with the hover tint, which needs an explicit "is this the same (mesh, index) as the active selection" check rather than relying on object-reference equality (every terrain hover and every same-model building hover _is_ the same shared mesh object). Vehicles, not being instanced, still use plain `mesh.material.emissive.setHex(color)`.
- Lights: one shadow-casting directional "sun" + low ambient, both the light's target and its shadow-camera frustum (`left/right/top/bottom/near/far`) derived from `CONFIG.CITY.SIZE` rather than hardcoded for a 16-tile map - grow the map and both scale automatically.

### 3.3 CameraManager

Orthographic camera orbiting a `cameraOrigin` on a sphere (azimuth/elevation/radius-as-zoom). Right-drag orbits, Ctrl+right-drag pans, wheel zooms, two-finger touch pans (no pinch-zoom yet). `camera.zoom = cameraRadius` - "radius" is really zoom level. The origin (map center), starting zoom (framed to show the whole map plus margin), and zoom-out limit all derive from `citySize` passed into the constructor, rather than being tuned only for size 16 - `MIN_CAMERA_RADIUS_AT_SIZE_16` in `constants.ts` documents its own scaling factor (`× 16/citySize`) in its name.

### 3.4 UI (`src/ui`)

A React root is mounted once by `createUi()`. `Game` owns a small external store of serializable `UiState` and passes typed actions back into the HUD; React components never reach into the simulation or Three.js scene directly.

- **TopBar** - editable city name, persistent simulation day with live paused/speed status, population counter (`#population-counter`), money balance, and per-tick net-income trend. Enter or blur commits a name edit, Escape cancels it, and `Game.renameCity` normalizes and persists the result. Simulation values refresh from the scheduler or typed city events rather than unconditional UI polling. Clicking city funds opens an event-fed budget breakdown; clicking population opens a census derived by `game/census.ts` from resident ages and actual workplace links, including employment rate, workers, job seekers, students, and retirees. Budget, census, and management popovers are mutually exclusive and close on outside click or Escape (returning focus to their trigger).
- **ToolBar** - a categorized dock generated from `TOOLBAR_BUTTONS` and `TOOL_CATEGORIES` in `ui/constants.ts`; each leaf action still carries an id matching a `BUILDING_TYPE` (or SELECT/BULLDOZE). A contextual strip above the dock identifies the active tool, its placement gesture, configured per-tile cost, and whether the current balance can afford it; it hides while a category tray or the speed picker is open so those surfaces never overlap. Locked milestone tools include their population requirement and remain protected by a second authorization check inside `Game.selectTool`. A separate compact control group pauses/resumes the scheduler; its speed trigger opens explicit 1×/2×/3× radio choices, while the `.` shortcut retains fast cycling through the same values.
- **SimulationStatus** - renders a transient, non-interactive paused-state banner with the Space resume hint. It sits below the top bar on desktop and above the bottom dock on narrow screens, where the top bar's textual day/speed line is intentionally hidden.
- **InfoPanel** - receives an `InspectorUiState`, built by `game/inspector.ts` from the focused tile. It renders a derived `All online`/missing-service summary, icon-led local service status, development, costs, power capacity, and citizen/worker occupancy as React elements. Its guarded demolition action requires an in-panel confirmation, then delegates to the same exported `bulldozeTile` operation as `BulldozeTool`; the active build tool is unchanged and the inspector refreshes to the resulting empty lot. Closing the panel or selecting any other tool clears both `Game.focusedObject` and the render-layer selection highlight, so stale inspector state cannot remain active in the world. No simulation object generates markup and no model data crosses through `innerHTML`.
- **GoalsPanel** - receives a milestone roadmap from `game/goals.ts`, including the active condition's live progress, reward, completion count, and the next three objectives. Before the first resident arrives, the initial population objective also presents the Roads → Power → Zones dependency order; it derives this entirely from the existing goal progress rather than introducing separate tutorial state. Population, money, and development events refresh the relevant progress without the component reading `City` directly; once every milestone is done it renders a completion state.
- **NotificationCenter** - receives one typed success, warning, milestone, or event notification from the UI store. New notifications replace the current one and restart its timer; they dismiss automatically after 4.5 seconds or immediately through `UiController.dismissNotification()`. Either path clears only the toast, leaving its activity-history entry intact. Save/load/new-city actions, completed milestones, random events, and rejected placement clicks provide the title and detail without components reaching back into `Game`.
- **ActivityLog** - the same store operation that shows a toast also prepends it to a six-entry, session-only history with the current simulation day and increments a capped unread counter on the Menu trigger. Opening the menu calls `markActivityRead`; the history remains after the toast disappears and deliberately does not enter the simulation save format.
- **ZoneCapacityPanel** - shows developed residential occupancy and developed commercial/industrial staffing as three compact, actionable utilization rows, followed by icon-led road, power, fire, police, health, and education cards with both coverage percentages and covered/developed-zone counts. Unlocked rows and cards delegate to the standard `selectTool` action as direct zoning/build shortcuts, while milestone-gated entries remain disabled. Its header derives a quiet `No zones`, healthy `All covered`, or warning gap count from the same service metrics, and watch/poor cards receive matching visual emphasis. `game/zoneCapacity.ts` and `game/cityServices.ts` derive these values from real resident, job, access, and civic-coverage attributes; empty cards explicitly say there are no active zones rather than presenting synthetic demand.
- **ControlsLegend** - renders the desktop mouse/camera quick reference inside a native `<details>` disclosure that defaults closed, remains one click away, and remembers its preference independently from the city save. It is hidden on touch or short displays so it never competes with city controls.
- **CityMap** - draws a compact top-down map over a muted grass gradient on a dedicated 2D HUD canvas from `CityMapUiState`; the UI never imports Three.js or reads `City` directly. `game/cityMap.ts` projects every building into a small display category, keeping power plants separate from power lines so the renderer can draw zones as parcels, roads as a connected two-tone street network, power lines as thinner node-linked strokes, and civic/utility buildings as markers. `Game` batches placement/removal bursts into one microtask redraw so loading a save does not rescan the entire city per tile. `CameraManager` publishes focus changes only when map focus or mouse/touch panning actually changes the camera origin; the HUD uses those coordinates for its live focus ring without polling. Pointer movement is resolved against the same coordinate helper as clicks, adding a tile outline and category/coordinate preview before the player recenters; keyboard activation recenters on the midpoint. The map shares a lower-left row with the controls disclosure, hides while the full controls reference is open, and is omitted on narrow or short displays.
- **Keyboard shortcuts** - `ui/keyboardShortcuts.ts` maps Esc/1–9/R/B/Space/`.` into typed HUD actions. `ToolBar` owns the document listener, ignores modified keystrokes and editable fields, respects milestone locks, and exposes the bindings through `aria-keyshortcuts`, dock badges, and the controls legend. Escape also closes an open inspector before returning to the Select tool, keeping panel and world-selection state synchronized.
- **Panel disclosure** - the milestones and capacity/service panels use native open-by-default `<details>` controls, while the lower-left controls reference uses the same pattern but defaults closed. All keep their live React content mounted while collapsing to compact headers. `ui/disclosurePreferences.ts` stores each open/closed choice under its own namespaced `localStorage` key (separate from the city save slot) and safely falls back to the panel's default when storage is unavailable. CSS repositions the optional debug readout when the lower-right panel is closed.
- **Debug HUD** - scheduler tick/rate text is omitted from the normal React tree and its per-frame UI update returns immediately unless `CONFIG.DEBUG.SHOW_TICK_RATE` is enabled. This keeps diagnostics available without leaking development chrome into the player HUD; the vehicle graph remains independently gated by `SHOW_VEHICLE_GRAPH`.
- **Cinematic HUD** - `UiState.isHudHidden` visually hides the mounted HUD shell without unsubscribing components or disabling the global shortcut listener. H and the city-menu action toggle the state; a restore button rendered outside the hidden shell keeps the mode reversible for mouse and touch users. This is session-only presentation state, not simulation/save data.

`Game.isEventFromUiElement` guards world input against clicks on `#ui-topbar`, `#ui-toolbar`, `#ui-info-overlay`, `#ui-lower-left-overlay`, and the cinematic `#hud-restore-button` - keep new UI containers in that list (or give them one of those ids as ancestor).

### 3.5 Tool system (`src/game/tools`)

```ts
interface GameContext {
  city: ICity;
  sceneManager: ISceneManager;
  assetManager: IAssetManager;
  setFocusedTile(tile: ITile | null): void;
}
interface ToolPreview {
  mesh: THREE.Object3D;
  valid: boolean;
}
type ToolUseResult =
  | { status: 'applied' }
  | { status: 'rejected'; reason: 'occupiedTile' | 'insufficientFunds' | 'emptyTile' };
interface Tool {
  readonly id: string;
  onTileClick(tile: ITile, object: THREE.Object3D, context: GameContext): ToolUseResult;
  onDrag?(tile: ITile, object: THREE.Object3D, context: GameContext): ToolUseResult; // falls back to onTileClick
  getPreview?(tile: ITile, context: GameContext): ToolPreview | null; // ghost mesh while hovering
}
```

`createTools()` builds one instance each of `SelectTool`, `BulldozeTool`, and a `BuildingTool` per placeable type (`RESIDENTIAL`/`COMMERCIAL`/`INDUSTRIAL`/`ROAD` - roads are just `new BuildingTool(BUILDING_TYPE.ROAD)`, not a separate class), keyed into `Record<string, Tool>` by `tool.id`. `Game` holds that registry and `activeToolId`; dispatch is a table lookup, not an if/else chain:

```ts
const tool = this.activeToolId ? this.tools[this.activeToolId] : undefined;
const handler = (isDrag && tool.onDrag) || tool.onTileClick;
const result = handler.call(tool, tile, object, this.gameContext);
```

Adding a new tool means implementing `Tool` and registering it in `createTools()` - `Game` needs no dispatch changes. Successful actions return `applied`; rejected actions return a typed reason. `Game` maps rejected clicks through `toolFeedback.ts` into a warning notification, while rejected drag-paint attempts stay silent so moving across occupied tiles cannot flood the HUD.

### 3.6 Placement preview

While hovering with a placement tool active, `Game.updatePreview()` calls `tool.getPreview(tile, context)` (only `BuildingTool` implements it; `SelectTool`/`BulldozeTool` show no ghost) and forwards the result to `sceneManager.showPreviewMesh(mesh, valid)`. For roads, `AssetManager.createPreviewMesh` builds a throwaway `Road` and calls `road.simulate(city)` against the real city _without inserting it into the grid_, so the ghost shows the correct connector style for the tile's actual current neighbors; other zone types show the generic `UNDER-CONSTRUCTION` model. `showPreviewMesh` tints the whole ghost green/red for valid/invalid, makes it translucent with depth-testing disabled and a high `renderOrder` (so an invalid ghost sitting on top of an existing building isn't hidden by it), and flags every descendant `userData.nonInteractive = true` - otherwise the ghost could intercept its own raycast, read as "no tile," hide itself, and reappear the next frame in an infinite flicker loop.

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

### 4.1 Add a new building type (e.g. PARK)

1. `src/city/building/constants/index.ts` - add to `BUILDING_TYPE` (and a `ROAD_TYPE`-style sub-enum if it has variants).
2. Create the class in `src/city/building/` (subclass `Building` directly for a fixed, non-developing building - follow `PowerPlant`/`FireStation`; subclass `Zone` if it should develop/abandon). Implement `simulate` and `dispose` as needed.
3. `buildingCreator.ts` - add a `case` and extend the `BuildingEntity` union.
4. Assets: add `ModelKey` entries (`assetManager/constants`), GLB import in `models/modelsFiles.ts` (only imported GLBs get bundled - don't import ones nothing references), and a `models/index.ts` entry with `type: modelType.ZONE` (or a new type).
5. `AssetManager.resolveBuildingInstance` - route the new type to a resolver branch (`resolveFixedBuildingInstance` for a fixed model with no style/level - see §3.1 - or `resolveZoneModelName`'s style/level naming for a developing zone). No `SceneManager` changes needed - a new `ModelKey` just gets its own instance pool lazily, the first time a tile resolves to it.
6. `ui/constants.ts` - add a toolbar button (`id` must equal the `BUILDING_TYPE` value so `activeToolId` flows through unchanged), place it in a `TOOL_CATEGORIES` group, and add an icon in `assetManager/icons` if needed. If the new type is placeable, `createTools()` needs a `new BuildingTool(BUILDING_TYPE.YOUR_TYPE)` entry. Extend `game/inspector.ts` if the type has unique details worth surfacing.
7. `CONFIG.ECONOMY.BUILD_COST`/`UPKEEP` - add entries, or placement/upkeep silently costs/charges nothing.
8. Decide unlock timing: add to `STARTING_UNLOCKED_TOOLS` (`game/milestones/index.ts`) if it should be available immediately, or gate it behind a new `{ type: 'unlockTool' }` milestone (§2.13) if it's meant to be a progression reward.
9. If it affects other buildings (e.g. land value, a new coverage effect), model that as a new **attribute** (next recipe) - `CivicCoverageAttribute` (§2.12) is already generic enough to reuse for a fifth "immune/boosted within radius" effect without writing a new class, if that's the shape you need.

### 4.2 Add a new attribute (e.g. PowerAttribute, LandValueAttribute)

1. New file in `src/city/building/attributes/`, class holding the owner, with `simulate(city)`/`update(city)` and `dispose()` as needed.
2. Read tunables from `config.ts` (add a section to the `Config` interface and the `CONFIG` object, with a JSDoc comment stating each field's unit - ticks, ms, probability 0-1, etc. - matching the existing sections).
3. Compose it in the relevant zone(s): instantiate in the constructor and call it from `simulate`/`dispose`.
4. If it changes visuals, mutate via setters that set `owner.isMeshOutOfDate = true`.
5. If another system (UI, another tile) needs to react to the change, add an event to `CityEventMap` and `emit` it from the setter, rather than having that other system poll.
6. Mirror `RoadAccessAttribute` if it's tile-level rather than zone-level, and consider whether it needs a reactive-recompute pattern like road access (§2.8) instead of a per-tick pass, if the underlying computation is expensive and rarely-invalidated.

### 4.3 Add a stat to the top bar

Compute it on `City` as a getter returning a number (see `population`), add it to `UiState` and `ui/TopBar`, then update it from the relevant `cityEvents` subscription in `Game` rather than polling every tick.

### 4.4 Save/load - already implemented, see §2.15

Fully implemented (`game/saveGame`, one `localStorage` slot, auto-load on startup, autosave every 30 ticks) - see §2.15 for how it actually works. If you add new persistent state (a new attribute, a new economy field, a new per-citizen field), extend `SaveGameV1`/`SavedTile`/`SavedCitizen` (`game/saveGame/constants.ts`) and both `serialize`/`deserialize`; prefer restoring through the same public API replay pattern deserialize already uses rather than a bespoke bulk-hydrate path, so any other incremental tracker (a future one, alongside `MilestoneTracker`/`RandomEventsSystem`) keeps rebuilding itself for free as a side effect of replay.

### 4.5 Growing the map

Bump `CONFIG.CITY.SIZE` - camera framing/zoom limits and the shadow-camera frustum both already scale with it, and road-access recomputation is already bounded to the area around each changed road rather than scanning the whole map (§2.8), so none of those need manual retuning anymore. What's still worth checking at a much larger size: how many distinct building-model pools end up in active use at once and how large the biggest one grows (each pool doubles its `InstancedMesh` capacity - and rebuilds it - when it fills up, so a map that ends up mostly one repeated building type will do a handful of pool-growth reallocations early on, not a problem in itself but worth being aware of if you're profiling), and whether `VehicleGraph`'s population-derived spawn count needs a smaller ratio at very large populations.

---

## 5. Performance notes

- Terrain and every placed building/road are `InstancedMesh` (one pool per distinct model), not a clone per tile - see §3.2 for the pool/picking/highlight mechanics this requires. Vehicles remain individual cloned meshes (moving, and few enough relative to buildings/terrain that instancing them hasn't been worth the added complexity of per-instance animation state - see §2.6 for what that would take).
- Road access is recomputed reactively on `roadNetworkChanged`/`buildingPlaced`, bounded to the search radius around the change, instead of a BFS per tile per tick (§2.8) - this was the main sim cost driver before the fix.
- Civic coverage (§2.12) follows the same bounded-radius-sweep pattern as road access. Power access (§2.11) is the one exception that needs an incremental worklist rather than a plain bounded sweep, since one tile's power state can ripple through a chain of relaying zones arbitrarily far - cost still scales with the affected region, not map size, just via a queue instead of a fixed-radius loop.
- Milestones (§2.13) and random events (§2.14) both keep their steady-state per-tick cost O(1) by maintaining small incremental caches (`abandonedTileKeys`, `netIncome`) via events, and only pay for an O(size²) grid scan on the rare tick a `developedZoneCount` milestone needs checking or a random event actually fires - gated by low probability/event frequency, not run unconditionally every tick.
- `City.collectEconomy()` (§2.10) is one O(size²) grid scan per tick (tax + upkeep together) - unavoidable since every developed zone can contribute income, but it's a single pass, not one scan per concern.
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
