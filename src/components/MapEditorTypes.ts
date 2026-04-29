// MapEditorTypes.ts - Shared Type Definitions for Map Editor

export interface Point { x: number; y: number; }

// ObjectType = things that get saved to the project
export type ObjectType =
  | 'wall'
  | 'exit'
  | 'concrete_stairs'
  | 'fire_ladder'
  | 'npc'
  | 'line'
  | 'safezone'
  | 'gate'
  | 'fence'
  | 'npc_count'
  | 'path_walkable'   // brush-painted walkable path
  | 'path_danger'     // brush-painted dangerous/hazard path
  // ── Safety markers (decorative, no pathfinding effect) ─────────────────
  | 'marker_fire_extinguisher'
  | 'marker_fire_exit'
  | 'marker_assembly_point'
  | 'marker_first_aid'
  | 'marker_fire_alarm'
  | 'marker_emergency_phone'
  | 'marker_no_entry'
  | 'marker_you_are_here'
  | 'marker_fire_hose'
  | 'marker_aed';

// ToolType = everything the user can select in the toolbar
export type ToolType = ObjectType | 'room' | 'eraser';

export interface MapObject {
  type: ObjectType;
  x: number;
  y: number;
  w: number;
  h: number;

  // Shared optional
  id?: number;
  name?: string;
  label?: string;
  color?: string;

  // NPC / NPC_COUNT
  speed?: number;
  agent_count?: number;
  spawn_interval?: number;

  // Stairs
  connects_to?: string;
  stair_type?: 'concrete' | 'fire_ladder';

  // Wall-line
  is_room_wall?: boolean;
  material?: string;
  durability?: number;
  border_thickness?: number;
  borders?: Record<string, Array<[Point, Point]>>;

  // Line
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  thickness?: number;

  // Safe zone
  capacity?: number;

  // Gate
  is_open?: boolean;

  // Safety marker
  markerSize?: number;  // display size in world-px (default 40)
  svgOverride?: string; // optional custom SVG override

}

export type BuildingShape = 'rect' | 'polygon';

export interface BuildingOutline {
  shape: BuildingShape;
  x?: number; y?: number; w?: number; h?: number;
  points?: Point[];
}

export interface Building {
  name: string;
  outline: BuildingOutline;
  layers: MapObject[][];
}

export interface ProjectData {
  version: string;
  cell_size: number;
  width: number;
  height: number;
  buildings: Building[];
}

export interface SavedProject {
  id: number;
  name: string;
  description: string;
  grid_width: number;
  grid_height: number;
  cell_size: number;
  project_data: ProjectData;
  building_count: number;
  total_floors: number;
  created_at: string;
  updated_at: string;
}

export type EditorMode = 'canvas' | 'building';
export type CanvasTool = 'square' | 'polygon';

export interface MapEditorProps {
  initialProjectId?: number | null;
}