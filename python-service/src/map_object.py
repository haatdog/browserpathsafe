"""
Map object models for disaster simulation
✅ All object types from the React map editor are supported
✅ Line objects (room walls) carry x1/y1/x2/y2
✅ concrete_stairs / fire_ladder differentiated
✅ Gates, Fences, Safe zones, NPC zones
"""

import math
import json
from typing import List, Tuple, Dict, Optional, Any


def line_intersection(p1, p2, p3, p4):
    x1, y1 = p1; x2, y2 = p2; x3, y3 = p3; x4, y4 = p4
    denom = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4)
    if denom == 0:
        return None
    px = ((x1*y2-y1*x2)*(x3-x4) - (x1-x2)*(x3*y4-y3*x4)) / denom
    py = ((x1*y2-y1*x2)*(y3-y4) - (y1-y2)*(x3*y4-y3*x4)) / denom
    if (min(x1,x2) <= px <= max(x1,x2) and min(y1,y2) <= py <= max(y1,y2) and
            min(x3,x4) <= px <= max(x3,x4) and min(y3,y4) <= py <= max(y3,y4)):
        return (px, py)
    return None


class MapObject:
    """Base class for all map objects."""

    def __init__(self, x, y, w, h, type_):
        self.x = float(x)
        self.y = float(y)
        self.w = float(w)
        self.h = float(h)
        self.type = type_

    def get_bounds(self):
        return (self.x, self.y, self.w, self.h)

    def contains_point(self, px, py):
        return self.x <= px <= self.x + self.w and self.y <= py <= self.y + self.h

    def get_center(self):
        return (self.x + self.w / 2, self.y + self.h / 2)

    def intersects_line(self, p1, p2):
        edges = [
            ((self.x, self.y), (self.x+self.w, self.y)),
            ((self.x+self.w, self.y), (self.x+self.w, self.y+self.h)),
            ((self.x+self.w, self.y+self.h), (self.x, self.y+self.h)),
            ((self.x, self.y+self.h), (self.x, self.y)),
        ]
        return any(line_intersection(p1, p2, e[0], e[1]) for e in edges)

    def overlaps(self, other):
        return not (self.x+self.w < other.x or other.x+other.w < self.x or
                    self.y+self.h < other.y or other.y+other.h < self.y)

    def distance_to_point(self, px, py):
        cx, cy = self.get_center()
        dx = max(abs(px-cx) - self.w/2, 0)
        dy = max(abs(py-cy) - self.h/2, 0)
        return math.sqrt(dx*dx + dy*dy)

    def to_dict(self):
        return {'type': self.type, 'x': self.x, 'y': self.y, 'w': self.w, 'h': self.h}

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'MapObject':
        """
        Create the correct MapObject subclass from a saved dict.
        Handles every type produced by the React map editor.
        """
        obj_type = data.get('type', 'wall')
        x = float(data.get('x', 0))
        y = float(data.get('y', 0))
        w = float(data.get('w', 0))
        h = float(data.get('h', 0))

        # ── Rectangular objects ──────────────────────────────────────────────
        if obj_type == 'wall':
            return testWall(x, y, w, h)

        elif obj_type == 'exit':
            return Exit(x, y, w, h)

        elif obj_type in ('stairs', 'concrete_stairs'):
            obj = ConcreteStairs(x, y, w, h)
            obj.name        = data.get('name', '')
            obj.connects_to = data.get('connects_to', '')
            obj.id          = data.get('id')
            return obj

        elif obj_type == 'fire_ladder':
            obj = FireLadder(x, y, w, h)
            obj.name        = data.get('name', '')
            obj.connects_to = data.get('connects_to', '')
            obj.id          = data.get('id')
            return obj

        elif obj_type == 'npc':
            npc = NPC(x, y, w, h, data.get('name', 'Agents'))
            npc.speed = float(data.get('speed', 2.0))
            return npc

        elif obj_type == 'npc_count':
            obj = NPC(x, y, w, h, data.get('name', 'Queue'))
            obj.type         = 'npc_count'
            obj.speed        = float(data.get('speed', 2.0))
            obj.agent_count  = int(data.get('agent_count', 10))
            obj.spawn_interval = int(data.get('spawn_interval', 30))
            return obj

        elif obj_type == 'safezone':
            return SafeZone(x, y, w, h, int(data.get('capacity', 50)))

        elif obj_type == 'gate':
            return Gate(x, y, w, h, bool(data.get('is_open', True)))

        elif obj_type == 'fence':
            return Fence(x, y, w, h)

        # ── Line / room-wall ─────────────────────────────────────────────────
        elif obj_type == 'line':
            # Lines store their geometry in x1/y1/x2/y2, NOT in x/y/w/h
            return LineWall(
                x1=float(data.get('x1', 0)),
                y1=float(data.get('y1', 0)),
                x2=float(data.get('x2', 0)),
                y2=float(data.get('y2', 0)),
                thickness=float(data.get('thickness', 4)),
                is_room_wall=bool(data.get('is_room_wall', False)),
            )

        else:
            # Unknown type — keep it alive with correct coords so grid builder sees it
            return MapObject(x, y, w, h, obj_type)


# ── Concrete types ────────────────────────────────────────────────────────────

class testWall(MapObject):
    def __init__(self, x, y, w, h):
        super().__init__(x, y, w, h, 'wall')

    def blocks_path(self):
        return True


class Exit(MapObject):
    def __init__(self, x, y, w, h):
        super().__init__(x, y, w, h, 'exit')

    def is_evacuation_point(self):
        return True


class ConcreteStairs(MapObject):
    """Usable in every disaster type (fire, earthquake, bomb)."""

    def __init__(self, x, y, w, h):
        super().__init__(x, y, w, h, 'concrete_stairs')
        self.name        = ''
        self.connects_to = ''
        self.id          = None

    def to_dict(self):
        d = super().to_dict()
        d.update({'name': self.name, 'connects_to': self.connects_to})
        return d


class FireLadder(MapObject):
    """Usable only in fire drills — skipped for earthquake and bomb."""

    def __init__(self, x, y, w, h):
        super().__init__(x, y, w, h, 'fire_ladder')
        self.name        = ''
        self.connects_to = ''
        self.id          = None

    def to_dict(self):
        d = super().to_dict()
        d.update({'name': self.name, 'connects_to': self.connects_to})
        return d


# Keep old Stairs class as an alias so old saved data still works
class Stairs(ConcreteStairs):
    def __init__(self, x, y, w, h):
        super().__init__(x, y, w, h)
        self.type = 'stairs'   # keep original type string for saved maps


class Gate(MapObject):
    def __init__(self, x, y, w, h, is_open=True):
        super().__init__(x, y, w, h, 'gate')
        self.is_open = is_open

    def blocks_path(self):
        return not self.is_open

    def toggle(self):
        self.is_open = not self.is_open

    def to_dict(self):
        d = super().to_dict()
        d['is_open'] = self.is_open
        return d


class Fence(MapObject):
    def __init__(self, x, y, w, h):
        super().__init__(x, y, w, h, 'fence')

    def blocks_path(self):
        return True


class NPC(MapObject):
    def __init__(self, x, y, w, h, name='Agents'):
        super().__init__(x, y, w, h, 'npc')
        self.name  = name
        self.speed = 2.0

    def to_dict(self):
        d = super().to_dict()
        d.update({'name': self.name, 'speed': self.speed})
        return d


class SafeZone(MapObject):
    def __init__(self, x, y, w, h, capacity=50):
        super().__init__(x, y, w, h, 'safezone')
        self.capacity          = capacity
        self.current_occupancy = 0

    def can_accommodate(self, count=1):
        return self.current_occupancy + count <= self.capacity

    def add_occupants(self, count=1):
        if self.can_accommodate(count):
            self.current_occupancy += count
            return True
        return False

    def get_grid_position(self, index, total):
        spacing = 20
        cols    = max(1, int(self.w / spacing))
        col     = index % cols
        row     = index // cols
        margin  = 10
        x       = min(self.x + margin + col * spacing, self.x + self.w - margin)
        y       = min(self.y + margin + row * spacing, self.y + self.h - margin)
        return (x, y)

    def to_dict(self):
        d = super().to_dict()
        d['capacity'] = self.capacity
        return d


class LineWall(MapObject):
    """
    A line segment used as a wall or room boundary.
    Geometry is stored in x1/y1/x2/y2.
    x/y/w/h are 0 (not meaningful for lines).
    """

    def __init__(self, x1, y1, x2, y2, thickness=4, is_room_wall=False):
        # Pass dummy x/y/w/h — lines don't use bounding-box coords
        super().__init__(0, 0, 0, 0, 'line')
        self.x1           = float(x1)
        self.y1           = float(y1)
        self.x2           = float(x2)
        self.y2           = float(y2)
        self.thickness    = float(thickness)
        self.is_room_wall = is_room_wall

    def get_center(self):
        return ((self.x1+self.x2)/2, (self.y1+self.y2)/2)

    def length(self):
        return math.hypot(self.x2-self.x1, self.y2-self.y1)

    def to_dict(self):
        return {
            'type':         'line',
            'x': 0, 'y': 0, 'w': 0, 'h': 0,
            'x1':           self.x1,
            'y1':           self.y1,
            'x2':           self.x2,
            'y2':           self.y2,
            'thickness':    self.thickness,
            'is_room_wall': self.is_room_wall,
        }


# ── Validation & reconstruction (unchanged API) ───────────────────────────────

def validate_project_structure(project_data):
    if not isinstance(project_data, dict):
        return False, "Project data must be a dictionary"
    if 'buildings' not in project_data:
        return False, "Project must have 'buildings' array"
    buildings = project_data['buildings']
    if not isinstance(buildings, list):
        return False, "'buildings' must be an array"
    for i, building in enumerate(buildings):
        if not isinstance(building, dict):
            return False, f"Building {i} must be a dictionary"
        if 'layers' not in building and 'floors' not in building:
            return False, f"Building {i} must have 'layers' or 'floors' array"
        layers = building.get('layers') or building.get('floors')
        if not isinstance(layers, list):
            return False, f"Building {i} layers must be an array"
        for j, layer in enumerate(layers):
            if not isinstance(layer, list):
                return False, f"Building {i}, Floor {j} must be an array of objects"
            for k, obj in enumerate(layer):
                if not isinstance(obj, dict):
                    return False, f"Building {i}, Floor {j}, Object {k} must be a dictionary"
                for field in ['type', 'x', 'y', 'w', 'h']:
                    if field not in obj:
                        return False, f"Building {i}, Floor {j}, Object {k} missing '{field}'"
    return True, None


def reconstruct_objects_from_project(project_data):
    buildings_objects = []
    for building in project_data.get('buildings', []):
        building_floors = []
        floors_data = building.get('layers') or building.get('floors', [])
        for floor_data in floors_data:
            floor_objects = []
            for obj_data in floor_data:
                try:
                    floor_objects.append(MapObject.from_dict(obj_data))
                except Exception as e:
                    print(f"⚠️ Failed to reconstruct object: {e}")
            building_floors.append(floor_objects)
        buildings_objects.append(building_floors)
    return buildings_objects


def create_map_object(obj_type, x, y, w, h, grid_size=10, **kwargs):
    if obj_type == 'wall':           return testWall(x, y, w, h)
    elif obj_type == 'exit':         return Exit(x, y, w, h)
    elif obj_type in ('stairs', 'concrete_stairs'): return ConcreteStairs(x, y, w, h)
    elif obj_type == 'fire_ladder':  return FireLadder(x, y, w, h)
    elif obj_type == 'npc':          return NPC(x, y, w, h, kwargs.get('name', 'Agents'))
    elif obj_type == 'safezone':
        area     = w * h
        cells    = area / (grid_size * grid_size)
        capacity = kwargs.get('capacity', max(10, int(cells * 0.5)))
        return SafeZone(x, y, w, h, capacity)
    elif obj_type == 'gate':         return Gate(x, y, w, h, kwargs.get('is_open', True))
    elif obj_type == 'fence':        return Fence(x, y, w, h)
    elif obj_type == 'line':
        return LineWall(
            kwargs.get('x1', x), kwargs.get('y1', y),
            kwargs.get('x2', x+w), kwargs.get('y2', y+h),
            kwargs.get('thickness', 4),
            kwargs.get('is_room_wall', False),
        )
    else:
        return MapObject(x, y, w, h, obj_type)