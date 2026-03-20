// MapEditorTypes.ts - Shared Type Definitions for Map Editor

// ==================== BASIC TYPES ====================

export interface Point {
  x: number;
  y: number;
}

// ==================== TOOL vs OBJECT TYPES ====================

// ObjectType = things that get saved to the project
export type ObjectType =
  | 'wall'            // legacy — kept for backward compat with saved maps
  | 'exit'
  | 'concrete_stairs'   // Usable in both fire & earthquake
  | 'fire_ladder'       // Usable in fire only — NOT earthquake
  | 'npc'
  | 'line'
  | 'safezone'
  | 'gate'
  | 'fence'
  | 'npc_count';  // sequential spawner — spawns agents one by one

// ToolType = everything the user can select in the toolbar (includes non-object tools)
// 'room' is a tool-only concept — it decomposes into 4 line segments when drawn
export type ToolType = ObjectType | 'room' | 'eraser';

// ==================== MAP OBJECT ====================

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
  agent_count?: number;   // npc_count: how many agents to spawn
  spawn_interval?: number; // npc_count: steps between each spawn (default 30)

  // Stairs
  connects_to?: string;
  stair_type?: 'concrete' | 'fire_ladder'; // mirrors the object type

  // Wall-line (room side)
  is_room_wall?: boolean;  // true = drawn by room tool, acts as obstacle
  // Legacy wall fields (kept for backward compat)
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
}

// ==================== BUILDING TYPES ====================

export type BuildingShape = 'rect' | 'polygon';

export interface BuildingOutline {
  shape: BuildingShape;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  points?: Point[];
}

export interface Building {
  name: string;
  outline: BuildingOutline;
  layers: MapObject[][];
}

// ==================== PROJECT TYPES ====================

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

// ==================== EDITOR MODES ====================

export type EditorMode = 'canvas' | 'building';
export type CanvasTool = 'square' | 'polygon';

// ==================== COMPONENT PROPS ====================

export interface MapEditorProps {
  initialProjectId?: number | null;
}