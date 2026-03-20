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

            for layer_idx, layer_data in enumerate(building_layers):
                layer_objects = []
                for obj_data in layer_data:
                    obj = self._safe_load_object(obj_data, building_name, layer_idx)
                    if obj is not None:
                        layer_objects.append(obj)

                building_floor_objects.append(layer_objects)
                building_floor_grids.append(self.build_grid_for_layer(layer_objects))

            all_layers.append(building_floor_objects)
            all_grids.append(building_floor_grids)

        self.buildings_layers = all_layers
        self.buildings_grids  = all_grids

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
            # fire_ladder, etc.) are walkable — do nothing.

        blocked = sum(grid[y][x] for y in range(self.grid_height) for x in range(self.grid_width))
        total   = self.grid_width * self.grid_height
        print(f"  🗺️  Grid built: {blocked}/{total} cells blocked ({100*blocked/total:.1f}%)")
        return grid

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
            self.grids = [self.build_grid_for_layer(layer) for layer in self.layers]

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
                    interval = int(getattr(nco, 'spawn_interval', 30))
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

                    print(f"   ✅ Spawned {agents_created} agents in '{npc_name}'")

        print(f"\n🎯 SPAWN SUMMARY: {agent_id} total agents across {len(self.npc_zones)} zones")

    # ── Main loop ─────────────────────────────────────────────────────────────

    def run(self, progress_callback=None, cancel_flag=None):
        """
        progress_callback(info: dict) — called every 100 steps.
        cancel_flag: dict with {'cancel': bool} — checked every step.
        """
        print(f"\n🏃 STARTING SIMULATION (max {self.max_steps} steps)...")

        while (self.agents or any(q['remaining'] > 0 for q in self.spawn_queues)) and self.step_count < self.max_steps:
            # Check cancel flag
            if cancel_flag and cancel_flag.get('cancel'):
                print(f"⛔ Simulation cancelled at step {self.step_count}")
                break
            self.update()
            self.step_count += 1

            if self.step_count % 100 == 0 and progress_callback:
                evacuated = len(self.evacuated_agents)
                remaining = len(self.agents)
                queued    = sum(q['remaining'] for q in self.spawn_queues)
                total     = evacuated + remaining + queued
                pct       = round(evacuated / total * 100, 1) if total > 0 else 0.0
                progress_callback({
                    'step':      self.step_count,
                    'max_steps': self.max_steps,
                    'evacuated': evacuated,
                    'remaining': remaining,
                    'queued':    queued,
                    'total':     total,
                    'pct':       pct,
                })

            if self.step_count % 500 == 0 and self.step_count > 0:
                evacuated  = len(self.evacuated_agents)
                remaining  = len(self.agents)
                queued     = sum(q['remaining'] for q in self.spawn_queues)
                total      = evacuated + remaining + queued
                pct        = (evacuated / total * 100) if total > 0 else 0
                elapsed    = time.time() - self.start_time
                rate       = evacuated / elapsed if elapsed > 0 else 0  # agents/sec
                eta_agents = remaining + queued
                eta_s      = (eta_agents / rate) if rate > 0 else 0
                print(f"   Step {self.step_count}: {evacuated}/{total} evacuated "
                      f"({pct:.0f}%) | {remaining} moving | {queued} queued | "
                      f"ETA ~{eta_s:.0f}s | elapsed {elapsed:.1f}s")

        elapsed = time.time() - self.start_time
        results = self.get_results()
        results['elapsed_s'] = round(elapsed, 3)
        results['steps']     = self.step_count

        if self.agents:
            print(f"\n⏱️ TIMEOUT after {self.step_count} steps ({len(self.agents)} agents still inside)")
        else:
            print(f"\n✅ ALL AGENTS EVACUATED in {self.step_count} steps ({elapsed:.2f}s)")

        return results

    def update(self):
        self.time = time.time() - self.start_time

        # Transport agents waiting at stairs
        for agent in [a for a in self.agents if a.needs_transport]:
            self.transport_agent_via_stairs(agent)

        # Agent-agent separation (same building + floor)
        for i, agent in enumerate(self.agents):
            for j, other in enumerate(self.agents):
                if i >= j:
                    continue
                if agent.building_index != other.building_index:
                    continue
                if agent.current_layer != other.current_layer:
                    continue
                dx   = other.pos[0] - agent.pos[0]
                dy   = other.pos[1] - agent.pos[1]
                dist = math.hypot(dx, dy)
                if 0 < dist < 8:
                    angle = math.atan2(dy, dx)
                    agent.pos[0] -= math.cos(angle) * 0.3
                    agent.pos[1] -= math.sin(angle) * 0.3

        # Process sequential spawn queues (npc_count zones)
        for q in self.spawn_queues:
            if q['remaining'] <= 0:
                continue
            if q['countdown'] > 0:
                q['countdown'] -= 1
                continue
            # Time to spawn one agent
            nco   = q['zone']
            bidx  = q['building_idx']
            fidx  = q['floor_idx']
            # Random position inside the zone
            px = nco.x + random.uniform(0, nco.w)
            py = nco.y + random.uniform(0, nco.h)
            agent_id = len(self.agents) + len(self.evacuated_agents)
            agent = PersonAgent(
                agent_id, self, (px, py),
                speed=q['speed'] * random.uniform(0.9, 1.1),
                disaster_type=self.disaster_type
            )
            agent.building_index = bidx
            agent.current_layer  = fidx
            agent.spawn_source   = nco

            # Set layer objects so target selection works immediately
            if bidx < len(self.buildings_layers) and fidx < len(self.buildings_layers[bidx]):
                agent.model.objects = self.buildings_layers[bidx][fidx]
            if bidx < len(self.buildings_grids) and fidx < len(self.buildings_grids[bidx]):
                agent.model.grid = self.buildings_grids[bidx][fidx]

            # Assign target and path right away
            agent.target = agent.get_random_exit()
            if agent.target:
                self.calculate_path_for_agent(agent)

            self.agents.append(agent)
            q['remaining']  -= 1
            q['countdown']   = q['interval']

        # Update each agent
        for agent in self.agents:
            bidx = agent.building_index
            fidx = agent.current_layer

            if bidx < len(self.buildings_layers) and fidx < len(self.buildings_layers[bidx]):
                agent.model.objects = self.buildings_layers[bidx][fidx]
            if bidx < len(self.buildings_grids) and fidx < len(self.buildings_grids[bidx]):
                agent.model.grid = self.buildings_grids[bidx][fidx]

            if not agent.target:
                if self.step_count == 1:
                    print(f"🔍 Agent {agent.unique_id} searching for target...")
                agent.target = agent.get_random_exit()
                if agent.target:
                    self.calculate_path_for_agent(agent)
                elif self.step_count == 1:
                    print(f"   ❌ Agent {agent.unique_id} found NO target!")

            agent.step()

        self.simulation_time = time.time() - self.start_time
        self.log_data()

        # Evacuation handling
        if self.disaster_type == "earthquake":
            # Agents that reached a safe zone stay visible but are counted as evacuated
            for a in self.agents:
                if a.in_safe_zone and a not in self.evacuated_agents:
                    self.evacuated_agents.append(a)
            # Agents that used stairs (last-resort in earthquake) disappear just like fire
            stairs_evacuated = [a for a in self.agents if a.evacuated and not a.in_safe_zone]
            self.evacuated_agents.extend(stairs_evacuated)
            self.agents = [a for a in self.agents if not (a.evacuated and not a.in_safe_zone)]
        else:
            # Fire / bomb: all evacuated agents disappear
            newly_evacuated = [a for a in self.agents if a.evacuated]
            self.evacuated_agents.extend(newly_evacuated)
            self.agents = [a for a in self.agents if not a.evacuated]

    # ── Stair transport ───────────────────────────────────────────────────────

    def transport_agent_via_stairs(self, agent):
        """
        Move an agent from one floor to another via stairs.
        Respects disaster type: fire_ladders are skipped during earthquake/bomb.
        """
        valid_stair_types = allowed_stair_types(self.disaster_type)

        # Find the stairs object the agent is currently using
        stairs_obj = None
        for layer_objects in self.layers:
            for obj in layer_objects:
                if (hasattr(obj, 'id') and obj.id == agent.stairs_used
                        and obj.type in valid_stair_types):
                    stairs_obj = obj
                    break
            if stairs_obj:
                break

        if not stairs_obj:
            agent.needs_transport = False
            return

        target_name   = getattr(stairs_obj, "connects_to", None) or ""
        target_stairs = None
        target_layer  = None

        if target_name:
            for layer_idx, layer_objects in enumerate(self.layers):
                if layer_idx == agent.current_layer:
                    continue
                for obj in layer_objects:
                    if (obj.type in valid_stair_types
                            and getattr(obj, "name", None) == target_name):
                        target_stairs = obj
                        target_layer  = layer_idx
                        break
                if target_stairs:
                    break

        if target_stairs:
            cx = target_stairs.x + target_stairs.w / 2
            cy = target_stairs.y + target_stairs.h / 2
            offset = max(target_stairs.w, target_stairs.h) * 0.7

            agent.pos[0]        = cx + offset
            agent.pos[1]        = cy
            agent.current_layer = target_layer
            agent.stairs_cooldown = 0.5

            layer_objects = self.layers[agent.current_layer]
            exits  = [o for o in layer_objects if o.type == "exit"]
            stairs = [o for o in layer_objects if o.type in valid_stair_types]

            if exits:
                agent.target = random.choice(exits)
            elif stairs:
                agent.target = random.choice(stairs)

            if agent.target:
                self.calculate_path_for_agent(agent, record_path=False)

        agent.needs_transport = False

    # ── Pathfinding ───────────────────────────────────────────────────────────

    def calculate_path_for_agent(self, agent, record_path=True):
        bidx = agent.building_index
        fidx = agent.current_layer

        if bidx >= len(self.buildings_grids):
            return
        if fidx >= len(self.buildings_grids[bidx]):
            return

        from src.pathfinding import astar, smooth_path

        grid      = self.buildings_grids[bidx][fidx]
        cell_size = self.cell_size

        start = (int(agent.pos[0] // cell_size), int(agent.pos[1] // cell_size))
        goal  = (int((agent.target.x + agent.target.w / 2) // cell_size),
                 int((agent.target.y + agent.target.h / 2) // cell_size))

        raw_path   = astar(grid, start, goal)
        agent.path = smooth_path(raw_path) if raw_path else []
        agent.path_index = 0

        if record_path:
            path_to_record = list(agent.path or raw_path or [])
            self.record_agent_path(
                bidx, fidx,
                path_to_record,
                cell_size,
                agent_pos=tuple(agent.pos),
                agent_id=agent.unique_id,
                spawn_step=self.step_count,
            )

    def record_agent_path(self, building_index, floor_index, path_nodes, cell_size,
                          agent_pos=None, agent_id=None, spawn_source=None, spawn_step=None):
        """Record ONE representative path per spawn zone (keyed by spawn_source id).
        The path starts from the zone centre so PathVisualization shows clean
        zone-to-exit lines rather than hundreds of overlapping agent paths.
        """
        if building_index < 0 or floor_index < 0:
            return

        key = f"b{building_index}_f{floor_index}"
        if key not in self.path_visuals:
            self.path_visuals[key] = {}

        # One path per spawn zone — use spawn_source identity as key
        zone_key = id(spawn_source) if spawn_source is not None else agent_id
        if zone_key is None:
            return
        if zone_key in self.path_visuals[key]:
            return  # already have a representative path for this zone

        pts = []

        # Use zone CENTRE as the path start (not the individual agent position)
        if spawn_source is not None and hasattr(spawn_source, 'x'):
            zone_cx = float(spawn_source.x) + float(spawn_source.w) / 2
            zone_cy = float(spawn_source.y) + float(spawn_source.h) / 2
            pts.append((zone_cx, zone_cy))
        elif agent_pos is not None:
            pts.append((float(agent_pos[0]), float(agent_pos[1])))

        for node in path_nodes:
            try:
                gx, gy = node
            except (TypeError, ValueError):
                continue
            pts.append((gx * cell_size + cell_size / 2,
                        gy * cell_size + cell_size / 2))

        if len(pts) >= 2:
            self.path_visuals[key][zone_key] = {
                'points':     pts,
                'spawn_step': spawn_step if spawn_step is not None else 0,
            }

    # ── Logging ───────────────────────────────────────────────────────────────

    def log_data(self):
        evacuated    = len(self.evacuated_agents)
        total_agents = len(self.agents) + evacuated

        total_evac_time = 0.0
        valid_count     = 0
        for agent in self.evacuated_agents:
            if hasattr(agent, "time_evacuated") and agent.time_evacuated is not None:
                try:
                    t = float(agent.time_evacuated)
                    if t > 0:
                        total_evac_time += t
                        valid_count     += 1
                except (ValueError, TypeError):
                    pass

        avg_time = total_evac_time / valid_count if valid_count > 0 else 0.0

        total_dist = 0.0
        for agent in self.agents + self.evacuated_agents:
            if hasattr(agent, "distance_traveled"):
                try:
                    total_dist += float(agent.distance_traveled)
                except (ValueError, TypeError):
                    pass
        avg_dist = total_dist / total_agents if total_agents > 0 else 0.0

        exits = []
        for layer in self.layers:
            exits.extend(o for o in layer if o.type == "exit")

        exit_usage = {}
        for i, e in enumerate(exits):
            eid = getattr(e, "id", i)
            exit_usage[eid] = sum(
                1 for a in self.evacuated_agents
                if hasattr(a, "exit_used") and a.exit_used == eid
            )

        self.data_logger.log(self.simulation_time, evacuated, total_agents, avg_time, avg_dist, exit_usage)

    # ── Results ───────────────────────────────────────────────────────────────

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
                    # entry is now {points: [...], spawn_step: int}
                    if isinstance(entry, dict):
                        serialized.append({
                            'points':     [[float(x), float(y)] for x, y in entry['points']],
                            'spawn_step': entry['spawn_step'],
                        })
                    else:
                        # legacy flat list fallback
                        serialized.append({
                            'points':     [[float(x), float(y)] for x, y in entry],
                            'spawn_step': 0,
                        })
                result[building_key][floor_key] = serialized
        return result


def run_simulation(project_data, max_steps=10000, disaster_type="fire",
                    progress_callback=None, cancel_flag=None):
    sim = Simulation(project_data, max_steps, disaster_type=disaster_type)
    return sim.run(progress_callback=progress_callback, cancel_flag=cancel_flag)