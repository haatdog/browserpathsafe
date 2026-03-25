# pathfinding.py — simple A* only
import heapq
import math


def astar(grid, start, goal, cost_grid=None, max_nodes=20000):
    def h(a, b):
        return math.hypot(a[0]-b[0], a[1]-b[1])

    neighbors = [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]
    height = len(grid)
    width  = len(grid[0]) if height else 0
    open_set    = [(h(start, goal), 0.0, start, None)]
    came_from   = {}
    cost_so_far = {start: 0.0}
    expanded    = 0

    while open_set:
        _, cost, current, parent = heapq.heappop(open_set)
        if current == goal:
            path = [current]
            while parent:
                path.append(parent)
                parent = came_from.get(parent)
            return path[::-1]
        expanded += 1
        if expanded > max_nodes:
            break
        came_from[current] = parent
        cx, cy = current
        for dx, dy in neighbors:
            nx, ny = cx+dx, cy+dy
            if not (0 <= nx < width and 0 <= ny < height): continue
            if grid[ny][nx] == 1: continue
            if dx and dy:
                if grid[cy][nx] == 1 or grid[ny][cx] == 1: continue
            nc = cost + math.hypot(dx, dy)
            if (nx,ny) not in cost_so_far or nc < cost_so_far[(nx,ny)]:
                cost_so_far[(nx,ny)] = nc
                heapq.heappush(open_set, (nc+h((nx,ny),goal), nc, (nx,ny), current))
    return None


def smooth_path(path, grid=None):
    """Remove duplicate consecutive points only. Keep all waypoints for wall safety."""
    if not path:
        return []
    out = [path[0]]
    for p in path[1:]:
        if p != out[-1]:
            out.append(p)
    return out


def build_path_graph(path_cells):
    graph = {c: [] for c in path_cells}
    for (px, py) in path_cells:
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]:
            nb = (px+dx, py+dy)
            if nb in path_cells:
                graph[(px,py)].append((nb, math.hypot(dx,dy)))
    return graph


def astar_on_graph(graph, start, goal):
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
            while parent:
                path.append(parent)
                parent = came_from.get(parent)
            return path[::-1]
        came_from[current] = parent
        for nb, dist in graph.get(current, []):
            nc = cost + dist
            if nb not in cost_so_far or nc < cost_so_far[nb]:
                cost_so_far[nb] = nc
                heapq.heappush(open_set, (nc+h(nb,goal), nc, nb, current))
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


def route_with_green_path(grid, start, goal, path_cells, path_graph):
    """
    Phase 1: A* start  → nearest green cell to START  (entry)
    Phase 2: A* on green graph entry → nearest green cell to GOAL (exit)
             This traverses the FULL painted corridor between them.
    Phase 3: A* exit   → goal
    """
    if not path_cells or not path_graph:
        return smooth_path(astar(grid, start, goal) or [start, goal])

    # entry = nearest green cell to START
    entry = min(path_cells, key=lambda p: math.hypot(p[0]-start[0], p[1]-start[1]))
    # exit  = nearest green cell to GOAL
    exit_ = min(path_cells, key=lambda p: math.hypot(p[0]-goal[0],  p[1]-goal[1]))

    # Phase 1: start → entry (full grid, wall-safe)
    seg1 = astar(grid, start, entry) if math.hypot(entry[0]-start[0], entry[1]-start[1]) >= 1 else [start]
    if not seg1: seg1 = [start, entry]

    # Phase 2: entry → exit along green graph only (stays on painted tiles)
    seg2 = astar_on_graph(path_graph, entry, exit_) if entry != exit_ else [entry]
    if not seg2: seg2 = [entry, exit_]

    # Phase 3: exit → goal (full grid, wall-safe)
    seg3 = astar(grid, exit_, goal) if math.hypot(exit_[0]-goal[0], exit_[1]-goal[1]) >= 1 else [exit_]
    if not seg3: seg3 = [exit_, goal]

    # Join preserving all waypoints (no cross-boundary smoothing)
    result = list(seg1)
    for seg in [seg2, seg3]:
        start_i = 1 if (result and seg and seg[0] == result[-1]) else 0
        result.extend(seg[start_i:])

    return smooth_path(result)


def route_via_path(grid, start, goal, path_cells, cost_grid=None, openings=None):
    graph = build_path_graph(path_cells) if path_cells else {}
    return route_with_green_path(grid, start, goal, path_cells, graph)