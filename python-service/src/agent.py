# agent.py — DISASTER-AWARE AGENT with wall clearance
"""
✅ Wall repulsion: agents stay a safe distance from walls (except when entering exits)
✅ Strict diagonal wall check in pathfinding (handled in pathfinding.py)
✅ Disaster-aware: fire/bomb → exit; earthquake → safe zone
✅ Two stair types: concrete_stairs/stairs (all drills), fire_ladder (fire only)
"""
import random, math

ALLOWED_STAIRS = {
    "fire":       ("concrete_stairs", "stairs", "fire_ladder"),
    "earthquake": ("concrete_stairs", "stairs"),
    "bomb":       ("concrete_stairs", "stairs"),
}

# How many cells away from a wall agents try to stay (world-px = CLEARANCE * cell_size)
WALL_CLEARANCE_CELLS = 1.5


class PersonAgent:
    def __init__(self, unique_id, model, pos, speed=None, disaster_type="fire"):
        self.time_entered      = 0
        self.time_evacuated    = None
        self.path_traveled     = []
        self.distance_traveled = 0
        self.current_speed     = 0
        self.exit_used         = None
        self.stairs_used       = None
        self.needs_transport   = False
        self.current_layer     = 0
        self.stairs_cooldown   = 0.0
        self.building_index    = 0

        self.disaster_type   = disaster_type
        self._allowed_stairs = ALLOWED_STAIRS.get(disaster_type, ("concrete_stairs", "stairs"))

        self.in_safe_zone     = False
        self.safe_zone_target = None
        self.safe_zone_index  = None

        self.id        = unique_id
        self.unique_id = unique_id
        self.model     = model
        self.pos       = list(pos)
        self.speed     = speed if speed is not None else random.uniform(1.0, 2.0)

        self.target            = None
        self.exit_target_point = None
        self.path              = None
        self.path_index        = 0
        self.evacuated         = False
        self.radius            = 2

        self.goal_strength   = 1.2
        self.wall_repulsion  = 50
        self.agent_repulsion = 80
        self.vel = [0, 0]

        self.path_history = [tuple(pos)]
        self.spawn_source = None

        self._stuck_steps = 0
        self._last_pos    = tuple(pos)
        self._STUCK_LIMIT = 80
        self._stuck_retries = 0

        # Whether this agent is currently inside/very-close to its exit (skip repulsion)
        self._near_exit = False

    # ── Layer helpers ──────────────────────────────────────────────────────────

    def _get_layer_objects(self):
        bidx, fidx = self.building_index, self.current_layer
        if hasattr(self.model, "buildings_layers"):
            if bidx >= len(self.model.buildings_layers): return None
            if fidx >= len(self.model.buildings_layers[bidx]): return None
            return self.model.buildings_layers[bidx][fidx]
        elif hasattr(self.model, "layers") and fidx < len(self.model.layers):
            return self.model.layers[fidx]
        elif hasattr(self.model, "objects"):
            return self.model.objects
        return None

    def _nearest(self, candidates):
        if not candidates: return None
        ax, ay = self.pos
        return min(candidates, key=lambda o: math.hypot(o.x + o.w/2 - ax, o.y + o.h/2 - ay))

    # ── Target selection ───────────────────────────────────────────────────────

    def get_random_exit(self):
        layer_objects = self._get_layer_objects()
        if layer_objects is None:
            return None

        if self.disaster_type == "earthquake":
            safe_zones = [o for o in layer_objects if o.type == "safezone"]
            if safe_zones:
                best = self._nearest(safe_zones)
                self.exit_target_point = (
                    random.uniform(best.x, best.x + best.w),
                    random.uniform(best.y, best.y + best.h)
                )
                return best
            exits = [o for o in layer_objects if o.type == "exit"]
            if exits:
                best = self._nearest(exits)
                self.set_random_exit_point(best)
                return best
            stairs = [o for o in layer_objects if o.type in self._allowed_stairs]
            return self._nearest(stairs) if stairs else None

        exits = [o for o in layer_objects if o.type == "exit"]
        if exits:
            best = self._nearest(exits)
            self.set_random_exit_point(best)
            return best
        stairs = [o for o in layer_objects if o.type in self._allowed_stairs]
        return self._nearest(stairs) if stairs else None

    def set_random_exit_point(self, exit_obj):
        if exit_obj:
            margin = max(2, min(exit_obj.w, exit_obj.h) * 0.15)
            self.exit_target_point = (
                random.uniform(exit_obj.x + margin, exit_obj.x + exit_obj.w - margin),
                random.uniform(exit_obj.y + margin, exit_obj.y + exit_obj.h - margin)
            )

    # ── Step ──────────────────────────────────────────────────────────────────

    def step(self):
        if self.evacuated: return
        if self.stairs_cooldown > 0:
            self.stairs_cooldown -= 0.016
            return

        # ── EARTHQUAKE: safe zone ─────────────────────────────────────────────
        if self.disaster_type == "earthquake" and self.target and self.target.type == "safezone":
            inside = (self.target.x <= self.pos[0] <= self.target.x + self.target.w and
                      self.target.y <= self.pos[1] <= self.target.y + self.target.h)
            if inside:
                if not self.in_safe_zone:
                    self.in_safe_zone = True
                    if not hasattr(self.model, 'safe_zone_agents'):
                        self.model.safe_zone_agents = {}
                    zone_id = id(self.target)
                    if zone_id not in self.model.safe_zone_agents:
                        self.model.safe_zone_agents[zone_id] = []
                    self.model.safe_zone_agents[zone_id].append(self)
                    self.safe_zone_index = len(self.model.safe_zone_agents[zone_id]) - 1
                    total = len(self.model.safe_zone_agents[zone_id])
                    self.safe_zone_target = self._safe_zone_grid_position(
                        self.target, self.safe_zone_index, total
                    )
                if self.safe_zone_target:
                    tx, ty = self.safe_zone_target
                    dx, dy = tx - self.pos[0], ty - self.pos[1]
                    dist = math.hypot(dx, dy)
                    if dist > 2:
                        spd = 0.5
                        self.pos[0] += (dx/dist)*spd
                        self.pos[1] += (dy/dist)*spd
                        if dist > 0.5:
                            self.path_history.append(tuple(self.pos))
                    elif not self.evacuated:
                        self.evacuated      = True
                        self.time_evacuated = self.model.time
                return

        # ── Exit / stairs reach checks ────────────────────────────────────────
        if self.target and self.target.type == 'exit':
            if (self.target.x <= self.pos[0] <= self.target.x + self.target.w and
                    self.target.y <= self.pos[1] <= self.target.y + self.target.h):
                self.evacuated      = True
                self.time_evacuated = self.model.time
                if hasattr(self.target, 'id'):
                    self.exit_used = self.target.id
                return
        elif self.target and self.exit_target_point:
            tx, ty = self.exit_target_point
            if math.hypot(tx - self.pos[0], ty - self.pos[1]) < 12:
                self.evacuated      = True
                self.time_evacuated = self.model.time
                if hasattr(self.target, 'id'):
                    self.exit_used = self.target.id
                return

        if self.target and self.target.type in self._allowed_stairs:
            if (self.target.x <= self.pos[0] <= self.target.x + self.target.w and
                    self.target.y <= self.pos[1] <= self.target.y + self.target.h):
                self.stairs_used     = getattr(self.target, 'id', None)
                self.needs_transport = True
                return

        # ── Determine if near exit (suppress wall repulsion) ──────────────────
        self._near_exit = False
        if self.target and self.target.type == 'exit':
            dist_to_exit = math.hypot(
                self.pos[0] - (self.target.x + self.target.w/2),
                self.pos[1] - (self.target.y + self.target.h/2)
            )
            cell_size = getattr(self.model, 'cell_size', 10)
            if dist_to_exit < cell_size * 4:
                self._near_exit = True

        # ── Follow path ───────────────────────────────────────────────────────
        if self.path and len(self.path) > 0:
            self._follow_path()
        elif self.exit_target_point:
            self._move_toward(self.exit_target_point)

        # Stuck detection
        moved = math.hypot(self.pos[0]-self._last_pos[0], self.pos[1]-self._last_pos[1])
        if moved < 0.3:
            self._stuck_steps += 1
        else:
            self._stuck_steps = 0
        self._last_pos = tuple(self.pos)

        if self._stuck_steps >= self._STUCK_LIMIT:
            self._stuck_retries += 1
            if self._stuck_retries >= 3:
                print(f"⚠️  Agent {self.id} force-evacuated after {self._stuck_retries} retries")
                self.evacuated      = True
                self.time_evacuated = self.model.time
            else:
                self.target            = None
                self.path              = None
                self.path_index        = 0
                self.exit_target_point = None
                self.vel               = [0, 0]
            self._stuck_steps = 0

    def _safe_zone_grid_position(self, zone, index, total):
        cols = max(1, int(zone.w / 20))
        row  = index // cols
        col  = index  % cols
        x    = min(zone.x + 10 + col * 20, zone.x + zone.w - 10)
        y    = min(zone.y + 10 + row * 20, zone.y + zone.h - 10)
        return (x, y)

    # ── Navigation ─────────────────────────────────────────────────────────────

    def _follow_path(self):
        if not self.path or self.path_index >= len(self.path):
            return
        wx, wy = self.path[self.path_index]
        dist   = math.hypot(wx - self.pos[0], wy - self.pos[1])
        if dist < 8:
            self.path_index += 1
            if self.path_index >= len(self.path) and self.exit_target_point:
                self._move_toward(self.exit_target_point)
            return
        self._move_toward((wx, wy))

    def _move_toward(self, point):
        px, py   = point
        dx, dy   = px - self.pos[0], py - self.pos[1]
        dist     = math.hypot(dx, dy)
        if dist < 1:
            return

        # ── Goal force ────────────────────────────────────────────────────────
        desired_vx = (dx / dist) * self.speed * self.goal_strength
        desired_vy = (dy / dist) * self.speed * self.goal_strength

        # ── Wall repulsion force (skip when near exit) ────────────────────────
        # Reads nearby grid cells, pushes agent away from blocked ones.
        # Suppressed close to exits so agents don't get stuck in the doorway.
        wall_fx, wall_fy = 0.0, 0.0
        if not self._near_exit:
            grid      = getattr(self.model, 'grid', None)
            cell_size = getattr(self.model, 'cell_size', 10)
            if grid:
                height = len(grid)
                width  = len(grid[0]) if height else 0
                cx = int(self.pos[0] / cell_size)
                cy = int(self.pos[1] / cell_size)
                clearance = WALL_CLEARANCE_CELLS * cell_size  # world-px threshold

                for ry in range(-2, 3):
                    for rx in range(-2, 3):
                        wx2, wy2 = cx + rx, cy + ry
                        if not (0 <= wy2 < height and 0 <= wx2 < width):
                            continue
                        if grid[wy2][wx2] != 1:
                            continue
                        # Centre of wall cell in world-px
                        wcx = wx2 * cell_size + cell_size / 2
                        wcy = wy2 * cell_size + cell_size / 2
                        repel_dx = self.pos[0] - wcx
                        repel_dy = self.pos[1] - wcy
                        repel_d  = math.hypot(repel_dx, repel_dy)
                        if 0 < repel_d < clearance:
                            strength = self.wall_repulsion * (1.0 - repel_d / clearance) ** 2
                            wall_fx += (repel_dx / repel_d) * strength
                            wall_fy += (repel_dy / repel_d) * strength

        total_vx = desired_vx + wall_fx
        total_vy = desired_vy + wall_fy

        # Smooth into velocity
        a = 0.3
        self.vel[0] = a * total_vx + (1 - a) * self.vel[0]
        self.vel[1] = a * total_vy + (1 - a) * self.vel[1]

        # Cap speed so wall repulsion can't fling agents
        spd = math.hypot(self.vel[0], self.vel[1])
        max_spd = self.speed * 2.5
        if spd > max_spd:
            self.vel[0] = (self.vel[0] / spd) * max_spd
            self.vel[1] = (self.vel[1] / spd) * max_spd

        old_x, old_y = self.pos[0], self.pos[1]
        self.pos[0] += self.vel[0]
        self.pos[1] += self.vel[1]

        # ── Grid collision (hard stop on wall cells) ──────────────────────────
        grid = getattr(self.model, 'grid', None)
        if grid:
            cell_size = getattr(self.model, 'cell_size', 10)
            height    = len(grid)
            width     = len(grid[0]) if height else 0
            r         = self.radius

            def blocked(bx, by):
                gx2 = int(bx / cell_size)
                gy2 = int(by / cell_size)
                return (0 <= gy2 < height and 0 <= gx2 < width and grid[gy2][gx2] == 1)

            vel_len = math.hypot(self.vel[0], self.vel[1])
            if vel_len > 0:
                lead_x = self.pos[0] + (self.vel[0] / vel_len) * r
                lead_y = self.pos[1] + (self.vel[1] / vel_len) * r
            else:
                lead_x, lead_y = self.pos

            if blocked(lead_x, lead_y) or blocked(self.pos[0], self.pos[1]):
                self.pos[0] = old_x
                self.pos[1] = old_y
                # Try axis-sliding
                moved_x = moved_y = False
                test_x  = old_x + self.vel[0]
                if vel_len > 0:
                    lx2 = test_x + (self.vel[0] / vel_len) * r
                else:
                    lx2 = test_x
                if not (blocked(lx2, old_y) or blocked(test_x, old_y)):
                    self.pos[0] = test_x; moved_x = True

                test_y = old_y + self.vel[1]
                if vel_len > 0:
                    ly2 = old_y + (self.vel[1] / vel_len) * r
                else:
                    ly2 = test_y
                if not (blocked(old_x, test_y) or blocked(old_x, ly2)):
                    self.pos[1] = test_y; moved_y = True

                if not moved_x: self.vel[0] *= -0.05
                if not moved_y: self.vel[1] *= -0.05

        moved = math.hypot(self.pos[0] - old_x, self.pos[1] - old_y)
        self.distance_traveled += moved
        self.current_speed      = moved / 0.016 if moved > 0 else 0
        if moved > 0.5:
            self.path_history.append(tuple(self.pos))

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self):
        return {
            'id':                self.id,
            'x':                 self.pos[0],
            'y':                 self.pos[1],
            'evacuated':         self.evacuated,
            'disaster_type':     self.disaster_type,
            'in_safe_zone':      self.in_safe_zone,
            'distance_traveled': self.distance_traveled,
            'floor':             self.current_layer,
        }