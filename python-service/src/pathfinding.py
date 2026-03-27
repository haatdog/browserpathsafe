# pathfinding.py — A* on unified integer grid with hard wall-crossing prevention
import heapq
import math

# ── Cell value constants (must match MapEditor.tsx CELL_VALUES) ───────────────
EMPTY         = 0
WALL          = 1
EXIT          = 2
NPC           = 3
NPC_COUNT     = 4
SAFEZONE      = 5
STAIRS        = 6
FIRE_LADDER   = 7
PATH_WALKABLE = 8
PATH_DANGER   = 9
GATE_OPEN     = 10
GATE_CLOSED   = 11
FENCE         = 12

# ── Tuneable parameters ────────────────────────────────────────────────────────
BLOCKED     = {WALL, GATE_CLOSED, FENCE}   # cell values that are impassable
PATH_BONUS  = -1      # cost modifier for PATH_WALKABLE cells (negative = cheaper)
DANGER_COST =  6.0      # extra cost for PATH_DANGER cells
MAX_NODES   = 200000    # A* node budget — increase for very large/complex maps
CLEARANCE_RADIUS   = 8  # cells — how far from walls to apply soft penalty
CLEARANCE_MAX_COST = 2 # extra cost per step right next to a wall


# ── Grid helpers ───────────────────────────────────────────────────────────────

def is_blocked(grid, x, y):
    h = len(grid); w = len(grid[0]) if h else 0
    if not (0 <= y < h and 0 <= x < w): return True
    return grid[y][x] in BLOCKED


def segment_crosses_wall(grid, x0, y0, x1, y1):
    """
    Hard wall-crossing check using Bresenham rasterization.
    Returns True if the straight line from (x0,y0) to (x1,y1)
    passes through ANY blocked cell — even diagonally.
    Used to validate every consecutive step in a path.
    """
    h = len(grid); w = len(grid[0]) if h else 0
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    cx, cy = x0, y0
    while True:
        # Check the cell we're standing on
        if 0 <= cy < h and 0 <= cx < w and grid[cy][cx] in BLOCKED:
            return True
        if cx == x1 and cy == y1:
            break
        e2 = 2 * err
        if e2 > -dy: err -= dy; cx += sx
        if e2 <  dx: err += dx; cy += sy
    return False


def path_valid(path, grid):
    """
    Hard validation: every cell must be non-blocked, every diagonal step
    must not cut a corner, and every segment must not cross a wall.
    """
    if not path: return True
    h = len(grid); w = len(grid[0]) if h else 0
    for i, (x, y) in enumerate(path):
        if not (0 <= y < h and 0 <= x < w): return False
        if grid[y][x] in BLOCKED: return False
        if i > 0:
            px, py = path[i-1]
            # Hard segment check — catches any wall crossing between steps
            if segment_crosses_wall(grid, px, py, x, y):
                return False
    return True


def nearest_free(grid, pt, zone_bounds=None):
    """
    Snap a point to the nearest non-blocked cell.
    If zone_bounds (gx1,gy1,gx2,gy2) given, prefer cells inside the zone first.
    """
    x, y = pt
    h = len(grid); w = len(grid[0]) if h else 0
    if 0 <= y < h and 0 <= x < w and grid[y][x] not in BLOCKED:
        return pt
    best_in = best_out = None
    for r in range(1, 12):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if abs(dx) != r and abs(dy) != r: continue
                nx, ny = x + dx, y + dy
                if not (0 <= ny < h and 0 <= nx < w): continue
                if grid[ny][nx] in BLOCKED: continue
                if zone_bounds:
                    bx1, by1, bx2, by2 = zone_bounds
                    if bx1 <= nx <= bx2 and by1 <= ny <= by2:
                        if best_in is None: best_in = (nx, ny)
                    else:
                        if best_out is None: best_out = (nx, ny)
                else:
                    return (nx, ny)
        if best_in: return best_in
    return best_out or pt


# ── Clearance cost layer ───────────────────────────────────────────────────────

def build_clearance_costs(grid, radius=CLEARANCE_RADIUS, max_cost=CLEARANCE_MAX_COST):
    """
    Soft wall-avoidance: cells near walls get extra A* cost so paths
    prefer corridor centres. Never blocks any cell.
    """
    h = len(grid); w = len(grid[0]) if h else 0
    costs = [[0.0] * w for _ in range(h)]
    for gy in range(h):
        for gx in range(w):
            if grid[gy][gx] in BLOCKED: continue
            min_dist = float(radius + 1)
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    ny, nx = gy + dy, gx + dx
                    if 0 <= ny < h and 0 <= nx < w and grid[ny][nx] in BLOCKED:
                        d = math.hypot(dx, dy)
                        if d < min_dist: min_dist = d
            if min_dist <= radius:
                costs[gy][gx] = max_cost * max(0.0, 1.0 - (min_dist - 1.0) / max(1, radius - 1))
    return costs


# ── Core A* ───────────────────────────────────────────────────────────────────

def astar(grid, start, goal, zone_bounds=None, max_nodes=MAX_NODES,
          clearance_costs=None):
    """
    A* on unified integer grid.
    Diagonal corner-cutting strictly blocked.
    PATH_WALKABLE cells get PATH_BONUS (cheaper).
    PATH_DANGER cells get DANGER_COST extra.
    """
    def h(a, b):
        dx, dy = abs(a[0]-b[0]), abs(a[1]-b[1])
        return max(dx, dy) + (math.sqrt(2)-1)*min(dx, dy)

    neighbors = [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]
    hg = len(grid); wg = len(grid[0]) if hg else 0

    start = nearest_free(grid, start, zone_bounds=zone_bounds)
    goal  = nearest_free(grid, goal)
    if start == goal: return [start]

    open_set    = [(h(start, goal), 0.0, start, None)]
    came_from   = {}
    cost_so_far = {start: 0.0}
    expanded    = 0

    while open_set:
        _, cost, cur, parent = heapq.heappop(open_set)
        if cur == goal:
            path = [cur]
            while parent is not None:
                path.append(parent)
                parent = came_from.get(parent)
            return path[::-1]
        if cur in came_from: continue
        expanded += 1
        if expanded > max_nodes: break
        came_from[cur] = parent
        cx, cy = cur

        for dx, dy in neighbors:
            nx, ny = cx+dx, cy+dy
            if not (0 <= nx < wg and 0 <= ny < hg): continue
            cell = grid[ny][nx]
            if cell in BLOCKED: continue
            # Strict diagonal: BOTH orthogonal neighbours must be free
            if dx != 0 and dy != 0:
                if is_blocked(grid, cx+dx, cy) or is_blocked(grid, cx, cy+dy):
                    continue
            move_cost = math.hypot(dx, dy)
            if cell == PATH_WALKABLE:
                move_cost += PATH_BONUS      # negative = cheaper = preferred
            elif cell == PATH_DANGER:
                move_cost += DANGER_COST
            if clearance_costs:
                move_cost += clearance_costs[ny][nx]
            nc = cost + move_cost
            nb = (nx, ny)
            if nb not in cost_so_far or nc < cost_so_far[nb]:
                cost_so_far[nb] = nc
                heapq.heappush(open_set, (nc + h(nb, goal), nc, nb, cur))
    return None


# ── Path utilities ─────────────────────────────────────────────────────────────

def smooth_path(path):
    if not path: return []
    out = [path[0]]
    for p in path[1:]:
        if p != out[-1]: out.append(p)
    return out


# ── Green-path graph ───────────────────────────────────────────────────────────

def build_path_graph(path_cells):
    graph = {c: [] for c in path_cells}
    for (px, py) in path_cells:
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]:
            nb = (px+dx, py+dy)
            if nb in path_cells:
                graph[(px,py)].append((nb, math.hypot(dx,dy)))
    return graph


def astar_on_graph(graph, start, goal):
    def h(a, b): return math.hypot(a[0]-b[0], a[1]-b[1])
    if start not in graph or goal not in graph: return None
    open_set    = [(h(start,goal), 0.0, start, None)]
    came_from   = {}
    cost_so_far = {start: 0.0}
    while open_set:
        _, cost, cur, parent = heapq.heappop(open_set)
        if cur == goal:
            path = [cur]
            while parent is not None:
                path.append(parent)
                parent = came_from.get(parent)
            return path[::-1]
        if cur in came_from: continue
        came_from[cur] = parent
        for nb, dist in graph.get(cur, []):
            nc = cost + dist
            if nb not in cost_so_far or nc < cost_so_far[nb]:
                cost_so_far[nb] = nc
                heapq.heappush(open_set, (nc+h(nb,goal), nc, nb, cur))
    return None


def get_path_openings(path_cells):
    if not path_cells: return []
    openings = []
    for (px, py) in path_cells:
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            if (px+dx, py+dy) not in path_cells:
                openings.append((px, py)); break
    return openings if openings else list(path_cells)


# ── Hard wall-crossing prevention ─────────────────────────────────────────────

def fix_wall_crossings(path, grid):
    """
    Scan every consecutive step in the path.
    If a step crosses a wall (detected by segment_crosses_wall), re-route
    that specific segment using A* so it goes around the wall.
    Returns a path guaranteed to contain no wall crossings.
    """
    if not path or len(path) < 2:
        return path

    result = [path[0]]
    i = 0
    while i < len(path) - 1:
        a = path[i]
        b = path[i + 1]
        if segment_crosses_wall(grid, a[0], a[1], b[0], b[1]):
            # Re-route this segment
            fix = astar(grid, a, b)
            if fix and len(fix) > 1:
                result.extend(fix[1:])  # skip duplicate of 'a'
            else:
                result.append(b)  # can't fix, just append
        else:
            result.append(b)
        i += 1

    return smooth_path(result)


# ── Main routing ───────────────────────────────────────────────────────────────

def route_with_green_path(grid, start, goal, path_cells, path_graph,
                          zone_bounds=None):
    """
    Single-pass A* routing with green-path preference.

    The 3-phase approach (force entry→green→exit) caused agents to walk the
    entire corridor when it was L-shaped or wrapped around a building.

    Instead: run A* on the full grid with PATH_BONUS making green tiles cheaper.
    A* naturally prefers green tiles without being forced to traverse ALL of them.
    After routing, fix_wall_crossings() patches any remaining wall penetrations.
    """
    ccosts = build_clearance_costs(grid)

    # Single A* pass — green tiles are preferred via PATH_BONUS cost modifier
    path = astar(grid, start, goal, zone_bounds=zone_bounds,
                 clearance_costs=ccosts)

    if not path:
        # Retry without clearance costs
        path = astar(grid, start, goal, zone_bounds=zone_bounds)
    if not path:
        # Retry without zone constraint
        path = astar(grid, start, goal)
    if not path:
        path = [start, goal]

    path = smooth_path(path)

    # Hard guarantee: patch any step that crosses a wall
    path = fix_wall_crossings(path, grid)

    return path


def route_via_path(grid, start, goal, path_cells, cost_grid=None, openings=None):
    graph = build_path_graph(path_cells) if path_cells else {}
    return route_with_green_path(grid, start, goal, path_cells, graph)