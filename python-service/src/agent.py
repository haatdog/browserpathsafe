# agent.py - DISASTER-AWARE AGENT
"""
✅ Full agent intelligence (pathfinding, social forces, collision)
✅ Disaster-aware behavior (fire, earthquake, bomb)
✅ Two stair types: concrete_stairs (all drills), fire_ladder (fire only)
✅ Path tracking for animation
"""

import random, math

# Stair types each disaster allows agents to use
ALLOWED_STAIRS = {
    "fire":       ("concrete_stairs", "stairs", "fire_ladder"),
    "earthquake": ("concrete_stairs", "stairs"),   # fire_ladder skipped
    "bomb":       ("concrete_stairs", "stairs"),
}


class PersonAgent:
    def __init__(self, unique_id, model, pos, speed=None, disaster_type="fire"):
        # Data collection
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

        # Disaster
        self.disaster_type = disaster_type
        self._allowed_stairs = ALLOWED_STAIRS.get(disaster_type, ("concrete_stairs", "stairs"))

        # Safe zone (earthquake only)
        self.in_safe_zone    = False
        self.safe_zone_target = None
        self.safe_zone_index  = None

        # Identity
        self.id        = unique_id
        self.unique_id = unique_id
        self.model     = model
        self.pos       = list(pos)
        self.speed     = speed if speed is not None else random.uniform(1.0, 2.0)

        # Navigation
        self.target           = None
        self.exit_target_point = None
        self.path             = None
        self.path_index       = 0
        self.evacuated        = False
        self.radius           = 2   # smaller radius = cleaner doorway passage

        # Social-force parameters
        self.goal_strength  = 1.2
        self.wall_repulsion = 50
        self.agent_repulsion = 80
        self.vel = [0, 0]

        # Path history for animation
        self.path_history = [tuple(pos)]
        self.spawn_source = None

        # Stuck detection
        self._stuck_steps   = 0
        self._last_pos      = tuple(pos)
        self._STUCK_LIMIT   = 80   # steps before re-pathing

    # ── Target selection ──────────────────────────────────────────────────────

    def _get_layer_objects(self):
        """Return the list of objects on this agent's current floor."""
        bidx = self.building_index
        fidx = self.current_layer

        if hasattr(self.model, "buildings_layers"):
            if bidx >= len(self.model.buildings_layers):
                return None
            if fidx >= len(self.model.buildings_layers[bidx]):
                return None
            return self.model.buildings_layers[bidx][fidx]
        elif hasattr(self.model, "layers") and fidx < len(self.model.layers):
            return self.model.layers[fidx]
        elif hasattr(self.model, "objects"):
            return self.model.objects
        return None

    def _nearest(self, candidates):
        """Return the candidate closest to this agent's position."""
        if not candidates:
            return None
        ax, ay = self.pos
        return min(candidates, key=lambda o: math.hypot(o.x + o.w / 2 - ax, o.y + o.h / 2 - ay))

    def get_random_exit(self):
        """
        Disaster-aware target selection with hierarchy:

        EARTHQUAKE hierarchy (in order of preference):
          1. Safe zone  — go there and stay
          2. Exit       — evacuate through it
          3. Stairs     — use if nothing else exists (agent disappears after)

        FIRE / BOMB hierarchy:
          1. Exit       — nearest exit
          2. Stairs     — if no exit on this floor
        """
        layer_objects = self._get_layer_objects()
        if layer_objects is None:
            return None

        # ── EARTHQUAKE ────────────────────────────────────────────────────────
        if self.disaster_type == "earthquake":
            # 1. Safe zones (highest priority)
            safe_zones = [o for o in layer_objects if o.type == "safezone"]
            if safe_zones:
                best = self._nearest(safe_zones)
                self.exit_target_point = (
                    random.uniform(best.x, best.x + best.w),
                    random.uniform(best.y, best.y + best.h)
                )
                return best

            # 2. Exits (second priority)
            exits = [o for o in layer_objects if o.type == "exit"]
            if exits:
                best = self._nearest(exits)
                self.set_random_exit_point(best)
                return best

            # 3. Stairs only as last resort — agent will disappear after using them
            stairs = [o for o in layer_objects if o.type in self._allowed_stairs]
            if stairs:
                return self._nearest(stairs)

            return None  # nowhere to go

        # ── FIRE / BOMB ───────────────────────────────────────────────────────
        exits = [o for o in layer_objects if o.type == "exit"]
        if exits:
            best = self._nearest(exits)
            self.set_random_exit_point(best)
            return best

        # Fall back to stairs if no exit on this floor
        stairs = [o for o in layer_objects if o.type in self._allowed_stairs]
        if stairs:
            return self._nearest(stairs)

        return None

    def set_random_exit_point(self, exit_obj):
        """Pick a random point inside the exit rectangle with a small edge margin."""
        if exit_obj:
            margin = max(2, min(exit_obj.w, exit_obj.h) * 0.15)
            self.exit_target_point = (
                random.uniform(exit_obj.x + margin, exit_obj.x + exit_obj.w - margin),
                random.uniform(exit_obj.y + margin, exit_obj.y + exit_obj.h - margin)
            )

    # ── Step ──────────────────────────────────────────────────────────────────

    def step(self):
        if self.evacuated:
            return

        if self.stairs_cooldown > 0:
            self.stairs_cooldown -= 0.016
            return

        # ── EARTHQUAKE: orderly safe-zone positioning ─────────────────────────
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
                    print(f"🛡️ Agent {self.id} entered safe zone ({self.safe_zone_index + 1}/{total})")

                if self.safe_zone_target:
                    tx, ty = self.safe_zone_target
                    dx   = tx - self.pos[0]
                    dy   = ty - self.pos[1]
                    dist = math.hypot(dx, dy)

                    if dist > 2:
                        spd = 0.5
                        self.pos[0] += (dx / dist) * spd
                        self.pos[1] += (dy / dist) * spd
                        if dist > 0.5:
                            self.path_history.append(tuple(self.pos))
                    elif not self.evacuated:
                        self.evacuated     = True
                        self.time_evacuated = self.model.time
                        print(f"✅ Agent {self.id} settled in safe zone")
                return

        # ── FIRE / BOMB: reach exit and disappear ────────────────────────────
        if self.target and self.target.type == 'exit':
            # Evacuate as soon as agent enters the exit rectangle — no precise point needed
            if (self.target.x <= self.pos[0] <= self.target.x + self.target.w and
                    self.target.y <= self.pos[1] <= self.target.y + self.target.h):
                self.evacuated      = True
                self.time_evacuated = self.model.time
                if hasattr(self.target, 'id'):
                    self.exit_used = self.target.id
                return
        elif self.target and self.exit_target_point:
            # Fallback for non-exit targets with a specific point
            tx, ty = self.exit_target_point
            if math.hypot(tx - self.pos[0], ty - self.pos[1]) < 12:
                self.evacuated      = True
                self.time_evacuated = self.model.time
                if hasattr(self.target, 'id'):
                    self.exit_used = self.target.id
                return

        # Check if agent reached a staircase (needs floor transport)
        if self.target and self.target.type in self._allowed_stairs:
            if (self.target.x <= self.pos[0] <= self.target.x + self.target.w and
                    self.target.y <= self.pos[1] <= self.target.y + self.target.h):
                self.stairs_used     = getattr(self.target, 'id', None)
                self.needs_transport = True
                return

        # Earthquake agents with no safe zone / exit target: once they reach stairs
        # they disappear (transport removes them from the active list)

        # Follow A* path or move directly
        if self.path and len(self.path) > 0:
            self._follow_path()
        elif self.exit_target_point:
            self._move_toward(self.exit_target_point)

        # Stuck detection — if agent barely moved, re-request path
        moved = math.hypot(self.pos[0] - self._last_pos[0], self.pos[1] - self._last_pos[1])
        if moved < 0.3:
            self._stuck_steps += 1
        else:
            self._stuck_steps = 0
        self._last_pos = tuple(self.pos)

        if self._stuck_steps >= self._STUCK_LIMIT:
            self._stuck_retries = getattr(self, '_stuck_retries', 0) + 1
            if self._stuck_retries >= 3:
                # No reachable exit — force-evacuate so simulation can finish
                print(f"⚠️  Agent {self.id} force-evacuated after {self._stuck_retries} stuck retries")
                self.evacuated      = True
                self.time_evacuated = self.model.time
            else:
                # Re-pick target and recalculate path
                self.target            = None
                self.path              = None
                self.path_index        = 0
                self.exit_target_point = None
                self.vel               = [0, 0]
            self._stuck_steps = 0

    def _safe_zone_grid_position(self, zone, index, total):
        """Assign a grid slot inside the safe zone for orderly queuing."""
        cols = max(1, int(zone.w / 20))
        row  = index // cols
        col  = index  % cols
        x    = zone.x + 10 + col * 20
        y    = zone.y + 10 + row * 20
        x    = min(x, zone.x + zone.w - 10)
        y    = min(y, zone.y + zone.h - 10)
        return (x, y)

    # ── Navigation ────────────────────────────────────────────────────────────

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
        px, py = point
        dx     = px - self.pos[0]
        dy     = py - self.pos[1]
        dist   = math.hypot(dx, dy)
        if dist < 1:
            return

        dx /= dist
        dy /= dist

        desired_vx = dx * self.speed * self.goal_strength
        desired_vy = dy * self.speed * self.goal_strength

        a = 0.3
        self.vel[0] = a * desired_vx + (1 - a) * self.vel[0]
        self.vel[1] = a * desired_vy + (1 - a) * self.vel[1]

        old_x, old_y = self.pos[0], self.pos[1]
        self.pos[0] += self.vel[0]
        self.pos[1] += self.vel[1]

        # Wall collision (grid-based) — checks leading edge (centre + radius)
        grid = getattr(self.model, 'grid', None)
        if grid:
            cell_size = getattr(self.model, 'cell_size', 10)
            r = self.radius  # agent radius in world-px

            def blocked(px, py):
                gx_ = int(px / cell_size)
                gy_ = int(py / cell_size)
                return (0 <= gy_ < len(grid) and 0 <= gx_ < len(grid[0])
                        and grid[gy_][gx_] == 1)

            # Check centre + leading edge in velocity direction
            vel_len = math.hypot(self.vel[0], self.vel[1])
            if vel_len > 0:
                lead_x = self.pos[0] + (self.vel[0] / vel_len) * r
                lead_y = self.pos[1] + (self.vel[1] / vel_len) * r
            else:
                lead_x, lead_y = self.pos[0], self.pos[1]

            if blocked(lead_x, lead_y) or blocked(self.pos[0], self.pos[1]):
                self.pos[0] = old_x
                self.pos[1] = old_y
                moved_x = False
                moved_y = False
                # Try sliding X only
                test_x = old_x + self.vel[0]
                lead_x2 = test_x + (self.vel[0] / vel_len * r if vel_len > 0 else 0)
                if not (blocked(lead_x2, old_y) or blocked(test_x, old_y)):
                    self.pos[0] = test_x
                    moved_x = True
                # Try sliding Y only
                test_y = old_y + self.vel[1]
                lead_y2 = old_y + (self.vel[1] / vel_len * r if vel_len > 0 else 0)
                if not (blocked(old_x, test_y) or blocked(old_x, lead_y2)):
                    self.pos[1] = test_y
                    moved_y = True
                # Fully blocked — kill velocity so agent doesn't keep hammering the wall
                if not moved_x:
                    self.vel[0] *= -0.1
                if not moved_y:
                    self.vel[1] *= -0.1

        moved = math.hypot(self.pos[0] - old_x, self.pos[1] - old_y)
        self.distance_traveled += moved
        self.current_speed      = moved / 0.016 if moved > 0 else 0

        if moved > 0.5:
            self.path_history.append(tuple(self.pos))

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self):
        return {
            'id':               self.id,
            'x':                self.pos[0],
            'y':                self.pos[1],
            'evacuated':        self.evacuated,
            'disaster_type':    self.disaster_type,
            'in_safe_zone':     self.in_safe_zone,
            'distance_traveled': self.distance_traveled,
            'floor':            self.current_layer,
        }