"""
Headless Simulation - DISASTER-AWARE VERSION
✅ Supports 3 disaster types: fire, earthquake, bomb
✅ Earthquake agents go to safe zones and organize
✅ Fire/bomb agents disappear on evacuation
✅ Two stair types: concrete_stairs (all drills), fire_ladder (fire only)
"""
import json, random, math, time
from src.agent import PersonAgent
from src.map_object import MapObject, testWall, Exit, NPC, Stairs, SafeZone, Gate, Fence
from src.data_logger import DataLogger

# Stair types usable in each disaster
STAIR_TYPES_ALL      = ("concrete_stairs", "stairs")          # usable always
STAIR_TYPES_FIRE     = ("concrete_stairs", "stairs", "fire_ladder")  # usable in fire
STAIR_TYPES_BOMB     = ("concrete_stairs", "stairs")          # same as all (no ladders)
STAIR_TYPES_QUAKE    = ("concrete_stairs", "stairs")          # fire_ladder excluded

def allowed_stair_types(disaster_type: str) -> tuple:
    if disaster_type == "fire":
        return STAIR_TYPES_FIRE
    return STAIR_TYPES_ALL  # earthquake and bomb skip fire_ladder


class Simulation:
    """Simulation without pygame - for API/backend use - DISASTER-AWARE"""

    def __init__(self, project_data=None, max_steps=10000, disaster_type="fire"):
        self.width = 800
        self.height = 600
        self.max_steps = max_steps
        self.disaster_type = disaster_type
        print(f"\n🚨 DISASTER TYPE: {disaster_type.upper()}")

        self.grid_width = 0
        self.grid_height = 0
        self.cell_size = 10

        self.layers = []
        self.grids = []
        self.buildings_layers = []
        self.buildings_grids = []
        self.buildings_costs = []
        self.buildings_paths = []
        self.buildings_graphs = []
        self.buildings_data = []
        self.npc_zones = []
        self.safe_zone_agents = {}
        self.path_visuals = {}
        # Sequential spawn queues: {zone_key: {'remaining': int, 'interval': int, 'countdown': int, 'zone': obj, 'building_idx': int, 'floor_idx': int}}
        self.spawn_queues = []

        if project_data:
            self.load_from_project_data(project_data)
        else:
            self.load_environment_from_file()
            self.load_grid_from_file()

        self.agents = []
        self.evacuated_agents = []
        self.spawn_agents(n_per_npc=10)

        self.running = True
        self.start_time = time.time()
        self.time = 0.0
        self.data_logger = DataLogger("simulation_data.csv")
        self.simulation_time = 0.0
        self.step_count = 0

    # ── Loading ───────────────────────────────────────────────────────────────

    def load_from_project_data(self, project_data):
        print("📥 Loading simulation from project data...")

        self.cell_size  = project_data.get('cell_size', 10)
        self.grid_width  = project_data.get('width', 80)
        self.grid_height = project_data.get('height', 60)

        buildings = project_data.get('buildings', [])
        if not buildings:
            print("⚠️ No buildings found in project data!")
            self.layers = [[]]
            self.grids  = [[]]
            self.buildings_layers = []
            self.buildings_grids  = []
            self.buildings_data   = []
            return

        self.buildings_data = []
        all_layers = []
        all_grids  = []
        all_costs  = []
        all_paths  = []
        all_graphs = []

        for building_idx, building in enumerate(buildings):
            building_layers  = building.get('layers', [])
            building_name    = building.get('name', f'Building {building_idx + 1}')
            building_outline = building.get('outline', {})

            self.buildings_data.append({
                'index': building_idx,
                'name': building_name,
                'outline': building_outline,
                'floor_count': len(building_layers)
            })

            building_floor_objects = []
            building_floor_grids   = []
            building_floor_costs   = []
            building_floor_paths   = []
            building_floor_graphs  = []

            for layer_idx, layer_data in enumerate(building_layers):
                layer_objects = []
                for obj_data in layer_data:
                    obj = self._safe_load_object(obj_data, building_name, layer_idx)
                    if obj is not None:
                        layer_objects.append(obj)

                building_floor_objects.append(layer_objects)
                grid, cost_grid, wcells = self.build_grid_for_layer(layer_objects)
                building_floor_grids.append(grid)
                building_floor_costs.append(cost_grid)
                building_floor_paths.append(wcells)
                # Pre-build graph on green tiles — used instead of full-grid A*
                from src.pathfinding import build_path_graph
                building_floor_graphs.append(build_path_graph(wcells) if wcells else {})

            all_layers.append(building_floor_objects)
            all_grids.append(building_floor_grids)
            all_costs.append(building_floor_costs)
            all_paths.append(building_floor_paths)
            all_graphs.append(building_floor_graphs)

        self.buildings_layers = all_layers
        self.buildings_grids  = all_grids
        self.buildings_costs  = all_costs
        self.buildings_paths  = all_paths
        self.buildings_graphs = all_graphs

        self.layers = []
        self.grids  = []
        for bl in all_layers:
            self.layers.extend(bl)
        for bg in all_grids:
            self.grids.extend(bg)

        print(f"✅ Loaded {len(buildings)} building(s):")
        for b in self.buildings_data:
            print(f"   • {b['name']}: {b['floor_count']} floor(s)")
        total_objs = sum(len(l) for l in self.layers)
        print(f"✅ Total: {len(self.layers)} floor(s), {total_objs} objects")

        # Debug: show every loaded type so you can confirm nothing is silently dropped
        type_counts = {}
        for layer in self.layers:
            for o in layer:
                type_counts[o.type] = type_counts.get(o.type, 0) + 1
        print(f"   Object types loaded: {dict(sorted(type_counts.items()))}")

        self._validate_disaster_setup()

    # Types that the original MapObject.from_dict understands.
    # Any type NOT in this set goes straight to the dict-fallback loader.
    # Only types whose from_dict correctly preserves ALL needed fields
    # "line" intentionally excluded — from_dict ignores x1/y1/x2/y2
    def _safe_load_object(self, obj_data: dict, building_name: str = "", layer_idx: int = 0):
        """
        Load a map object via MapObject.from_dict().
        from_dict now handles every type the React editor produces:
          wall, exit, concrete_stairs, fire_ladder, stairs (legacy),
          npc, safezone, gate, fence, line (with x1/y1/x2/y2).
        """
        try:
            obj = MapObject.from_dict(obj_data)
            if obj is not None:
                return obj
        except Exception as e:
            print(f"  ❌ from_dict failed for '{obj_data.get('type','?')}' "
                  f"in {building_name} fl{layer_idx+1}: {e}")
        return None
    def _validate_disaster_setup(self):
        """Warn about missing or incompatible objects for the chosen disaster type."""
        safe_zone_count = 0
        concrete_count  = 0
        ladder_count    = 0

        for building_layers in self.buildings_layers:
            for layer_objects in building_layers:
                safe_zone_count += sum(1 for o in layer_objects if o.type == "safezone")
                concrete_count  += sum(1 for o in layer_objects if o.type in ("concrete_stairs", "stairs"))
                ladder_count    += sum(1 for o in layer_objects if o.type == "fire_ladder")

        if self.disaster_type == "earthquake":
            if safe_zone_count == 0:
                print("⚠️  WARNING: Earthquake drill but NO SAFE ZONES found! Agents will have no target.")
            else:
                print(f"✅ Found {safe_zone_count} safe zone(s) for earthquake drill.")

            if ladder_count > 0:
                print(f"ℹ️  {ladder_count} fire ladder(s) will be IGNORED during earthquake simulation.")

        else:  # fire / bomb
            if ladder_count > 0 and self.disaster_type == "fire":
                print(f"✅ {ladder_count} fire ladder(s) are available for fire evacuation.")
            elif ladder_count > 0:
                print(f"ℹ️  {ladder_count} fire ladder(s) will be IGNORED during {self.disaster_type} simulation.")

        print(f"ℹ️  {concrete_count} concrete stair(s) available (usable in all drills).")

    def build_grid_for_layer(self, layer_objects):
        """
        Build a 0/1 collision grid.

        WALLS are HOLLOW — only the 1-cell-thick border is marked as blocked.
        The interior is left walkable (0). This matches the visual where a wall
        rectangle is just an outline, and agents can occupy the space inside.

        FENCES and CLOSED GATES are fully filled (solid barrier).

        LINE objects (used by the line tool) are rasterized via Bresenham so
        they also act as thin barriers in the grid.

        All other types (stairs, exit, safezone, npc, etc.) are walkable.
        """
        grid = [[0] * self.grid_width for _ in range(self.grid_height)]

        def mark(gx, gy):
            if 0 <= gy < self.grid_height and 0 <= gx < self.grid_width:
                grid[gy][gx] = 1

        def fill_rect(x1, y1, x2, y2):
            """Fill every cell in the rectangle."""
            for gy in range(y1, y2 + 1):
                for gx in range(x1, x2 + 1):
                    mark(gx, gy)

        def border_rect(x1, y1, x2, y2):
            """Mark only the 1-cell-thick border of a rectangle (hollow)."""
            if x2 < x1 or y2 < y1:
                return
            if x2 == x1 or y2 == y1:
                # Degenerate (1-cell-wide): just fill
                fill_rect(x1, y1, x2, y2)
                return
            # Top row
            for gx in range(x1, x2 + 1): mark(gx, y1)
            # Bottom row
            for gx in range(x1, x2 + 1): mark(gx, y2)
            # Left column (excluding corners already done)
            for gy in range(y1 + 1, y2): mark(x1, gy)
            # Right column (excluding corners)
            for gy in range(y1 + 1, y2): mark(x2, gy)

        def bresenham(gx0, gy0, gx1, gy1):
            """Mark all cells along a line segment."""
            dx, dy = abs(gx1 - gx0), abs(gy1 - gy0)
            sx = 1 if gx0 < gx1 else -1
            sy = 1 if gy0 < gy1 else -1
            err = dx - dy
            cx, cy = gx0, gy0
            while True:
                mark(cx, cy)
                if cx == gx1 and cy == gy1:
                    break
                e2 = 2 * err
                if e2 > -dy: err -= dy; cx += sx
                if e2 <  dx: err += dx; cy += sy

        for obj in layer_objects:
            t = obj.type

            # ── WALL: hollow border only ──────────────────────────────────────
            if t == "wall":
                gx1 = max(0, int(obj.x // self.cell_size))
                gy1 = max(0, int(obj.y // self.cell_size))
                gx2 = min(self.grid_width  - 1, int((obj.x + obj.w) // self.cell_size))
                gy2 = min(self.grid_height - 1, int((obj.y + obj.h) // self.cell_size))
                border_rect(gx1, gy1, gx2, gy2)

            # ── FENCE / CLOSED GATE: fully solid ─────────────────────────────
            elif t == "fence" or (t == "gate" and not getattr(obj, 'is_open', True)):
                gx1 = max(0, int(obj.x // self.cell_size))
                gy1 = max(0, int(obj.y // self.cell_size))
                gx2 = min(self.grid_width  - 1, int((obj.x + obj.w) // self.cell_size))
                gy2 = min(self.grid_height - 1, int((obj.y + obj.h) // self.cell_size))
                fill_rect(gx1, gy1, gx2, gy2)

            # ── LINE / ROOM WALL: rasterized via Bresenham ───────────────────
            # LineWall objects (type='line') store coords in x1/y1/x2/y2.
            # Both room walls (is_room_wall=True) and regular line tools block.
            elif t == "line":
                x1 = getattr(obj, 'x1', None)
                y1 = getattr(obj, 'y1', None)
                x2 = getattr(obj, 'x2', None)
                y2 = getattr(obj, 'y2', None)
                if None not in (x1, y1, x2, y2):
                    # round() instead of int()/floor() so erased gap edges
                    # snap to the same cell boundaries as the editor grid
                    gx1 = round(float(x1) / self.cell_size)
                    gy1 = round(float(y1) / self.cell_size)
                    gx2 = round(float(x2) / self.cell_size)
                    gy2 = round(float(y2) / self.cell_size)
                    bresenham(gx1, gy1, gx2, gy2)
                else:
                    print(f"  ⚠️  line object missing x1/y1/x2/y2 — skipped")

            # ── LEGACY WALL (old maps before Room tool) ───────────────────────
            elif t == "wall":
                gx1 = max(0, int(obj.x // self.cell_size))
                gy1 = max(0, int(obj.y // self.cell_size))
                gx2 = min(self.grid_width  - 1, int((obj.x + obj.w) // self.cell_size))
                gy2 = min(self.grid_height - 1, int((obj.y + obj.h) // self.cell_size))
                border_rect(gx1, gy1, gx2, gy2)

            # All other types (exit, safezone, npc, concrete_stairs,
            # fire_ladder, path, etc.) are walkable — do nothing.
            # 'path' walkable = no obstacle; 'path' dangerous = walkable but
            # agents may take damage (handled in agent.py step()).

        # ── Cost grid for path tiles ──────────────────────────────────────
        # path_walkable: core cells = -0.9 (10x cheaper), 1-cell halo = -0.4 (1.7x cheaper)
        # This gradient pulls A* toward the path from nearby cells, so agents
        # naturally funnel onto path_walkable tiles even when starting far away.
        # path_danger: +4.0 (5x more expensive) — agents avoid strongly.
        cost_grid = [[0.0] * self.grid_width for _ in range(self.grid_height)]
        walkable_cells = set()

        for obj in layer_objects:
            if obj.type in ('path_walkable', 'path'):
                gx1 = max(0, int(obj.x // self.cell_size))
                gy1 = max(0, int(obj.y // self.cell_size))
                gx2 = min(self.grid_width  - 1, int((obj.x + obj.w) // self.cell_size))
                gy2 = min(self.grid_height - 1, int((obj.y + obj.h) // self.cell_size))
                for gy in range(gy1, gy2 + 1):
                    for gx in range(gx1, gx2 + 1):
                        cost_grid[gy][gx] = -0.95  # 20x cheaper — agents follow corridor
                        walkable_cells.add((gx, gy))
            elif obj.type == 'path_danger':
                gx1 = max(0, int(obj.x // self.cell_size))
                gy1 = max(0, int(obj.y // self.cell_size))
                gx2 = min(self.grid_width  - 1, int((obj.x + obj.w) // self.cell_size))
                gy2 = min(self.grid_height - 1, int((obj.y + obj.h) // self.cell_size))
                for gy in range(gy1, gy2 + 1):
                    for gx in range(gx1, gx2 + 1):
                        cost_grid[gy][gx] = 4.0    # 5x more expensive — agents avoid

        # Halo removed — cost_grid no longer used in A* to avoid over-exploration

        return grid, cost_grid, walkable_cells

        blocked = sum(grid[y][x] for y in range(self.grid_height) for x in range(self.grid_width))
        total   = self.grid_width * self.grid_height
        print(f"  🗺️  Grid built: {blocked}/{total} cells blocked ({100*blocked/total:.1f}%)")

    def load_environment_from_file(self, path="environment.json"):
        try:
            with open(path, "r") as f:
                data = json.load(f)

            if isinstance(data, dict) and "layers" in data:
                self.layers = []
                for layer_data in data.get("layers", []):
                    layer_objects = []
                    for obj_data in layer_data:
                        try:
                            layer_objects.append(MapObject.from_dict(obj_data))
                        except Exception as e:
                            print(f"❌ Error loading object: {e}")
                    self.layers.append(layer_objects)
            else:
                objs = []
                for obj_data in data:
                    try:
                        objs.append(MapObject.from_dict(obj_data))
                    except Exception as e:
                        print(f"❌ Error loading object: {e}")
                self.layers = [objs]

            print(f"✅ Loaded {len(self.layers)} layer(s) from {path}")
        except FileNotFoundError:
            print(f"⚠️ {path} not found")
            self.layers = [[]]

    def load_grid_from_file(self, path="grid.json"):
        try:
            with open(path, "r") as f:
                data = json.load(f)

            if isinstance(data, dict) and "layers" in data:
                self.grids       = data.get("layers", [])
                self.cell_size   = data.get("cell_size", 10)
                self.grid_width  = data.get("width",  len(self.grids[0][0]) if self.grids and self.grids[0] else 0)
                self.grid_height = data.get("height", len(self.grids[0])    if self.grids else 0)
            else:
                self.grids     = [data.get("grid", data)]
                self.cell_size = data.get("cell_size", 10)

            print(f"✅ Loaded {len(self.grids)} grid(s) from {path}")
        except FileNotFoundError:
            print(f"⚠️ {path} not found, building grids from layers")
            pairs = [self.build_grid_for_layer(layer) for layer in self.layers]
            self.grids = [p[0] for p in pairs]
            # No buildings_costs for file-loaded maps without path tiles

    # ── Agent spawning ────────────────────────────────────────────────────────

    def spawn_agents(self, n_per_npc=10):
        agent_id = 0
        self.npc_zones = []

        print(f"\n👥 SPAWNING AGENTS (Disaster: {self.disaster_type.upper()})...")

        if not self.buildings_layers:
            print("⚠️ No buildings_layers found!")
            return

        for building_idx, building_layers in enumerate(self.buildings_layers):
            building_name = (self.buildings_data[building_idx]['name']
                             if building_idx < len(self.buildings_data)
                             else f"Building {building_idx + 1}")

            for floor_idx, layer_objects in enumerate(building_layers):
                # npc_count zones: register as delayed sequential spawners, don't spawn now
                npc_count_zones = [o for o in layer_objects if o.type == "npc_count"]
                for nco in npc_count_zones:
                    count    = int(getattr(nco, 'agent_count', 10))
                    interval = int(getattr(nco, 'spawn_interval', 10))
                    self.spawn_queues.append({
                        'remaining':   min(count, 2000),
                        'interval':    interval,
                        'countdown':   0,          # spawn first agent immediately
                        'zone':        nco,
                        'building_idx': building_idx,
                        'floor_idx':   floor_idx,
                        'speed':       getattr(nco, 'speed', 2.0),
                    })
                    print(f"   ⏳ Queue zone registered: {count} agents, 1 per {interval} steps")

                npc_zones = [o for o in layer_objects if o.type == "npc"]
                if not npc_zones:
                    continue

                for npc_idx, npc in enumerate(npc_zones):
                    zone_w    = npc.w
                    zone_h    = npc.h
                    zone_x    = npc.x
                    zone_y    = npc.y
                    npc_speed = getattr(npc, 'speed', 2.0)
                    npc_name  = getattr(npc, 'name', f'NPC{npc_idx + 1}')

                    # margin = 1 cell from each edge, min_spacing = 1 cell between agents
                    # Both scale with cell_size so they work at any resolution
                    margin      = self.cell_size          # 1 cell margin from edge
                    min_spacing = self.cell_size          # 1 cell between agents

                    usable_w = max(self.cell_size, zone_w - 2 * margin)
                    usable_h = max(self.cell_size, zone_h - 2 * margin)

                    cols = max(1, int(usable_w / min_spacing))
                    rows = max(1, int(usable_h / min_spacing))

                    # Number of agents = how many fit in the grid (no separate density cap)
                    agents_to_spawn = min(cols * rows, 2000)

                    if agents_to_spawn <= 0:
                        print(f"   ⚠️ Zone '{npc_name}' too small for agents")
                        continue

                    print(f"   📐 Zone '{npc_name}': {zone_w:.0f}×{zone_h:.0f}px "
                          f"→ {cols}×{rows} grid = {agents_to_spawn} agents")

                    cell_w = usable_w / cols
                    cell_h = usable_h / rows
                    positions = []
                    for row in range(rows):
                        for col in range(cols):
                            cx = zone_x + margin + col * cell_w + cell_w / 2 + random.uniform(-cell_w * 0.1, cell_w * 0.1)
                            cy = zone_y + margin + row * cell_h + cell_h / 2 + random.uniform(-cell_h * 0.1, cell_h * 0.1)
                            cx = max(zone_x + margin, min(cx, zone_x + zone_w - margin))
                            cy = max(zone_y + margin, min(cy, zone_y + zone_h - margin))
                            positions.append((cx, cy))

                    random.shuffle(positions)
                    agents_created = 0

                    for pos_x, pos_y in positions[:agents_to_spawn]:
                        if not (zone_x <= pos_x <= zone_x + zone_w and zone_y <= pos_y <= zone_y + zone_h):
                            continue

                        agent = PersonAgent(
                            agent_id, self, (pos_x, pos_y),
                            speed=npc_speed * random.uniform(0.9, 1.1),
                            disaster_type=self.disaster_type
                        )
                        agent.building_index = building_idx
                        agent.current_layer  = floor_idx
                        agent.spawn_source   = npc

                        self.agents.append(agent)
                        agent_id      += 1
                        agents_created += 1

                    self.npc_zones.append({
                        'building_idx':  building_idx,
                        'building_name': building_name,
                        'floor_idx':     floor_idx,
                        'npc_object':    npc,
                        'npc_name':      npc_name,
                        'agent_count':   agents_created,
                        'zone_bounds':   {'x': zone_x, 'y': zone_y, 'w': zone_w, 'h': zone_h}
                    })

                    # Store on the zone object so record_agent_path can read it
                    npc.agent_count = agents_created
                    print(f"   ✅ Spawned {agents_created} agents in '{npc_name}'")

        print(f"\n🎯 SPAWN SUMMARY: {agent_id} total agents across {len(self.npc_zones)} zones")

    # ── Main loop ─────────────────────────────────────────────────────────────

    def run(self, progress_callback=None, cancel_flag=None):
        """
        Analytical evacuation solver — computes results in seconds, not minutes.

        Instead of simulating physics step-by-step, we:
          1. Pre-compute A* paths for all agents upfront (one per unique start→goal pair)
          2. Calculate each agent's evacuation step = spawn_step + path_length / speed
          3. For queue zones, stagger spawn steps by their interval
          4. Report the correct paths for playback
          5. Skip the physics loop entirely — no separation, no velocity, no wall slides

        Falls back to step-by-step only when multi-floor stair transport is needed.
        """
        import math as _math

        print(f"\n🏃 STARTING SIMULATION (analytical solver)...")

        # ── Detect if stair transport is needed (multi-floor) ─────────────────
        needs_stairs = any(
            a.needs_transport or
            any(o.type in ("concrete_stairs", "stairs", "fire_ladder")
                for layer in self.buildings_layers[a.building_index]
                for o in layer)
            for a in self.agents
        ) if self.agents else False

        has_stairs_objects = any(
            o.type in ("concrete_stairs", "stairs", "fire_ladder")
            for layer in self.layers
            for o in layer
        )

        # ── Path cache: (start_cell, goal_cell, bidx, fidx) → smoothed path ──
        _path_cache: dict = {}

        # ONE best path per (zone_centre, goal) — shared by all agents from that zone.
        # path_walkable tiles are strongly preferred via cost_grid (-0.5 modifier).
        # PathVisualization shows this optimal route.
        # Agents follow it but spread laterally so they don't stack on each other.
        _path_cache:    dict = {}   # (sx, sy, gx, gy, bidx, fidx) → smoothed path
        _opening_cache: dict = {}   # (bidx, fidx) → list of opening cells (computed once)
        _exit_cache:    dict = {}   # (zone_id, bidx, fidx) → nearest exit object

        def get_zone_path(agent, spawn_pos):
            """
            Route: spawn → green entry → along green path → green exit → goal
            Cached per (zone_centre, goal, floor). All agents in a zone share it.
            """
            from src.pathfinding import route_with_green_path
            bidx = agent.building_index
            fidx = agent.current_layer
            if bidx >= len(self.buildings_grids) or fidx >= len(self.buildings_grids[bidx]):
                return []
            grid = self.buildings_grids[bidx][fidx]
            cs   = self.cell_size

            # All agents in same zone share start cell (zone centre)
            if agent.spawn_source is not None and hasattr(agent.spawn_source, 'x'):
                sx = int((agent.spawn_source.x + agent.spawn_source.w/2) // cs)
                sy = int((agent.spawn_source.y + agent.spawn_source.h/2) // cs)
            else:
                sx = int(spawn_pos[0] // cs)
                sy = int(spawn_pos[1] // cs)

            # Goal = target centre, find nearest open cell if blocked
            gcx = int((agent.target.x + agent.target.w/2) // cs)
            gcy = int((agent.target.y + agent.target.h/2) // cs)
            goal = (gcx, gcy)
            if 0 <= gcy < len(grid) and 0 <= gcx < len(grid[0]) and grid[gcy][gcx] == 1:
                found = False
                for r in range(1, 5):
                    for ddy in range(-r, r+1):
                        for ddx in range(-r, r+1):
                            nx2, ny2 = gcx+ddx, gcy+ddy
                            if 0 <= ny2 < len(grid) and 0 <= nx2 < len(grid[0]) and grid[ny2][nx2] == 0:
                                goal = (nx2, ny2); found = True; break
                        if found: break
                    if found: break

            cache_key = (sx, sy, goal[0], goal[1], bidx, fidx)
            if cache_key in _path_cache:
                return _path_cache[cache_key]

            # Get green path cells and pre-built graph for this floor
            path_cells = set()
            path_graph = {}
            if bidx < len(self.buildings_paths) and fidx < len(self.buildings_paths[bidx]):
                path_cells = self.buildings_paths[bidx][fidx]
            if bidx < len(self.buildings_graphs) and fidx < len(self.buildings_graphs[bidx]):
                path_graph = self.buildings_graphs[bidx][fidx]

            path = route_with_green_path(grid, (sx,sy), goal, path_cells, path_graph)
            on_green = sum(1 for p in path if p in path_cells)
            print(f"🛣️  Path computed: {len(path)} waypoints, {on_green} on green, "
                  f"start={( sx,sy)}, goal={goal}, "
                  f"green_cells_on_floor={len(path_cells)}")
            _path_cache[cache_key] = path
            return path

        def path_world_length(path):
            if len(path) < 2:
                return 0.0
            total = 0.0
            cs = self.cell_size
            for i in range(len(path) - 1):
                ax, ay = path[i][0] * cs, path[i][1] * cs
                bx, by = path[i+1][0] * cs, path[i+1][1] * cs
                total += _math.hypot(bx - ax, by - ay)
            return total

        # Pre-cache path openings for all floors (done once, reused per agent)
        from src.pathfinding import get_path_openings
        for bidx2, floors in enumerate(self.buildings_paths):
            for fidx2, pcells in enumerate(floors):
                _opening_cache[(bidx2, fidx2)] = get_path_openings(pcells) if pcells else []

        # ── Phase 1: process density-spawn agents (already in self.agents) ────
        total_agents     = len(self.agents)
        all_agent_records = []  # (spawn_step, evac_step, agent, spawn_pos)

        density_total = len(self.agents)
        for agent_idx, agent in enumerate(self.agents):
            if cancel_flag and cancel_flag.get('cancel'): break
            # Report progress during density agent processing
            if progress_callback and density_total > 0 and agent_idx % max(1, density_total // 5) == 0:
                progress_callback({'pct': round(agent_idx / density_total * 10, 1),
                                   'step': agent_idx, 'max_steps': self.max_steps,
                                   'evacuated': 0, 'remaining': density_total - agent_idx,
                                   'queued': sum(q['remaining'] for q in self.spawn_queues), 'total': density_total})
            spawn_pos = tuple(agent.pos)
            if not agent.target:
                agent.target = agent.get_random_exit()
            if not agent.target:
                continue
            path = get_zone_path(agent, spawn_pos)
            agent.path = path
            # Record path for playback
            self.record_agent_path(
                agent.building_index, agent.current_layer,
                path, self.cell_size,
                agent_pos=spawn_pos,
                agent_id=agent.unique_id,
                spawn_source=getattr(agent, 'spawn_source', None),
                spawn_step=0,
            )
            if path:
                length    = path_world_length(path)
                evac_step = int(length / max(agent.speed, 0.5)) + 5  # +5 buffer
            else:
                evac_step = self.max_steps  # trapped
            all_agent_records.append((0, evac_step, agent))

        # ── Phase 2: process queue-spawn agents ────────────────────────────────
        for q in self.spawn_queues:
            nco       = q['zone']
            bidx      = q['building_idx']
            fidx      = q['floor_idx']
            interval  = q['interval']
            remaining = q['remaining']
            speed_base = q['speed']

            # Set model context for target selection
            if bidx < len(self.buildings_layers) and fidx < len(self.buildings_layers[bidx]):
                self.objects = self.buildings_layers[bidx][fidx]
            if bidx < len(self.buildings_grids) and fidx < len(self.buildings_grids[bidx]):
                self.grid = self.buildings_grids[bidx][fidx]

            # Spawn in batches of 5 (same as original)
            step_cursor = 0
            spawned_in_queue = 0
            while spawned_in_queue < remaining:
                batch = min(5, remaining - spawned_in_queue)
                for _ in range(batch):
                    if cancel_flag and cancel_flag.get('cancel'): break
                    px = nco.x + random.uniform(0, nco.w)
                    py = nco.y + random.uniform(0, nco.h)
                    agent_id = total_agents + len(self.evacuated_agents)
                    total_agents += 1
                    agent = PersonAgent(
                        agent_id, self, (px, py),
                        speed=speed_base * random.uniform(0.9, 1.1),
                        disaster_type=self.disaster_type,
                    )
                    agent.building_index = bidx
                    agent.current_layer  = fidx
                    agent.spawn_source   = nco
                    if bidx < len(self.buildings_layers) and fidx < len(self.buildings_layers[bidx]):
                        agent.model.objects = self.buildings_layers[bidx][fidx]
                    if bidx < len(self.buildings_grids) and fidx < len(self.buildings_grids[bidx]):
                        agent.model.grid = self.buildings_grids[bidx][fidx]
                    agent.target = agent.get_random_exit()
                    if not agent.target:
                        continue
                    spawn_pos = (px, py)
                    path = get_zone_path(agent, spawn_pos)
                    agent.path = path
                    self.record_agent_path(
                        bidx, fidx, path, self.cell_size,
                        agent_pos=spawn_pos,
                        agent_id=agent.unique_id,
                        spawn_source=nco,
                        spawn_step=step_cursor,
                    )
                    if path:
                        length    = path_world_length(path)
                        evac_step = step_cursor + int(length / max(agent.speed, 0.5)) + 5
                    else:
                        evac_step = self.max_steps
                    all_agent_records.append((step_cursor, evac_step, agent))
                    spawned_in_queue += 1
                step_cursor += interval
                # Report progress during queue processing
                if progress_callback:
                    total_q = sum(q['remaining'] for q in self.spawn_queues) + spawned_in_queue
                    pct_done = 10 + round(spawned_in_queue / max(1, remaining) * 80, 1)
                    progress_callback({'pct': min(pct_done, 89.0), 'step': step_cursor,
                                       'max_steps': self.max_steps, 'evacuated': 0,
                                       'remaining': remaining - spawned_in_queue,
                                       'queued': remaining - spawned_in_queue, 'total': remaining})

        if cancel_flag and cancel_flag.get('cancel'):
            print(f"⛔ Simulation cancelled during analytical solve")
            elapsed = time.time() - self.start_time
            results = self.get_results()
            results['elapsed_s'] = round(elapsed, 3)
            results['steps']     = 0
            return results

        # ── Phase 3: sort by evac_step and mark all as evacuated ──────────────
        all_agent_records.sort(key=lambda r: r[1])
        total   = len(all_agent_records)
        trapped = sum(1 for _, es, _ in all_agent_records if es >= self.max_steps)

        max_evac_step = max((es for _, es, _ in all_agent_records), default=0)
        max_evac_step = min(max_evac_step, self.max_steps)
        self.step_count = max_evac_step

        # Mark agents evacuated and build self.evacuated_agents
        for spawn_step, evac_step, agent in all_agent_records:
            agent.time_evacuated = evac_step
            if evac_step < self.max_steps:
                agent.evacuated = True
                self.evacuated_agents.append(agent)
            else:
                self.agents.append(agent)

        # ── Phase 4: report progress in virtual chunks for the UI ─────────────
        if progress_callback and total > 0:
            chunk = max(1, total // 20)  # ~20 progress updates
            for i in range(0, total, chunk):
                if cancel_flag and cancel_flag.get('cancel'): break
                evac_so_far = sum(1 for j in range(min(i+chunk, total))
                                  if all_agent_records[j][1] < self.max_steps)
                virtual_step = all_agent_records[min(i+chunk-1, total-1)][1]
                pct = round((i + chunk) / total * 100, 1)
                progress_callback({
                    'step':      min(virtual_step, max_evac_step),
                    'max_steps': max_evac_step,
                    'pct':       min(pct, 99.0),
                    'evacuated': evac_so_far,
                    'remaining': max(0, total - i - chunk - trapped),
                    'queued':    0,
                    'total':     total,
                })

        elapsed = time.time() - self.start_time
        results  = self.get_results()
        results['elapsed_s'] = round(elapsed, 3)
        results['steps']     = self.step_count

        print(f"\n✅ Analytical solve: {len(self.evacuated_agents)}/{total} evacuated "
              f"in {elapsed:.2f}s real time ({self.step_count} virtual steps)")
        return results


    def get_results(self):
        total_spawned = len(self.agents) + len(self.evacuated_agents)
        evacuated     = len(self.evacuated_agents)
        trapped       = len(self.agents)

        exits_count    = sum(len([o for o in layer if o.type == "exit"])           for layer in self.layers)
        walls_count    = sum(len([o for o in layer if o.type == "wall"])           for layer in self.layers)
        safezones_count = sum(len([o for o in layer if o.type == "safezone"])      for layer in self.layers)
        concrete_count  = sum(len([o for o in layer if o.type in ("concrete_stairs","stairs")]) for layer in self.layers)
        ladder_count    = sum(len([o for o in layer if o.type == "fire_ladder"])   for layer in self.layers)

        evac_times = []
        for agent in self.evacuated_agents:
            if hasattr(agent, "time_evacuated") and agent.time_evacuated is not None:
                try:
                    t = float(agent.time_evacuated)
                    if t > 0:
                        evac_times.append(t)
                except (ValueError, TypeError):
                    pass

        avg_evac_time = (sum(evac_times) / len(evac_times)) if evac_times else float(self.simulation_time) if evacuated > 0 else 0.0

        return {
            "status":         "success",
            "disaster_type":  self.disaster_type,
            "steps":          int(self.step_count),
            "evacuation_time": float(round(avg_evac_time, 1)),
            "agents_spawned":  int(total_spawned),
            "agents_evacuated": int(evacuated),
            "agents_trapped":  int(trapped),
            "exits_count":     int(exits_count),
            "safezones_count": int(safezones_count),
            "walls_count":     int(walls_count),
            "concrete_stairs_count": int(concrete_count),
            "fire_ladders_count":    int(ladder_count),
            "paths":    self.serialize_paths(),
            "npc_zones": [
                {
                    'building_idx':  z['building_idx'],
                    'building_name': z['building_name'],
                    'floor_idx':     z['floor_idx'],
                    'npc_name':      z['npc_name'],
                    'agent_count':   z['agent_count'],
                    'zone_bounds':   z['zone_bounds']
                }
                for z in self.npc_zones
            ],
            "message": "Simulation completed successfully",
            "total_steps": int(self.step_count),
            "real_elapsed_s": round(time.time() - self.start_time, 2),
        }

    def serialize_paths(self):
        result = {}
        for key, by_source in self.path_visuals.items():
            if key.startswith('b') and '_f' in key:
                parts        = key.split('_f')
                building_key = parts[0][1:]
                floor_key    = parts[1]
                if building_key not in result:
                    result[building_key] = {}
                serialized = []
                for entry in by_source.values():
                    if isinstance(entry, dict):
                        # Skip corridor markers — these are the painted tiles,
                        # not agent routes, so PathVisualization doesn't draw them
                        if entry.get('is_corridor') or entry.get('zone_agent_count', 1) == 0:
                            continue
                        serialized.append({
                            'points':           [[float(x), float(y)] for x, y in entry['points']],
                            'spawn_step':       entry.get('spawn_step', 0),
                            'zone_agent_count': entry.get('zone_agent_count', 1),
                        })
                    else:
                        serialized.append({
                            'points':           [[float(x), float(y)] for x, y in entry],
                            'spawn_step':       0,
                            'zone_agent_count': 1,
                        })
                result[building_key][floor_key] = serialized
        return result

    def record_walkable_corridors(self):
        """
        Build PathVisualization data directly from path_walkable tile positions —
        one clean polyline per connected corridor, not from agent A* routes.
        Stored under key 'corridors' so PathVisualization can show them simply.
        """
        for bidx, building in enumerate(self.buildings_layers):
            for fidx, layer in enumerate(building):
                key = f"b{bidx}_f{fidx}"
                if key not in self.path_visuals:
                    self.path_visuals[key] = {}
                # Collect all path_walkable tile centres
                tiles = []
                for obj in layer:
                    if obj.type in ('path_walkable', 'path'):
                        cx = obj.x + obj.w / 2
                        cy = obj.y + obj.h / 2
                        tiles.append((cx, cy))
                if tiles:
                    # Sort by x then y to form a rough corridor line
                    tiles.sort(key=lambda p: (p[0], p[1]))
                    self.path_visuals[key]['__walkable_corridor__'] = {
                        'points':           tiles,
                        'spawn_step':       0,
                        'zone_agent_count': 0,   # 0 = corridor marker, not agent zone
                        'is_corridor':      True,
                    }

    def record_agent_path(self, building_index, floor_index, path_nodes, cell_size,
                          agent_pos=None, agent_id=None, spawn_source=None, spawn_step=None):
        """Record ONE representative agent route per spawn zone for playback."""
        if building_index < 0 or floor_index < 0:
            return

        key = f"b{building_index}_f{floor_index}"
        if key not in self.path_visuals:
            self.path_visuals[key] = {}

        zone_key = id(spawn_source) if spawn_source is not None else agent_id
        if zone_key is None:
            return
        if zone_key in self.path_visuals[key]:
            return  # already recorded for this zone

        pts = []
        # Convert each grid cell to world pixel — keep ALL cells for wall safety
        # (straight lines between adjacent 10px cells cannot cross walls)
        for node in path_nodes:
            try:
                gx, gy = node
            except (TypeError, ValueError):
                continue
            pts.append((gx * cell_size + cell_size / 2,
                        gy * cell_size + cell_size / 2))

        # Prepend spawn zone centre as visual origin only if it doesn't jump far
        origin = None
        if spawn_source is not None and hasattr(spawn_source, 'x'):
            origin = (float(spawn_source.x) + float(spawn_source.w) / 2,
                      float(spawn_source.y) + float(spawn_source.h) / 2)
        elif agent_pos is not None:
            origin = (float(agent_pos[0]), float(agent_pos[1]))

        if origin and pts:
            import math as _m
            # Only prepend origin if it's within 2 cells of first path point
            if _m.hypot(origin[0]-pts[0][0], origin[1]-pts[0][1]) <= cell_size * 3:
                pts.insert(0, origin)

        if len(pts) >= 2:
            zone_count = int(getattr(spawn_source, 'agent_count', 1)) if spawn_source is not None else 1
            self.path_visuals[key][zone_key] = {
                'points':           pts,
                'spawn_step':       spawn_step if spawn_step is not None else 0,
                'zone_agent_count': zone_count,
            }



def run_simulation(project_data, max_steps=10000, disaster_type="fire",
                    progress_callback=None, cancel_flag=None):
    sim = Simulation(project_data, max_steps, disaster_type=disaster_type)
    return sim.run(progress_callback=progress_callback, cancel_flag=cancel_flag)