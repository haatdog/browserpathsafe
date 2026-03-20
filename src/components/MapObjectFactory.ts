// MapObjectFactory.ts - Map Object Creation Factory

import type { MapObject, ObjectType } from './MapEditorTypes';

export const createMapObject = (
  type: ObjectType,
  rect: { x: number; y: number; w: number; h: number },
  lineCoords?: { x1: number; y1: number; x2: number; y2: number },
  gridSize: number = 10
): MapObject => {
  const baseObj: MapObject = { type, x: rect.x, y: rect.y, w: rect.w, h: rect.h };

  switch (type) {
    // 'wall' is no longer a standalone object — use createRoomWalls() instead

    // ── EXIT ────────────────────────────────────────────────────────────────
    case 'exit':
      return { ...baseObj, label: 'Exit', color: 'rgb(34,197,94)', id: Date.now() };

    // ── CONCRETE STAIRS (usable in fire & earthquake) ────────────────────────
    case 'concrete_stairs':
      return {
        ...baseObj,
        label: 'Concrete Stairs',
        color: 'rgb(245,158,11)',
        name: `CStair_${Date.now()}`,
        stair_type: 'concrete',
        connects_to: '',
        id: Date.now(),
      };

    // ── FIRE LADDER (usable in fire only — NOT earthquake) ───────────────────
    case 'fire_ladder':
      return {
        ...baseObj,
        label: 'Fire Ladder',
        color: 'rgb(239,68,68)',
        name: `FLadder_${Date.now()}`,
        stair_type: 'fire_ladder',
        connects_to: '',
        id: Date.now(),
      };

    // ── NPC SPAWN ZONE ───────────────────────────────────────────────────────
    case 'npc':
      return { ...baseObj, name: 'Agents', speed: 2 };

    // ── NPC COUNT ZONE (sequential spawner) ──────────────────────────────────
    case 'npc_count':
      return {
        ...baseObj,
        name: 'Queue',
        speed: 2,
        agent_count: 10,
        spawn_interval: 30,
      };

    // ── LINE WALL ────────────────────────────────────────────────────────────
    case 'line':
      if (!lineCoords) throw new Error('Line coordinates required for line type');
      return {
        type: 'line',
        x: 0, y: 0, w: 0, h: 0,
        x1: lineCoords.x1,
        y1: lineCoords.y1,
        x2: lineCoords.x2,
        y2: lineCoords.y2,
        thickness: 4,
      };

    // ── SAFE ZONE ────────────────────────────────────────────────────────────
    case 'safezone': {
      const gridArea = (baseObj.w / gridSize) * (baseObj.h / gridSize);
      return {
        ...baseObj,
        label: 'Safe Zone',
        color: 'rgb(100,200,255)',
        id: Date.now(),
        capacity: Math.max(1, Math.floor(gridArea / 20)),
      };
    }

    // ── GATE ─────────────────────────────────────────────────────────────────
    case 'gate':
      return { ...baseObj, label: 'Gate', color: 'rgb(16,185,129)', id: Date.now(), is_open: true };

    // ── FENCE ────────────────────────────────────────────────────────────────
    case 'fence':
      return { ...baseObj, label: 'Fence', color: 'rgb(146,64,14)', id: Date.now() };

    default:
      return baseObj;
  }
};

export const validateMapObject = (obj: MapObject): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (obj.type !== 'line') {
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') errors.push('Invalid x/y');
    if (typeof obj.w !== 'number' || typeof obj.h !== 'number' || obj.w <= 0 || obj.h <= 0)
      errors.push('Invalid w/h');
  }
  if (obj.type === 'line') {
    if (typeof obj.x1 !== 'number') errors.push('Line needs x1/y1/x2/y2');
  }
  return { valid: errors.length === 0, errors };
};

/**
 * Create the 4 border line segments that make up a Room.
 * Each side is an independent line so the eraser can delete just one to open a doorway.
 */
export const createRoomWalls = (
  rect: { x: number; y: number; w: number; h: number }
): MapObject[] => {
  const { x, y, w, h } = rect;
  const THICKNESS = 7;
  const make = (x1: number, y1: number, x2: number, y2: number): MapObject => ({
    type: 'line',
    x: 0, y: 0, w: 0, h: 0,
    x1, y1, x2, y2,
    thickness: THICKNESS,
    is_room_wall: true,
  });
  return [
    make(x,     y,     x + w, y    ),   // top
    make(x + w, y,     x + w, y + h),   // right
    make(x + w, y + h, x,     y + h),   // bottom
    make(x,     y + h, x,     y    ),   // left
  ];
};

export const cloneMapObject = (obj: MapObject): MapObject => JSON.parse(JSON.stringify(obj));