# pathfinding.py
import heapq
import math

def astar(grid, start, goal):
    """
    A* pathfinding on a 2D grid with diagonal movement.

    Corner-cutting rule: ONLY blocks DIAGONAL moves through walls.
    Cardinal (straight) moves are always allowed even when adjacent cells
    are walls — this is what lets agents pass through a 1-cell doorway.
    """

    def h(a, b):
        return math.hypot(a[0] - b[0], a[1] - b[1])

    neighbors = [
        (1, 0), (-1, 0), (0, 1), (0, -1),   # Cardinal — always allowed
        (1, 1), (-1, -1), (1, -1), (-1, 1)  # Diagonals — blocked by adjacent walls
    ]

    open_set = [(h(start, goal), 0, start, None)]
    came_from = {}
    cost_so_far = {start: 0}

    height = len(grid)
    width  = len(grid[0]) if height > 0 else 0

    while open_set:
        _, cost, current, parent = heapq.heappop(open_set)

        if current == goal:
            path = [current]
            while parent:
                path.append(parent)
                parent = came_from.get(parent)
            return path[::-1]

        came_from[current] = parent
        x, y = current

        for dx, dy in neighbors:
            nx, ny = x + dx, y + dy

            if not (0 <= nx < width and 0 <= ny < height):
                continue

            if grid[ny][nx] == 1:
                continue

            # Only block DIAGONAL moves when a shared adjacent cell is a wall.
            # Cardinal moves (dx=0 or dy=0) are NEVER blocked by this rule —
            # that's what allows agents through a 1-cell-wide doorway.
            if dx != 0 and dy != 0:
                if grid[y][nx] == 1 or grid[ny][x] == 1:
                    continue

            step_cost = math.hypot(dx, dy)
            new_cost  = cost + step_cost

            if (nx, ny) not in cost_so_far or new_cost < cost_so_far[(nx, ny)]:
                cost_so_far[(nx, ny)] = new_cost
                priority = new_cost + h((nx, ny), goal)
                heapq.heappush(open_set, (priority, new_cost, (nx, ny), current))

    return None  # No path found


def smooth_path(path):
    """Remove redundant intermediate nodes where direction doesn't change."""
    if not path:
        return []
    smooth = [path[0]]
    for i in range(1, len(path) - 1):
        prev, curr, nxt = path[i-1], path[i], path[i+1]
        if (curr[0]-prev[0], curr[1]-prev[1]) != (nxt[0]-curr[0], nxt[1]-curr[1]):
            smooth.append(curr)
    smooth.append(path[-1])
    return smooth