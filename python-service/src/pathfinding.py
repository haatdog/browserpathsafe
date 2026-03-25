# pathfinding.py — wall-safe A* with clearance costs (no hard inflation)
import heapq
import math


# ── Clearance cost layer ───────────────────────────────────────────────────────

def build_clearance_costs(grid, radius=3, max_cost=1.5):
    """
    Soft wall-avoidance: cells near walls get extra A* cost so paths
    prefer the centre of corridors WITHOUT hard-blocking any cell.
    This way spawn zones and exits near walls are always reachable.

    radius   = how many cells out the gradient extends
    max_cost = extra cost added to a cell directly adjacent to a wall
    """
    height = len(grid)
    width  = len(grid[0]) if height else 0
    costs  = [[0.0] * width for _ in range(height)]

    for gy in range(height):
        for gx in range(width):
            if grid[gy][gx] == 1:
                continue
            min_dist = float(radius + 1)
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    ny, nx = gy + dy, gx + dx
                    if 0 <= ny < height and 0 <= nx < width and grid[ny][nx] == 1:
                        d = math.hypot(dx, dy)
                        if d < min_dist:
                            min_dist = d
            if min_dist <= radius:
                # Linear fall-off: dist 1 → max_cost, dist >= radius → 0
                costs[gy][gx] = max_cost * max(0.0, 1.0 - (min_dist - 1.0) / max(1, radius - 1))
    return costs


# ── Core A* ───────────────────────────────────────────────────────────────────

def _nearest_free(grid, pt):
    """Snap a point to the nearest non-wall cell (BFS outward)."""
    x, y   = pt
    height = len(grid)
    width  = len(grid[0]) if height else 0
    if 0 <= y < height and 0 <= x < width and grid[y][x] == 0:
        return pt
    for r in range(1, 8):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                nx2, ny2 = x + dx, y + dy
                if 0 <= ny2 < height and 0 <= nx2 < width and grid[ny2][nx2] == 0:
                    return (nx2, ny2)
    return pt


def astar(grid, start, goal, clearance_costs=None, max_nodes=40000):
    """
    A* on the ORIGINAL grid (no inflation).
    clearance_costs add a soft penalty near walls — cells near walls cost more
    so paths naturally drift toward the centre of corridors.
    Spawn zones and exits near walls are always reachable.
    Diagonal corner-cutting is strictly blocked.
    """
    def h(a, b):
        dx, dy = abs(a[0]-b[0]), abs(a[1]-b[1])
        return max(dx, dy) + (math.sqrt(2) - 1) * min(dx, dy)

    neighbors = [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]
    height = len(grid)
    width  = len(grid[0]) if height else 0

    if not (0 <= start[1] < height and 0 <= start[0] < width): return None
    if not (0 <= goal[1]  < height and 0 <= goal[0]  < width): return None

    # Snap start/goal to free cells if they landed inside a wall
    start = _nearest_free(grid, start)
    goal  = _nearest_free(grid, goal)

    open_set    = [(h(start, goal), 0.0, start, None)]
    came_from   = {}
    cost_so_far = {start: 0.0}
    expanded    = 0

    while open_set:
        _, cost, current, parent = heapq.heappop(open_set)
        if current == goal:
            path = [current]
            while parent is not None:
                path.append(parent)
                parent = came_from.get(parent)
            return path[::-1]
        if current in came_from:
            continue
        expanded += 1
        if expanded > max_nodes:
            break
        came_from[current] = parent
        cx, cy = current
        for dx, dy in neighbors:
            nx, ny = cx + dx, cy + dy
            if not (0 <= nx < width and 0 <= ny < height):
                continue
            if grid[ny][nx] == 1:
                continue
            # ── Strict diagonal: both orthogonal neighbours must be free ──────
            # Prevents cutting through corners of thin room walls.
            if dx != 0 and dy != 0:
                if grid[cy][nx] == 1 or grid[ny][cx] == 1:
                    continue
            move_cost = math.hypot(dx, dy)
            if clearance_costs:
                move_cost += clearance_costs[ny][nx]
            nc = cost + move_cost
            nb = (nx, ny)
            if nb not in cost_so_far or nc < cost_so_far[nb]:
                cost_so_far[nb] = nc
                heapq.heappush(open_set, (nc + h(nb, goal), nc, nb, current))
    return None


# ── Path utilities ─────────────────────────────────────────────────────────────

def smooth_path(path):
    """Remove only consecutive duplicate points."""
    if not path:
        return []
    out = [path[0]]
    for p in path[1:]:
        if p != out[-1]:
            out.append(p)
    return out


# ── Green-path graph ───────────────────────────────────────────────────────────

def build_path_graph(path_cells):
    graph = {c: [] for c in path_cells}
    for (px, py) in path_cells:
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]:
            nb = (px + dx, py + dy)
            if nb in path_cells:
                graph[(px, py)].append((nb, math.hypot(dx, dy)))
    return graph


def astar_on_graph(graph, start, goal):
    """A* restricted to green path graph (stays on painted corridor tiles)."""
    def h(a, b):
        return math.hypot(a[0]-b[0], a[1]-b[1])
    if start not in graph or goal not in graph:
        return None
    open_set    = [(h(start, goal), 0.0, start, None)]
    came_from   = {}
    cost_so_far = {start: 0.0}
    while open_set:
        _, cost, current, parent = heapq.heappop(open_set)
        if current == goal:
            path = [current]
            while parent is not None:
                path.append(parent)
                parent = came_from.get(parent)
            return path[::-1]
        if current in came_from:
            continue
        came_from[current] = parent
        for nb, dist in graph.get(current, []):
            nc = cost + dist
            if nb not in cost_so_far or nc < cost_so_far[nb]:
                cost_so_far[nb] = nc
                heapq.heappush(open_set, (nc + h(nb, goal), nc, nb, current))
    return None


def get_path_openings(path_cells):
    if not path_cells:
        return []
    openings = []
    for (px, py) in path_cells:
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            if (px+dx, py+dy) not in path_cells:
                openings.append((px, py))
                break
    return openings if openings else list(path_cells)


# ── Main routing ───────────────────────────────────────────────────────────────

def route_with_green_path(grid, start, goal, path_cells, path_graph):
    """
    Three-phase routing:

    Phase 1: A* on original grid (with clearance costs) — start → green entry
             Original grid used so spawn zones near walls always have a path.
    Phase 2: A* on green graph only — entry → green exit
             Stays fully on painted corridor tiles.
    Phase 3: A* on original grid (with clearance costs) — green exit → goal
             Original grid used so exits near walls are always reachable.

    Clearance costs are SOFT — they add cost near walls without ever blocking a
    cell, so all spawn zones and exits remain reachable regardless of placement.
    """
    # Build clearance costs once (shared by Phase 1 and Phase 3)
    ccosts = build_clearance_costs(grid, radius=3, max_cost=1.5)

    def _astar(s, e):
        """A* on original grid with clearance costs. Always finds a path if one exists."""
        path = astar(grid, s, e, clearance_costs=ccosts)
        if path is None:
            # Last-resort: no clearance costs — guarantees path if grid is connected
            path = astar(grid, s, e)
        return path or [s, e]

    if not path_cells or not path_graph:
        return smooth_path(_astar(start, goal))

    # Snap entry/exit to nearest green cell
    entry = min(path_cells, key=lambda p: math.hypot(p[0]-start[0], p[1]-start[1]))
    exit_ = min(path_cells, key=lambda p: math.hypot(p[0]-goal[0],  p[1]-goal[1]))

    # Phase 1: start → entry
    seg1 = [start] if math.hypot(entry[0]-start[0], entry[1]-start[1]) < 1 else _astar(start, entry)

    # Phase 2: entry → exit along green graph
    if entry == exit_:
        seg2 = [entry]
    else:
        seg2 = astar_on_graph(path_graph, entry, exit_) or [entry, exit_]

    # Phase 3: exit → goal
    seg3 = [exit_] if math.hypot(exit_[0]-goal[0], exit_[1]-goal[1]) < 1 else _astar(exit_, goal)

    # Join — drop duplicated boundary points
    result = list(seg1)
    for seg in [seg2, seg3]:
        skip = 1 if (result and seg and seg[0] == result[-1]) else 0
        result.extend(seg[skip:])

    return smooth_path(result)


def route_via_path(grid, start, goal, path_cells, cost_grid=None, openings=None):
    graph = build_path_graph(path_cells) if path_cells else {}
    return route_with_green_path(grid, start, goal, path_cells, graph)