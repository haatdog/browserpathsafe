// MapEditor.tsx — Professional Floor Plan Editor
import { useEffect, useRef, useState, useCallback } from 'react';
import { projectAPI } from '../lib/api';
import {
  Save, Download, Loader, Move, ZoomIn, ZoomOut, Grid3x3, Upload,
  Database, FolderOpen, X, Users, DoorOpen, Shield, DoorClosed,
  Fence as FenceIcon, Square, Minus as LineIcon, ArrowUp as StairsIcon,
  Eraser, Flame, Undo2, Redo2, Maximize, Minimize, UserRoundPlus, Route,
} from 'lucide-react';

import type { Point, MapObject, ObjectType, ToolType, MapEditorProps } from './MapEditorTypes';
import { T, C } from '../design/DesignTokens'; // available for any future light-mode panels
import type { MapProjectSummary } from '../lib/api';
import {
  drawGrid, drawObject, drawRulers, drawEraserPreview,
  worldpxToScreen, screenToWorldpx, RULER_SIZE,
  type RenderContext,
} from './MapRenderers';
import { createMapObject, createRoomWalls } from './MapObjectFactory';

// ── Eraser helpers ─────────────────────────────────────────────────────────────

// Eraser sizes in cells (1×1, 2×2, 3×3, 4×4)
const ERASER_CELL_SIZES = [1, 2, 3, 4] as const;
type EraserCells = 1 | 2 | 3 | 4;

/**
 * Split a rectangular wall by a square eraser (AABB subtraction).
 * hs = half the eraser side in world-px.
 */
function splitRectByEraser(obj: MapObject, cx: number, cy: number, hs: number): MapObject[] {
  const ox1 = obj.x, oy1 = obj.y, ox2 = obj.x + obj.w, oy2 = obj.y + obj.h;
  const ex1 = Math.max(cx - hs, ox1), ey1 = Math.max(cy - hs, oy1);
  const ex2 = Math.min(cx + hs, ox2), ey2 = Math.min(cy + hs, oy2);
  if (ex2 <= ex1 || ey2 <= ey1) return [obj];
  const MIN = 2;
  const pieces: MapObject[] = [];
  const make = (x: number, y: number, w: number, h: number): MapObject => ({ ...obj, x, y, w, h });
  if (ey1 - oy1 > MIN) pieces.push(make(ox1, oy1, obj.w, ey1 - oy1));
  if (oy2 - ey2 > MIN) pieces.push(make(ox1, ey2, obj.w, oy2 - ey2));
  if (ex1 - ox1 > MIN) pieces.push(make(ox1, ey1, ex1 - ox1, ey2 - ey1));
  if (ox2 - ex2 > MIN) pieces.push(make(ex2, ey1, ox2 - ex2, ey2 - ey1));
  return pieces;
}

/**
 * Split a line segment by a square eraser using Liang-Barsky AABB clipping.
 * hs = half the eraser side in world-px.
 * Returns the surviving pieces (0, 1, or 2 line objects).
 */
function splitLineByEraser(obj: MapObject, cx: number, cy: number, hs: number): MapObject[] {
  const x1 = obj.x1!, y1 = obj.y1!, x2 = obj.x2!, y2 = obj.y2!;
  const dx = x2 - x1, dy = y2 - y1;
  const xmin = cx - hs, xmax = cx + hs, ymin = cy - hs, ymax = cy + hs;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - xmin, xmax - x1, y1 - ymin, ymax - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return [obj]; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return [obj];
  }
  const MIN_LEN = 3;
  const pieces: MapObject[] = [];
  if (t0 > 0.01) {
    const ex = x1 + t0 * dx, ey = y1 + t0 * dy;
    if (Math.hypot(ex - x1, ey - y1) > MIN_LEN) pieces.push({ ...obj, x1, y1, x2: ex, y2: ey });
  }
  if (t1 < 0.99) {
    const sx = x1 + t1 * dx, sy = y1 + t1 * dy;
    if (Math.hypot(x2 - sx, y2 - sy) > MIN_LEN) pieces.push({ ...obj, x1: sx, y1: sy, x2, y2 });
  }
  return pieces;
}

/** Returns true if the square eraser (cx±hs, cy±hs) overlaps the given object. */
const eraserTouchesObject = (obj: MapObject, cx: number, cy: number, hs: number): boolean => {
  if (obj.type === 'line') {
    // Liang-Barsky AABB vs segment
    const dx = obj.x2! - obj.x1!, dy = obj.y2! - obj.y1!;
    const x1 = obj.x1!, y1 = obj.y1!;
    let t0 = 0, t1 = 1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - (cx - hs), (cx + hs) - x1, y1 - (cy - hs), (cy + hs) - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
    return true;
  }
  // AABB vs AABB
  return !(cx + hs < obj.x || cx - hs > obj.x + obj.w ||
           cy + hs < obj.y || cy - hs > obj.y + obj.h);
};

// ==================== MAIN COMPONENT ====================

export default function MapEditor({ initialProjectId }: MapEditorProps = {}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Core state ──────────────────────────────────────────────────────────────
  const [objects, setObjects]           = useState<MapObject[]>([]);
  const [currentTool, setCurrentTool]   = useState<ToolType>('room');
  const [dragging, setDragging]         = useState(false);
  const [startPos, setStartPos]         = useState<Point | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
  const [selectedIndex, setSelectedIndex]     = useState<number | null>(null);
  const [selectedNPC, setSelectedNPC]         = useState<MapObject | null>(null);
  const [selectedStairs, setSelectedStairs]   = useState<MapObject | null>(null);
  const [selectedGate, setSelectedGate]       = useState<MapObject | null>(null);
  const [selectedNPCCount, setSelectedNPCCount] = useState<MapObject | null>(null);

  // ── View state ──────────────────────────────────────────────────────────────
  const [cellSize, setCellSize]     = useState(10);
  const [gridWidth, setGridWidth]   = useState(80);
  const [gridHeight, setGridHeight] = useState(60);
  const [zoom, setZoom]             = useState(1.0);
  const [offsetX, setOffsetX]       = useState(RULER_SIZE + 40);
  const [offsetY, setOffsetY]       = useState(RULER_SIZE + 40);
  const [panning, setPanning]       = useState(false);
  const [panStart, setPanStart]     = useState<Point | null>(null);
  const [showGrid, setShowGrid]     = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // ── Draggable toolbar state ──────────────────────────────────────────────────
  const [toolbarPos, setToolbarPos]       = useState({ x: 16, y: 16 });
  const toolbarDraggingRef = useRef(false);
  const toolbarDragStartRef = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);

  // ── Path brush state ─────────────────────────────────────────────────────────
  const [pathBrushCells, setPathBrushCells] = useState<EraserCells>(1);
  const pathBrushCellsRef = useRef<EraserCells>(1);

  // ── Eraser state ────────────────────────────────────────────────────────────
  const [isErasing, setIsErasing] = useState(false);
  const [eraserCells, setEraserCells] = useState<EraserCells>(1);
  // Refs so eraseAt always reads current values without stale closure
  const eraserCellsRef = useRef<EraserCells>(1);
  const cellSizeRef    = useRef(10);



  // Keep eraser refs in sync
  useEffect(() => { eraserCellsRef.current = eraserCells; }, [eraserCells]);
  useEffect(() => { cellSizeRef.current = cellSize; }, [cellSize]);
  useEffect(() => { pathBrushCellsRef.current = pathBrushCells; }, [pathBrushCells]);

  // Undo/redo using refs to avoid stale closure issues
  const historyRef    = useRef<MapObject[][]>([[]]);
  const historyIdxRef = useRef(0);

  const commitObjects = useCallback((newObjects: MapObject[]) => {
    // Trim redo stack
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(newObjects);
    historyIdxRef.current = historyRef.current.length - 1;
    setObjects(newObjects);
  }, []);

  const undoAction = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    setObjects(historyRef.current[historyIdxRef.current]);
  }, []);

  const redoAction = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    setObjects(historyRef.current[historyIdxRef.current]);
  }, []);

  // ── Toolbar drag handlers ──────────────────────────────────────────────────
  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    toolbarDraggingRef.current = true;
    toolbarDragStartRef.current = { mx: e.clientX, my: e.clientY, tx: toolbarPos.x, ty: toolbarPos.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!toolbarDraggingRef.current || !toolbarDragStartRef.current) return;
      const { mx, my, tx, ty } = toolbarDragStartRef.current;
      setToolbarPos({ x: tx + e.clientX - mx, y: ty + e.clientY - my });
    };
    const onUp = () => { toolbarDraggingRef.current = false; toolbarDragStartRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [toolbarPos]);

  // ── Project state ────────────────────────────────────────────────────────────
  const [projectId, setProjectId]           = useState<number | null>(null);
  const [projectName, setProjectName]       = useState('Untitled Project');
  const [projectDescription, setProjectDescription] = useState('');
  const [showSaveMenu, setShowSaveMenu]     = useState(false);
  const [showLoadMenu, setShowLoadMenu]     = useState(false);
  const [savedProjects, setSavedProjects]   = useState<MapProjectSummary[]>([]);
  const [isSaving, setIsSaving]             = useState(false);
  const [isLoading, setIsLoading]           = useState(false);

  // ── Fullscreen ───────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredTool, setHoveredTool]   = useState<string | null>(null);
  const [tooltipPos,  setTooltipPos]    = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Setup dialog ─────────────────────────────────────────────────────────────
  const [showSetupDialog, setShowSetupDialog] = useState(true);
  const [setupGridWidth, setSetupGridWidth]   = useState('50');
  const [setupGridHeight, setSetupGridHeight] = useState('40');
  const [setupCellSize, setSetupCellSize]     = useState('10');

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isObjectTool = (t: ToolType): t is ObjectType => t !== 'eraser' && t !== 'room';

  // Snap a world-pixel coord to the nearest grid cell boundary
  const snapToGrid = useCallback((v: number) => Math.round(v / cellSize) * cellSize, [cellSize]);

  // ==================== SAVE/LOAD ====================

  // Snap all object coordinates to the cell grid before saving.
  // This guarantees that when simulation.py converts px → cell with round(px/cell_size),
  // the result is exact — no rounding drift that causes walls to appear 1 cell off.
  const snapObjectsToGrid = useCallback((objs: MapObject[]): MapObject[] => {
    const s = (v: number) => Math.round(v / cellSize) * cellSize;
    return objs.map(obj => {
      if (obj.type === 'line') {
        return {
          ...obj,
          x1: s(obj.x1 ?? 0), y1: s(obj.y1 ?? 0),
          x2: s(obj.x2 ?? 0), y2: s(obj.y2 ?? 0),
          x: s(obj.x), y: s(obj.y),
        };
      }
      // Rect-based objects: snap x,y to grid; snap w,h to nearest cell multiple
      const snappedX = s(obj.x);
      const snappedY = s(obj.y);
      const snappedW = Math.max(cellSize, s(obj.w));
      const snappedH = Math.max(cellSize, s(obj.h));
      return { ...obj, x: snappedX, y: snappedY, w: snappedW, h: snappedH };
    });
  }, [cellSize]);

  // ── Unified grid builder ──────────────────────────────────────────────────
  // Encodes the entire map as a single 2D integer array.
  // Cell values:
  //   0  = empty       1  = wall        2  = exit
  //   3  = npc spawn   4  = npc_count   5  = safe zone
  //   6  = stairs      7  = fire ladder  8  = path_walkable
  //   9  = path_danger 10 = gate(open)  11 = gate(closed)  12 = fence
  //
  // A* blocked cells: 1, 11, 12  (wall, closed gate, fence)
  // All other values are walkable — simulation scans for exits, spawns etc.
  // This is the single source of truth — no pixel↔cell conversion at runtime.
  const CELL_VALUES: Record<string, number> = {
    empty: 0, wall: 1, exit: 2, npc: 3, npc_count: 4, safezone: 5,
    concrete_stairs: 6, stairs: 6, fire_ladder: 7,
    path_walkable: 8, path_danger: 9,
    gate_open: 10, gate_closed: 11, fence: 12,
  };

  const buildUnifiedGrid = useCallback((objs: MapObject[]): number[][] => {
    // Start with empty grid
    const g: number[][] = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));

    const s2g  = (v: number) => Math.round(v / cellSize);
    const setCell = (gx: number, gy: number, val: number, overwrite = true) => {
      if (gy < 0 || gy >= gridHeight || gx < 0 || gx >= gridWidth) return;
      // Walls (val=1) always overwrite; others only write to empty cells
      // unless overwrite=true
      if (overwrite || g[gy][gx] === 0) g[gy][gx] = val;
    };

    const fillRect = (gx1: number, gy1: number, gx2: number, gy2: number, val: number, ow = true) => {
      for (let gy = gy1; gy <= gy2; gy++)
        for (let gx = gx1; gx <= gx2; gx++) setCell(gx, gy, val, ow);
    };

    const borderRect = (gx1: number, gy1: number, gx2: number, gy2: number) => {
      // Only mark the border cells as wall (1) — interior stays 0 (walkable)
      if (gx2 < gx1 || gy2 < gy1) return;
      for (let gx = gx1; gx <= gx2; gx++) { setCell(gx, gy1, 1); setCell(gx, gy2, 1); }
      for (let gy = gy1 + 1; gy < gy2; gy++) { setCell(gx1, gy, 1); setCell(gx2, gy, 1); }
    };

    const bresenham = (x0: number, y0: number, x1: number, y1: number, val = 1) => {
      // Skip the LAST cell of each segment so that 10px doorway gaps (= 1 cell_size)
      // produce a free cell between adjacent wall segments.
      // Corners still work: the END of one segment is the START of the next —
      // the corner cell is marked by the next segment's first cell.
      let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
      let cx = x0, cy = y0;
      while (true) {
        const atEnd = cx === x1 && cy === y1;
        if (!atEnd) setCell(cx, cy, val); // mark all cells EXCEPT the endpoint
        if (atEnd) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx)  { err += dx; cy += sy; }
      }
    };

    // ── Pass 1: non-wall objects (lower priority — walls overwrite) ──────────
    // Draw walkable zone objects first so walls overwrite them where they overlap
    for (const obj of objs) {
      const gx1 = Math.max(0, s2g(obj.x));
      const gy1 = Math.max(0, s2g(obj.y));
      const gx2 = Math.min(gridWidth  - 1, s2g(obj.x + (obj.w || 0)));
      const gy2 = Math.min(gridHeight - 1, s2g(obj.y + (obj.h || 0)));

      switch (obj.type) {
        case 'exit':
          fillRect(gx1, gy1, gx2, gy2, 2, false); break;
        case 'npc':
          fillRect(gx1, gy1, gx2, gy2, 3, false); break;
        case 'npc_count':
          fillRect(gx1, gy1, gx2, gy2, 4, false); break;
        case 'safezone':
          fillRect(gx1, gy1, gx2, gy2, 5, false); break;
        case 'concrete_stairs':
          fillRect(gx1, gy1, gx2, gy2, 6, false); break;
        case 'fire_ladder':
          fillRect(gx1, gy1, gx2, gy2, 7, false); break;
        case 'path_walkable':
          fillRect(gx1, gy1, gx2, gy2, 8, false); break;
        case 'path_danger':
          fillRect(gx1, gy1, gx2, gy2, 9, false); break;
        case 'gate':
          fillRect(gx1, gy1, gx2, gy2, obj.is_open === false ? 11 : 10, false); break;
      }
    }

    // ── Pass 2: walls (highest priority — always overwrite) ──────────────────
    for (const obj of objs) {
      const gx1 = s2g(obj.x), gy1 = s2g(obj.y);
      const gx2 = s2g(obj.x + (obj.w || 0)), gy2 = s2g(obj.y + (obj.h || 0));

      switch (obj.type) {
        case 'wall':
          borderRect(gx1, gy1, gx2, gy2); break;
        case 'fence':
          fillRect(gx1, gy1, gx2, gy2, 12, true); break;
        case 'line': {
          const lgx1 = s2g(obj.x1 ?? 0), lgy1 = s2g(obj.y1 ?? 0);
          const lgx2 = s2g(obj.x2 ?? 0), lgy2 = s2g(obj.y2 ?? 0);
          bresenham(lgx1, lgy1, lgx2, lgy2, 1);
          break;
        }
      }
    }

    return g;
  }, [gridWidth, gridHeight, cellSize]);

  const getProjectData = useCallback(() => {
    const snapped = snapObjectsToGrid(objects);
    const unified = buildUnifiedGrid(snapped);
    return {
      version: '2.0',
      cell_size: cellSize,
      width: gridWidth,
      height: gridHeight,
      // Legacy field names used by PathVisualization + SimulationPlayback
      grid_width: gridWidth,
      grid_height: gridHeight,
      buildings: [{
        name: 'Campus',
        outline: { shape: 'rect', x: 0, y: 0, w: gridWidth * cellSize, h: gridHeight * cellSize },
        // objects kept for rendering (playback, path viz) — not used by simulation
        layers: [snapped],
        // unified grid: single 2D array, each cell = integer value
        // 0=empty 1=wall 2=exit 3=npc 4=npc_count 5=safezone
        // 6=stairs 7=ladder 8=path_walkable 9=path_danger 10=gate_open 11=gate_closed 12=fence
        // A* blocked: 1, 11, 12
        grid: [unified],
      }],
    };
  }, [objects, cellSize, gridWidth, gridHeight, snapObjectsToGrid, buildUnifiedGrid]);

  const saveToDatabase = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: projectName,
        description: projectDescription,
        grid_width: gridWidth,
        grid_height: gridHeight,
        cell_size: cellSize,
        project_data: getProjectData(),
        building_count: 1,
        total_floors: 1,
      };
      const result = projectId
        ? await projectAPI.update(projectId, payload)
        : await projectAPI.create(payload);
      if (!projectId) setProjectId(result.id);
      alert('Project saved!');
    } catch { alert('Failed to save.'); }
    finally { setIsSaving(false); setShowSaveMenu(false); }
  };

  const saveToFile = () => {
    try {
      const blob = new Blob([JSON.stringify(getProjectData(), null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.dsproj`;
      a.click(); URL.revokeObjectURL(url);
      setShowSaveMenu(false);
    } catch { alert('Failed to save file.'); }
  };

  const loadFromDatabase = async (id: number) => {
    setIsLoading(true);
    try {
      const project = await projectAPI.getOne(id);
      setGridWidth(project.grid_width);
      setGridHeight(project.grid_height);
      setCellSize(project.cell_size);
      const pd = project.project_data;
      if (pd.objects) {
        setObjects(pd.objects);
      } else if (pd.buildings) {
        const all: MapObject[] = [];
        pd.buildings.forEach((b: any) => b.layers.forEach((l: MapObject[]) => all.push(...l)));
        setObjects(all);
      }
      setProjectName(project.name);
      setProjectDescription(project.description || '');
      setProjectId(project.id);
      setShowLoadMenu(false);
    } catch { alert('Failed to load.'); }
    finally { setIsLoading(false); }
  };

  const loadFromFile = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.dsproj,.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          setCellSize(data.cell_size || 10);
          setGridWidth(data.width || 80);
          setGridHeight(data.height || 60);
          if (data.objects) { setObjects(data.objects); }
          else if (data.buildings) {
            const all: MapObject[] = [];
            data.buildings.forEach((b: any) => b.layers.forEach((l: MapObject[]) => all.push(...l)));
            setObjects(all);
          }
          setProjectId(null);
          setProjectName(file.name.replace(/\.(dsproj|json)$/, ''));
          setShowLoadMenu(false);
        } catch { alert('Invalid file format.'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const fetchSavedProjects = async () => {
    try { setSavedProjects(await projectAPI.getAll()); }
    catch { /* ignore */ }
  };

  const deleteProject = async (id: number) => {
    if (!confirm('Delete this project?')) return;
    try { await projectAPI.delete(id); setSavedProjects((p: typeof savedProjects) => p.filter((x: typeof savedProjects[0]) => x.id !== id)); }
    catch { alert('Failed to delete.'); }
  };

  const handleSetupComplete = () => {
    setGridWidth(parseInt(setupGridWidth) || 50);
    setGridHeight(parseInt(setupGridHeight) || 40);
    setCellSize(parseInt(setupCellSize) || 10);
    setShowSetupDialog(false);
  };

  const applyPreset = (preset: 'small' | 'medium' | 'large') => {
    const map = { small: ['20','15','10'], medium: ['50','40','10'], large: ['100','80','10'] };
    const [w, h, c] = map[preset];
    setSetupGridWidth(w); setSetupGridHeight(h); setSetupCellSize(c);
  };

  // ==================== DRAW PREVIEW ====================

  const drawPreview = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!currentMousePos) return;

    if (currentTool === 'eraser') {
      const { x: rawEx, y: rawEy } = screenToWorldpx(currentMousePos.x, currentMousePos.y, zoom, offsetX, offsetY);
      const snappedEx = (Math.floor(rawEx / cellSize) * cellSize + cellSize / 2);
      const snappedEy = (Math.floor(rawEy / cellSize) * cellSize + cellSize / 2);
      const { x: snapSx, y: snapSy } = worldpxToScreen(snappedEx, snappedEy, zoom, offsetX, offsetY);
      drawEraserPreview(ctx, snapSx, snapSy, (eraserCells * cellSize / 2) * zoom, cellSize * zoom);
      return;
    }

    if (currentTool === 'path_walkable' || currentTool === 'path_danger') {
      const { x: rawEx, y: rawEy } = screenToWorldpx(currentMousePos.x, currentMousePos.y, zoom, offsetX, offsetY);
      const cellX  = Math.floor(rawEx / cellSize);
      const cellY  = Math.floor(rawEy / cellSize);
      const offset = Math.floor(pathBrushCells / 2);
      const isWalk = currentTool === 'path_walkable';
      ctx.save();
      for (let row = 0; row < pathBrushCells; row++) {
        for (let col = 0; col < pathBrushCells; col++) {
          const gx = cellX - offset + col;
          const gy = cellY - offset + row;
          const sp2 = worldpxToScreen(gx * cellSize, gy * cellSize, zoom, offsetX, offsetY);
          const csz = cellSize * zoom;
          ctx.fillStyle   = isWalk ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)';
          ctx.fillRect(sp2.x, sp2.y, csz, csz);
          ctx.strokeStyle = isWalk ? '#16a34a' : '#b91c1c';
          ctx.lineWidth = 1;
          ctx.strokeRect(sp2.x, sp2.y, csz, csz);
        }
      }
      ctx.restore();
      return;
    }

    if (!dragging || !startPos) return;
    const { x: rawWx, y: rawWy } = screenToWorldpx(currentMousePos.x, currentMousePos.y, zoom, offsetX, offsetY);
    // Snap preview to grid so the ghost outline matches where the object will land
    const wx = snapToGrid(rawWx);
    const wy = snapToGrid(rawWy);

    if (currentTool === 'room') {
      // Preview: hollow rectangle showing the 4 wall sides
      const rx = Math.min(startPos.x, wx), ry = Math.min(startPos.y, wy);
      const rw = Math.abs(wx - startPos.x), rh = Math.abs(wy - startPos.y);
      const sides = createRoomWalls({ x: rx, y: ry, w: rw, h: rh });
      sides.forEach((s: MapObject) => drawObject(ctx, s, zoom, offsetX, offsetY, true));
      // Size label
      const lsp = worldpxToScreen(rx + rw / 2, ry - 14, zoom, offsetX, offsetY);
      ctx.fillStyle = 'rgba(30,41,59,0.8)';
      ctx.font = `bold 11px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${(rw / cellSize).toFixed(1)}m × ${(rh / cellSize).toFixed(1)}m`, lsp.x, lsp.y);
      ctx.textAlign = 'left';
    } else if (currentTool === 'line') {
      drawObject(ctx, { type: 'line', x: 0, y: 0, w: 0, h: 0, x1: startPos.x, y1: startPos.y, x2: wx, y2: wy, thickness: 4 }, zoom, offsetX, offsetY, true);
    } else if (isObjectTool(currentTool)) {
      const rect = { x: Math.min(startPos.x, wx), y: Math.min(startPos.y, wy), w: Math.abs(wx - startPos.x), h: Math.abs(wy - startPos.y) };
      const prev: MapObject = { type: currentTool, ...rect };
      if (currentTool === 'wall') {
        prev.borders = {
          top:    [[{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }]],
          bottom: [[{ x: rect.x, y: rect.y + rect.h }, { x: rect.x + rect.w, y: rect.y + rect.h }]],
          left:   [[{ x: rect.x, y: rect.y }, { x: rect.x, y: rect.y + rect.h }]],
          right:  [[{ x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }]],
        };
      }
      drawObject(ctx, prev, zoom, offsetX, offsetY, true);
      // Size label
      const sp = worldpxToScreen(rect.x + rect.w / 2, rect.y - 12, zoom, offsetX, offsetY);
      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.font = `bold 11px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${(rect.w / cellSize).toFixed(1)}m × ${(rect.h / cellSize).toFixed(1)}m`, sp.x, sp.y);

      // Agent count label — for both NPC zone types
      if ((currentTool === 'npc' || currentTool === 'npc_count') && rect.w > 0 && rect.h > 0) {
        const ap = worldpxToScreen(rect.x + rect.w / 2, rect.y - 12, zoom, offsetX, offsetY);
        let label: string;
        if (currentTool === 'npc') {
          const cols = Math.max(1, Math.floor(rect.w / cellSize));
          const rows = Math.max(1, Math.floor(rect.h / cellSize));
          const agentCount = Math.min(cols * rows, 200);
          label = `👥 ${agentCount} agent${agentCount !== 1 ? 's' : ''}`;
        } else {
          label = `▶ queue spawner`;
        }
        ctx.font = `bold 11px "JetBrains Mono", monospace`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = currentTool === 'npc' ? 'rgba(59,130,246,0.85)' : 'rgba(249,115,22,0.85)';
        ctx.beginPath();
        ctx.roundRect(ap.x - tw / 2 - 6, ap.y - 10, tw + 12, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, ap.x, ap.y + 1);
      }
      ctx.textAlign = 'left';
    }
  }, [currentMousePos, dragging, startPos, currentTool, zoom, offsetX, offsetY, cellSize, snapToGrid]);

  // ==================== RENDER LOOP ====================

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background — architectural paper white
    ctx.fillStyle = '#f8f7f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clipping region (excluding rulers)
    ctx.save();
    ctx.beginPath();
    ctx.rect(RULER_SIZE, RULER_SIZE, canvas.width - RULER_SIZE, canvas.height - RULER_SIZE);
    ctx.clip();

    const renderCtx: RenderContext = { zoom, offsetX, offsetY, cellSize, gridWidth, gridHeight, showGrid };

    // Draw grid paper background inside canvas area
    const b1 = worldpxToScreen(0, 0, zoom, offsetX, offsetY);
    const b2 = worldpxToScreen(gridWidth * cellSize, gridHeight * cellSize, zoom, offsetX, offsetY);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(b1.x, b1.y, b2.x - b1.x, b2.y - b1.y);

    // Subtle paper texture dots
    if (zoom > 0.5) {
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      const dotStep = cellSize * zoom;
      for (let x = b1.x; x <= b2.x; x += dotStep) {
        for (let y = b1.y; y <= b2.y; y += dotStep) {
          ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
        }
      }
    }

    drawGrid(ctx, renderCtx);

    // Draw objects
    objects.forEach((obj, i) => {
      drawObject(ctx, obj, zoom, offsetX, offsetY);

      // Selection highlight
      const isSelected = i === selectedIndex || obj === selectedNPC || obj === selectedStairs || obj === selectedGate;
      if (isSelected) {
        const sp = worldpxToScreen(obj.x, obj.y, zoom, offsetX, offsetY);
        const sw = Math.max(1, obj.w * zoom);
        const sh = Math.max(1, obj.h * zoom);
        ctx.strokeStyle = 'rgba(251,146,60,0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(sp.x - 4, sp.y - 4, sw + 8, sh + 8);
        ctx.setLineDash([]);
      }
    });

    drawPreview(ctx);

    // Crosshair while drawing
    if (currentMousePos && dragging && currentTool !== 'eraser') {
      ctx.strokeStyle = 'rgba(100,116,139,0.5)';
      ctx.lineWidth = 0.75;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(currentMousePos.x - 12, currentMousePos.y);
      ctx.lineTo(currentMousePos.x + 12, currentMousePos.y);
      ctx.moveTo(currentMousePos.x, currentMousePos.y - 12);
      ctx.lineTo(currentMousePos.x, currentMousePos.y + 12);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Rulers drawn on top (not clipped)
    drawRulers(ctx, renderCtx, canvas.width, canvas.height);
  }, [
    objects, selectedIndex, selectedNPC, selectedStairs, selectedGate,
    dragging, drawPreview, zoom, offsetX, offsetY, currentMousePos,
    cellSize, gridWidth, gridHeight, showGrid, currentTool,
  ]);

  // ==================== EVENT HANDLERS ====================

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect   = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorldpx(mx, my, zoom, offsetX, offsetY);

    if (e.button === 2) { setPanning(true); setPanStart({ x: mx, y: my }); return; }

    // Eraser — start erasing on mousedown
    if (currentTool === 'eraser') { setIsErasing(true); eraseAt(wx, wy); return; }

    // Path brush — paint tile on mousedown
    if (currentTool === 'path_walkable' || currentTool === 'path_danger') {
      setIsErasing(true); // reuse isErasing flag to track drag-paint
      const { x: wx, y: wy } = screenToWorldpx(mx, my, zoom, offsetX, offsetY);
      paintAt(wx, wy, currentTool as 'path_walkable' | 'path_danger');
      return;
    }

    // Click on any non-line object to select it
    // Lines/room-walls are handled by the eraser, not by selection
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj.type === 'line') continue; // lines not selectable — use eraser
      if (wx >= obj.x && wx <= obj.x + obj.w && wy >= obj.y && wy <= obj.y + obj.h) {
        setSelectedIndex(i);
        if (obj.type === 'npc') { setSelectedNPC(obj); setSelectedStairs(null); setSelectedGate(null); setSelectedNPCCount(null); }
        else if (obj.type === 'npc_count') { setSelectedNPCCount(obj); setSelectedNPC(null); setSelectedStairs(null); setSelectedGate(null); }
        else if (obj.type === 'concrete_stairs' || obj.type === 'fire_ladder') { setSelectedStairs(obj); setSelectedNPC(null); setSelectedGate(null); setSelectedNPCCount(null); }
        else if (obj.type === 'gate') { setSelectedGate(obj); setSelectedNPC(null); setSelectedStairs(null); setSelectedNPCCount(null); }
        else { setSelectedNPC(null); setSelectedStairs(null); setSelectedGate(null); setSelectedNPCCount(null); }
        return;
      }
    }

    // Snap start position to grid so walls always land on grid lines
    setStartPos({ x: snapToGrid(wx), y: snapToGrid(wy) });
    setDragging(true);
    setSelectedIndex(null); setSelectedNPC(null); setSelectedStairs(null); setSelectedGate(null); setSelectedNPCCount(null);
  };

  const eraseAt = useCallback((rawWx: number, rawWy: number) => {
    const cs = cellSizeRef.current;
    const hs = (eraserCellsRef.current * cs) / 2; // half-size in world-px
    // Snap eraser centre to nearest grid cell centre so the gap is always grid-aligned
    // Snap to the CENTER of the cell the mouse is in.
    // Walls are on cell boundaries; centering the eraser on a cell means the
    // eraser box spans exactly whole cells without straddling two at once.
    const wx = Math.floor(rawWx / cs) * cs + cs / 2;
    const wy = Math.floor(rawWy / cs) * cs + cs / 2;
    setObjects(prev => {
      let changed = false;
      const next: MapObject[] = [];
      for (const obj of prev) {
        // Path tiles (path_walkable / path_danger) — erase whole tile if overlapped
        if (obj.type === 'path_walkable' || obj.type === 'path_danger') {
          if (eraserTouchesObject(obj, wx, wy, hs)) {
            changed = true; // skip — remove tile
          } else {
            next.push(obj);
          }
          continue;
        }
        // Line objects (room walls + regular lines) — split or remove
        if (obj.type !== 'line') {
          next.push(obj);
          continue;
        }
        if (!eraserTouchesObject(obj, wx, wy, hs)) {
          next.push(obj);
        } else {
          const pieces = splitLineByEraser(obj, wx, wy, hs);
          next.push(...pieces);
          changed = true;
        }
      }
      // Only push to history if something actually changed
      if (changed) {
        historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
        historyRef.current.push(next);
        historyIdxRef.current = historyRef.current.length - 1;
      }
      return changed ? next : prev;
    });
  }, []);

  // Paint grid-aligned path tiles — one tile per cell, removes existing path tiles in same cells
  const paintAt = useCallback((rawWx: number, rawWy: number, toolType: 'path_walkable' | 'path_danger') => {
    const cs = cellSizeRef.current;
    const n  = pathBrushCellsRef.current;
    // Snap to the top-left corner of the cell the mouse is in, then expand by brush size
    const cellX = Math.floor(rawWx / cs);
    const cellY = Math.floor(rawWy / cs);
    const offset = Math.floor(n / 2);

    // Generate one tile per cell in the brush area
    const newTiles: MapObject[] = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const gx = cellX - offset + col;
        const gy = cellY - offset + row;
        newTiles.push({
          type: toolType,
          x: gx * cs,
          y: gy * cs,
          w: cs,
          h: cs,
          id: Date.now() + row * 100 + col,
        });
      }
    }

    setObjects(prev => {
      // Remove any existing path tiles that occupy the same cells
      const paintedXs = new Set(newTiles.map(t => t.x));
      const paintedYs = new Set(newTiles.map(t => t.y));
      const filtered = prev.filter(o => {
        if (o.type !== 'path_walkable' && o.type !== 'path_danger') return true;
        // Remove if this tile's cell overlaps any of the painted cells
        return !(paintedXs.has(o.x) && paintedYs.has(o.y));
      });
      const next = [...filtered, ...newTiles];
      historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
      historyRef.current.push(next);
      historyIdxRef.current = historyRef.current.length - 1;
      return next;
    });
  }, []);

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isErasing) { setIsErasing(false); return; }
    if (panning) { setPanning(false); setPanStart(null); return; }

    if (dragging && !panning) {
      const canvas = canvasRef.current;
      if (!canvas || !startPos) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { x: rawWx, y: rawWy } = screenToWorldpx(mx, my, zoom, offsetX, offsetY);
      const wx = snapToGrid(rawWx);
      const wy = snapToGrid(rawWy);

      const objRect = { x: Math.min(startPos.x, wx), y: Math.min(startPos.y, wy), w: Math.abs(wx - startPos.x), h: Math.abs(wy - startPos.y) };

      // Ignore tiny accidental draws
      if (currentTool !== 'line' && (objRect.w < 2 || objRect.h < 2)) { setDragging(false); return; }

      if (currentTool === 'room') {
        // Create 4 independent line segments — one per side of the room
        if (objRect.w > 4 && objRect.h > 4) {
          const walls = createRoomWalls(objRect);
          setObjects(prev => {
            const next = [...prev, ...walls];
            historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
            historyRef.current.push(next);
            historyIdxRef.current = historyRef.current.length - 1;
            return next;
          });
        }
      } else if (isObjectTool(currentTool)) {
        const newObj = createMapObject(currentTool, objRect, { x1: startPos.x, y1: startPos.y, x2: wx, y2: wy }, cellSize);
        setObjects(prev => {
          const next = [...prev, newObj];
          historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
          historyRef.current.push(next);
          historyIdxRef.current = historyRef.current.length - 1;
          return next;
        });
        if (newObj.type === 'npc') setSelectedNPC(newObj);
        if (newObj.type === 'npc_count') setSelectedNPCCount(newObj);
        if (newObj.type === 'concrete_stairs' || newObj.type === 'fire_ladder') setSelectedStairs(newObj);
        if (newObj.type === 'gate') setSelectedGate(newObj);
      }
      setDragging(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setCurrentMousePos({ x: mx, y: my });

    if (panning && panStart) {
      setOffsetX(prev => prev + mx - panStart.x);
      setOffsetY(prev => prev + my - panStart.y);
      setPanStart({ x: mx, y: my });
      return;
    }

    if (isErasing) {
      const { x: wx, y: wy } = screenToWorldpx(mx, my, zoom, offsetX, offsetY);
      if (currentTool === 'path_walkable' || currentTool === 'path_danger') {
        paintAt(wx, wy, currentTool as 'path_walkable' | 'path_danger');
      } else {
        eraseAt(wx, wy);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {

    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - offsetX) / zoom;
    const wy = (my - offsetY) / zoom;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const nz = Math.min(Math.max(zoom * delta, 0.2), 20.0);
    setZoom(nz);
    setOffsetX(mx - wx * nz);
    setOffsetY(my - wy * nz);
  };

  // ==================== TOUCH SUPPORT ====================
  // Direct DOM listeners (not React synthetic) so preventDefault works
  // and updates fire immediately every frame during drag.

  const lastTouchRef      = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistRef  = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getTouchPos = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      touchStartTimeRef.current = Date.now();

      if (e.touches.length === 2) {
        const t0 = e.touches[0], t1 = e.touches[1];
        lastPinchDistRef.current = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        lastTouchRef.current = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
        setDragging(false);
        return;
      }

      if (e.touches.length === 1) {
        lastPinchDistRef.current = null;
        const pos = getTouchPos(e.touches[0]);
        lastTouchRef.current = pos;
        const { x: wx, y: wy } = screenToWorldpx(pos.x, pos.y, zoom, offsetX, offsetY);

        if (currentTool === 'eraser') { setIsErasing(true); eraseAt(wx, wy); return; }
        if (currentTool === 'path_walkable' || currentTool === 'path_danger') {
          setIsErasing(true);
          paintAt(wx, wy, currentTool as 'path_walkable' | 'path_danger');
          return;
        }
        setStartPos({ x: snapToGrid(wx), y: snapToGrid(wy) });
        setDragging(true);
        setSelectedIndex(null); setSelectedNPC(null); setSelectedStairs(null);
        setSelectedGate(null); setSelectedNPCCount(null);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 2) {
        const t0 = e.touches[0], t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;

        if (lastPinchDistRef.current !== null) {
          const scale = dist / lastPinchDistRef.current;
          setZoom(prev => {
            const nz = Math.min(Math.max(prev * scale, 0.2), 20.0);
            const wx = (midX - offsetX) / prev;
            const wy = (midY - offsetY) / prev;
            setOffsetX(midX - wx * nz);
            setOffsetY(midY - wy * nz);
            return nz;
          });
        }
        if (lastTouchRef.current) {
          const dx = midX - lastTouchRef.current.x;
          const dy = midY - lastTouchRef.current.y;
          setOffsetX(prev => prev + dx);
          setOffsetY(prev => prev + dy);
        }
        lastPinchDistRef.current = dist;
        lastTouchRef.current = { x: midX, y: midY };
        return;
      }

      if (e.touches.length === 1) {
        const pos = getTouchPos(e.touches[0]);
        setCurrentMousePos(pos);
        lastTouchRef.current = pos;
        const { x: wx, y: wy } = screenToWorldpx(pos.x, pos.y, zoom, offsetX, offsetY);

        if (isErasing) {
          if (currentTool === 'path_walkable' || currentTool === 'path_danger') {
            paintAt(wx, wy, currentTool as 'path_walkable' | 'path_danger');
          } else {
            eraseAt(wx, wy);
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) return;

      lastPinchDistRef.current = null;
      lastTouchRef.current = null;

      if (isErasing) { setIsErasing(false); return; }

      if (dragging && startPos) {
        const lastTouch = e.changedTouches[0];
        const pos = getTouchPos(lastTouch);
        const { x: rawWx, y: rawWy } = screenToWorldpx(pos.x, pos.y, zoom, offsetX, offsetY);
        const wx = snapToGrid(rawWx);
        const wy = snapToGrid(rawWy);
        const objRect = { x: Math.min(startPos.x, wx), y: Math.min(startPos.y, wy), w: Math.abs(wx - startPos.x), h: Math.abs(wy - startPos.y) };

        if (currentTool !== 'line' && (objRect.w < 2 || objRect.h < 2)) { setDragging(false); return; }

        if (currentTool === 'room') {
          if (objRect.w > 4 && objRect.h > 4) {
            const walls = createRoomWalls(objRect);
            setObjects(prev => {
              const next = [...prev, ...walls];
              historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
              historyRef.current.push(next); historyIdxRef.current++;
              return next;
            });
          }
        } else if (isObjectTool(currentTool)) {
          const newObj = createMapObject(currentTool, objRect, { x1: startPos.x, y1: startPos.y, x2: wx, y2: wy }, cellSize);
          setObjects(prev => {
            const next = [...prev, newObj];
            historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
            historyRef.current.push(next); historyIdxRef.current++;
            return next;
          });
          if (newObj.type === 'npc') setSelectedNPC(newObj);
          if (newObj.type === 'npc_count') setSelectedNPCCount(newObj);
          if (newObj.type === 'concrete_stairs' || newObj.type === 'fire_ladder') setSelectedStairs(newObj);
          if (newObj.type === 'gate') setSelectedGate(newObj);
        }
        setDragging(false);
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, [zoom, offsetX, offsetY, currentTool, isErasing, dragging, startPos, snapToGrid, eraseAt, paintAt, cellSize]);



  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't fire shortcuts while user is typing in any input/textarea/select
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Still allow Ctrl+S and Ctrl+Z/Y even in inputs so save/undo work
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); setShowSaveMenu(true); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoAction(); return; }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redoAction(); return; }
        return; // swallow nothing else — let the user type freely
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); setShowSaveMenu(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); setShowLoadMenu(true); return; }
      // Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoAction(); return; }
      // Redo — Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redoAction(); return;
      }
      if (e.key === ' ')                           { e.preventDefault(); } // space reserved
      else if (e.key === 'v' && !e.ctrlKey)        { setCurrentTool('path_walkable'); }
      else if (e.key === 'Escape')               { setCurrentTool('room'); setSelectedIndex(null); setSelectedNPC(null); setSelectedStairs(null); setSelectedGate(null); }
      else if (e.key === '[')                    { setEraserCells(p => ERASER_CELL_SIZES[Math.max(0, ERASER_CELL_SIZES.indexOf(p) - 1)]); }
      else if (e.key === ']')                    { setEraserCells(p => ERASER_CELL_SIZES[Math.min(3, ERASER_CELL_SIZES.indexOf(p) + 1)]); }
      else if (e.key === 'e' && !e.ctrlKey)      { setCurrentTool('eraser'); }
      else if (e.key === 'w')                    { setCurrentTool('room'); }
      else if (e.key === 'l')                    { setCurrentTool('line'); }
      else if (e.key === 'x')                    { setCurrentTool('exit'); }
      else if (e.key === 'c')                    { setCurrentTool('concrete_stairs'); }
      else if (e.key === 'r')                    { setCurrentTool('fire_ladder'); }
      else if (e.key === 'n')                    { setCurrentTool('npc'); }
      else if (e.key === 'q')                    { setCurrentTool('npc_count'); }
      else if (e.key === 'v' && !e.ctrlKey)        { setCurrentTool('path_walkable'); }
      else if (e.key === 'h' && !e.ctrlKey)        { setCurrentTool('path_danger'); }
      else if (e.key === 's' && !e.ctrlKey)      { setCurrentTool('safezone'); }
      else if (e.key === 'g' && !e.shiftKey)     { setCurrentTool('gate'); }
      else if (e.key === 'f')                    { setCurrentTool('fence'); }
      else if (e.key === 'G' && e.shiftKey)      { setShowGrid(v => !v); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndex !== null) {
        e.preventDefault();
        setObjects(prev => {
          const next = prev.filter((_, i) => i !== selectedIndex);
          // Push to history
          historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
          historyRef.current.push(next);
          historyIdxRef.current = historyRef.current.length - 1;
          return next;
        });
        setSelectedIndex(null); setSelectedNPC(null); setSelectedStairs(null); setSelectedGate(null);
      }
    };
    const up = (e: KeyboardEvent) => {

    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedIndex, objects, showGrid]);

  // ==================== EFFECTS ====================

  useEffect(() => { const id = setInterval(render, 16); return () => clearInterval(id); }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const noop = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', noop);
    return () => canvas.removeEventListener('contextmenu', noop);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current, cont = containerRef.current;
      if (canvas && cont) { canvas.width = cont.clientWidth; canvas.height = cont.clientHeight; }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setSidebarVisible(
      currentTool === 'npc' || selectedNPC !== null ||
      currentTool === 'npc_count' || selectedNPCCount !== null ||
      currentTool === 'concrete_stairs' || currentTool === 'fire_ladder' || selectedStairs !== null ||
      currentTool === 'gate' || selectedGate !== null
    );
  }, [currentTool, selectedNPC, selectedStairs, selectedGate]);

  useEffect(() => { if (showLoadMenu) fetchSavedProjects(); }, [showLoadMenu]);

  useEffect(() => {
    if (initialProjectId && initialProjectId > 0) { setShowSetupDialog(false); loadFromDatabase(initialProjectId); }
  }, [initialProjectId]);

  // ── Tool tooltips ─────────────────────────────────────────────────────────────
  const TOOL_TIPS: Record<string, { title: string; desc: string; usage: string; tip?: string }> = {
    line:             { title: 'Line / Wall Segment', desc: 'Draws a single straight wall segment. Best for precise doorways and partial walls.', usage: 'Click and drag to draw. Connect segments at corners to form rooms.', tip: 'Leave a 1-cell gap between segments to create a doorway.' },
    room:             { title: 'Room (4 Walls)', desc: 'Draws a complete rectangular room with 4 wall sides in one stroke.', usage: 'Click and drag to define the room rectangle. Each side becomes a separate wall segment you can erase later.', tip: 'Use the Eraser tool on any wall segment to create doorways.' },
    exit:             { title: 'Exit / Evacuation Door', desc: 'Marks an emergency exit. Agents will pathfind toward the nearest exit during evacuation.', usage: 'Draw a rectangle over a doorway or exit point. Larger areas are easier for agents to reach.', tip: 'Place exits on the outer edges of rooms. More exits = faster evacuation.' },
    concrete_stairs:  { title: 'Concrete Stairs', desc: 'A staircase usable in both fire and earthquake drills. Agents can use these in any disaster scenario.', usage: 'Draw a rectangle where the stairs are located. Name them and set "Connects To" for multi-floor buildings.', tip: 'Concrete stairs are the safest option — always prefer them over fire ladders.' },
    fire_ladder:      { title: 'Fire Ladder', desc: 'A metal fire escape ladder. Only usable during fire drills — skipped in earthquake scenarios due to structural risk.', usage: 'Draw a rectangle on an exterior wall where the ladder is mounted.', tip: 'In earthquake mode, agents will ignore this and use concrete stairs instead.' },
    npc:              { title: 'Agent Spawn Zone', desc: 'Defines an area where evacuation agents spawn. Agents fill the zone based on cell density.', usage: 'Draw a rectangle over an occupied area (classroom, office). Adjust speed in the sidebar.', tip: 'Larger zones spawn more agents. Each cell spawns one agent at the start.' },
    npc_count:        { title: 'Queue Spawn Zone', desc: 'Spawns a fixed number of agents one by one at a set interval — useful for simulating crowded entrances or bottlenecks.', usage: 'Draw over an entry point. Set agent count and spawn interval in the sidebar.', tip: 'Lower spawn interval = faster queue. Use this for hallways or building entrances.' },
    safezone:         { title: 'Safe Zone / Assembly Area', desc: 'Marks the designated evacuation assembly point. Agents head here after exiting the building.', usage: 'Draw a large rectangle outside the building where evacuees gather.', tip: 'Place safe zones away from exits to prevent crowding near doorways.' },
    gate:             { title: 'Gate / Controlled Access', desc: 'A gate that can be open or closed. Closed gates block agents like walls; open gates are passable.', usage: 'Draw over a gate or checkpoint. Toggle open/closed in the sidebar panel.', tip: 'Use gates to simulate locked emergency exits or security checkpoints.' },
    fence:            { title: 'Fence / Barrier', desc: 'A solid impassable barrier. Agents cannot cross fences — they must go around.', usage: 'Draw along perimeter walls or barriers that agents cannot climb.', tip: 'Fences are thinner than walls but fully block agent movement.' },
    path_walkable:    { title: 'Walkable Path', desc: 'Paints cells as preferred walkable areas. Agents are guided toward these paths during evacuation.', usage: 'Paint over hallways and corridors to guide agent flow. Use brush size to cover larger areas.', tip: 'Paint main evacuation routes to create more realistic agent behavior.' },
    path_danger:      { title: 'Hazard Zone', desc: 'Marks cells as dangerous areas (fire spread, debris). Agents actively avoid these zones.', usage: 'Paint over fire hazard zones, collapsed areas, or obstacles agents should avoid.', tip: 'Combine with walkable paths to create realistic escape route alternatives.' },
    eraser:           { title: 'Eraser', desc: 'Removes wall segments, path tiles, and other objects. Wall segments are split at the eraser boundary — great for creating doorways.', usage: 'Click and drag over any object to erase it. Use [ and ] keys or the size buttons to change eraser size.', tip: 'Erase the middle of a wall segment to create a doorway without redrawing.' },
  };

  // ── Tool button ───────────────────────────────────────────────────────────────
  const ToolBtn = ({ icon: Icon, label, tool, shortcut, color }: {
    icon: any; label: string; tool: ToolType; shortcut?: string; color?: string;
  }) => {
    const active = currentTool === tool;
    return (
      <div className="relative w-full"
        onMouseEnter={e => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setTooltipPos({ x: rect.right + 12, y: rect.top });
          setHoveredTool(tool);
        }}
        onMouseLeave={() => setHoveredTool(null)}>
        <button
          onClick={() => setCurrentTool(tool)}
          className={`group relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg transition-all text-xs font-medium w-full
            ${active
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30 scale-105'
              : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200'
            }`}
        >
          <Icon size={17} className={active ? 'text-white' : (color || '')} />
          <span className="leading-tight text-center">{label}</span>
          {shortcut && (
            <span className="absolute -top-1.5 -right-1.5 bg-slate-900 text-slate-500 text-[9px] px-1 py-0.5 rounded border border-slate-700">
              {shortcut}
            </span>
          )}
        </button>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden touch-none"
      style={{ fontFamily: '"JetBrains Mono", "Fira Mono", monospace', background: '#f8f7f4' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ cursor: panning ? 'grabbing' : (currentTool === 'eraser' || currentTool === 'path_walkable' || currentTool === 'path_danger') ? 'crosshair' : 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
      />

      {/* ── Left toolbar (draggable) ─────────────────────────────────────────── */}
      <div
        className="absolute pointer-events-auto z-20"
        style={{ left: toolbarPos.x, top: toolbarPos.y }}
      >
        <div className="bg-slate-900/96 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-800/60 p-3 w-[178px] flex flex-col" style={{ maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
          {/* Drag handle */}
          <div
            className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-slate-800 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleToolbarMouseDown}
          >
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-white text-xs font-bold tracking-widest uppercase">Tools</span>
            <span className="ml-auto text-slate-600 text-[10px]">⠿ drag</span>
          </div>

          {/* Drawing tools */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <ToolBtn icon={LineIcon}   label="Line"   tool="line"   shortcut="L" />
            <ToolBtn icon={Square}     label="Room"   tool="room"   shortcut="W" />
            <ToolBtn icon={DoorOpen}   label="Exit"   tool="exit"   shortcut="X" color="text-green-400" />
          </div>

          {/* Separator label */}
          <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1.5 px-1">Stairs</div>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <ToolBtn icon={StairsIcon} label="Concrete" tool="concrete_stairs" shortcut="C" color="text-amber-400" />
            <ToolBtn icon={Flame}      label="Ladder"   tool="fire_ladder"     shortcut="R" color="text-red-400" />
          </div>

          {/* Separator label */}
          <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1.5 px-1">Zones</div>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <ToolBtn icon={Users}         label="Agents"  tool="npc"       shortcut="N" color="text-blue-400" />
            <ToolBtn icon={UserRoundPlus}  label="Queue"   tool="npc_count" shortcut="Q" color="text-orange-400" />
            <ToolBtn icon={Shield}   label="Safe"   tool="safezone" shortcut="S" color="text-sky-400" />
            <ToolBtn icon={DoorClosed} label="Gate" tool="gate"     shortcut="G" color="text-emerald-400" />
            <ToolBtn icon={FenceIcon}  label="Fence" tool="fence"   shortcut="F" color="text-yellow-600" />
          </div>

          {/* Paths */}
          <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1.5 px-1 mt-1">Paths</div>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <ToolBtn icon={Route}     label="Walkable" tool="path_walkable" shortcut="V" color="text-emerald-400" />
            <ToolBtn icon={Route}     label="Hazard"   tool="path_danger"   shortcut="H" color="text-red-400" />
          </div>
          {(currentTool === 'path_walkable' || currentTool === 'path_danger') && (
            <div className="mt-1 mb-2 px-1 space-y-1.5">
              <div className="text-[10px] text-slate-500">Brush size (cells)</div>
              <div className="grid grid-cols-4 gap-1">
                {ERASER_CELL_SIZES.map(n => (
                  <button key={n}
                    onClick={() => setPathBrushCells(n as EraserCells)}
                    className={`py-1 rounded text-[10px] font-mono font-bold transition
                      ${pathBrushCells === n
                        ? (currentTool === 'path_walkable' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                    {n}×{n}
                  </button>
                ))}
              </div>
            </div>
          )}

                    {/* Eraser */}
          <div className="border-t border-slate-800 pt-2 mt-1">
            <ToolBtn icon={Eraser} label="Eraser" tool="eraser" shortcut="E" color="text-red-400" />
            {currentTool === 'eraser' && (
              <div className="mt-2 px-1 space-y-1.5">
                <div className="text-[10px] text-slate-500 mb-1">Size (cells)</div>
                <div className="grid grid-cols-4 gap-1">
                  {ERASER_CELL_SIZES.map(n => (
                    <button key={n}
                      onClick={() => setEraserCells(n as EraserCells)}
                      className={`py-1 rounded text-[10px] font-mono font-bold transition
                        ${eraserCells === n
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                      {n}×{n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                  <span>[ smaller</span><span>larger ]</span>
                </div>
              </div>
            )}
          </div>

          {/* Grid toggle */}
          <div className="border-t border-slate-800 pt-2 mt-2">
            <button
              onClick={() => setShowGrid(v => !v)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all
                ${showGrid ? 'bg-slate-700 text-white' : 'bg-slate-800/50 text-slate-500 hover:text-slate-400'}`}
            >
              <Grid3x3 size={14} />
              <span>Grid {showGrid ? 'ON' : 'OFF'}</span>
              <span className="ml-auto text-[9px] text-slate-600">⇧G</span>
            </button>
          </div>

          {/* Object count */}
          <div className="mt-3 px-1 text-[10px] text-slate-600">
            {objects.length} object{objects.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* ── Top-right view controls ───────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 pointer-events-auto z-20">
        <div className="bg-slate-900/96 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-800/60 p-2 flex items-center gap-2">
          <button onClick={undoAction}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition" title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button onClick={redoAction}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition" title="Redo (Ctrl+Y)">
            <Redo2 size={16} />
          </button>
          <div className="w-px h-5 bg-slate-700" />
          <button onClick={() => setZoom(z => Math.min(z * 1.2, 20))}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition">
            <ZoomIn size={16} />
          </button>
          <span className="text-white text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.2))}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition">
            <ZoomOut size={16} />
          </button>
          <div className="w-px h-5 bg-slate-700" />
          <button onClick={() => { setZoom(1.0); setOffsetX(RULER_SIZE + 40); setOffsetY(RULER_SIZE + 40); }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition" title="Reset view">
            <Move size={16} />
          </button>
          <div className="w-px h-5 bg-slate-700" />
          <button onClick={toggleFullscreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* ── Right sidebar — NPC / Stairs / Gate properties ───────────────────── */}
      {sidebarVisible && (
        <div className="absolute right-0 top-0 w-72 h-full bg-slate-900/97 backdrop-blur-xl border-l border-slate-800/60 overflow-y-auto pointer-events-auto z-20 shadow-2xl">
          <div className="p-5 space-y-5">

            {/* NPC */}
            {selectedNPC && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Users size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Agent Spawn Zone</p>
                    <p className="text-slate-500 text-xs">Configure density & speed</p>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <label className="text-xs text-slate-400 mb-2 block">Movement Speed</label>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-bold text-blue-400">{selectedNPC.speed?.toFixed(1)}</span>
                    <span className="text-slate-500 text-xs">m/s</span>
                  </div>
                  <input type="range" min="0.5" max="5" step="0.1"
                    value={selectedNPC.speed || 2}
                    onChange={e => {
                      setObjects(prev => prev.map((o, i) => i === selectedIndex ? { ...o, speed: parseFloat(e.target.value) } : o));
                      setSelectedNPC(prev => prev ? { ...prev, speed: parseFloat(e.target.value) } : prev);
                    }}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1"><span>Slow</span><span>Fast</span></div>
                </div>
                <PropsBox obj={selectedNPC} cellSize={cellSize} />
              </div>
            )}

            {/* NPC Count (sequential spawner) */}
            {selectedNPCCount && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <UserRoundPlus size={18} className="text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Queue Spawn Zone</p>
                    <p className="text-slate-500 text-xs">Spawns agents one by one</p>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
                  {/* Agent count */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Number of Agents</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} max={2000} step={1}
                        value={selectedNPCCount.agent_count ?? 10}
                        onChange={e => {
                          const val = Math.max(1, Math.min(2000, parseInt(e.target.value) || 1));
                          setObjects(prev => prev.map((o, i) => i === selectedIndex ? { ...o, agent_count: val } : o));
                          setSelectedNPCCount(prev => prev ? { ...prev, agent_count: val } : prev);
                        }}
                        className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-orange-500 focus:outline-none text-sm font-mono"
                      />
                      <span className="text-slate-500 text-xs whitespace-nowrap">agents</span>
                    </div>
                  </div>

                  {/* Speed */}
                  <div>
                    <label className="text-xs text-slate-400 mb-2 block">Movement Speed</label>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-bold text-orange-400">{(selectedNPCCount.speed ?? 2).toFixed(1)}</span>
                      <span className="text-slate-500 text-xs">m/s</span>
                    </div>
                    <input type="range" min="0.5" max="5" step="0.1"
                      value={selectedNPCCount.speed ?? 2}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setObjects(prev => prev.map((o, i) => i === selectedIndex ? { ...o, speed: val } : o));
                        setSelectedNPCCount(prev => prev ? { ...prev, speed: val } : prev);
                      }}
                      className="w-full accent-orange-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1"><span>Slow</span><span>Fast</span></div>
                  </div>

                  {/* Spawn interval */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Spawn interval (steps between each)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} max={300} step={1}
                        value={selectedNPCCount.spawn_interval ?? 30}
                        onChange={e => {
                          const val = Math.max(1, Math.min(300, parseInt(e.target.value) || 30));
                          setObjects(prev => prev.map((o, i) => i === selectedIndex ? { ...o, spawn_interval: val } : o));
                          setSelectedNPCCount(prev => prev ? { ...prev, spawn_interval: val } : prev);
                        }}
                        className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-orange-500 focus:outline-none text-sm font-mono"
                      />
                      <span className="text-slate-500 text-xs whitespace-nowrap">steps</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">Lower = faster queue, higher = slower trickle</p>
                  </div>
                </div>
                <PropsBox obj={selectedNPCCount} cellSize={cellSize} />
              </div>
            )}

            {/* Stairs (concrete or fire ladder) */}
            {selectedStairs && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    selectedStairs.type === 'fire_ladder' ? 'bg-red-500/20' : 'bg-amber-500/20'
                  }`}>
                    {selectedStairs.type === 'fire_ladder'
                      ? <Flame size={18} className="text-red-400" />
                      : <StairsIcon size={18} className="text-amber-400" />
                    }
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">
                      {selectedStairs.type === 'fire_ladder' ? 'Fire Ladder' : 'Concrete Stairs'}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {selectedStairs.type === 'fire_ladder'
                        ? 'Fire drill only — skipped in earthquake'
                        : 'Usable in both fire & earthquake drills'}
                    </p>
                  </div>
                </div>

                <div className={`rounded-lg p-3 text-xs border ${
                  selectedStairs.type === 'fire_ladder'
                    ? 'bg-red-900/20 border-red-800/40 text-red-300'
                    : 'bg-amber-900/20 border-amber-800/40 text-amber-300'
                }`}>
                  {selectedStairs.type === 'fire_ladder'
                    ? '⚠ Metal fire ladders are not safe during earthquakes. Agents will ignore this during earthquake simulations.'
                    : '✓ Concrete stairs are structurally sound during both fire and earthquake evacuations.'}
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Stairs Name</label>
                    <input type="text" value={selectedStairs.name || ''}
                      onChange={e => {
                        setObjects(prev => prev.map((o, i) => i === selectedIndex ? { ...o, name: e.target.value } : o));
                        setSelectedStairs(prev => prev ? { ...prev, name: e.target.value } : prev);
                      }}
                      className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-amber-500 focus:outline-none text-sm"
                      placeholder="e.g. StairA"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Connects To (name)</label>
                    <input type="text" value={selectedStairs.connects_to || ''}
                      onChange={e => {
                        setObjects(prev => prev.map((o, i) => i === selectedIndex ? { ...o, connects_to: e.target.value } : o));
                        setSelectedStairs(prev => prev ? { ...prev, connects_to: e.target.value } : prev);
                      }}
                      className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-amber-500 focus:outline-none text-sm"
                      placeholder="e.g. StairA_upper"
                    />
                  </div>
                </div>
                <PropsBox obj={selectedStairs} cellSize={cellSize} />
              </div>
            )}

            {/* Gate */}
            {selectedGate && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <DoorClosed size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Gate</p>
                    <p className="text-slate-500 text-xs">Controlled access point</p>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-10 h-6 rounded-full transition-colors ${selectedGate.is_open !== false ? 'bg-emerald-500' : 'bg-red-500'}`}
                      onClick={() => {
                        const val = !(selectedGate.is_open !== false);
                        setObjects(prev => prev.map((o, i) => i === selectedIndex ? { ...o, is_open: val } : o));
                        setSelectedGate(prev => prev ? { ...prev, is_open: val } : prev);
                      }}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full m-1 transition-transform ${selectedGate.is_open !== false ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-white text-sm">{selectedGate.is_open !== false ? 'Open' : 'Closed'}</span>
                  </label>
                </div>
                <PropsBox obj={selectedGate} cellSize={cellSize} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom status bar ──────────────────────────────────────────────────── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-auto z-20">
        <div className="bg-slate-900/96 backdrop-blur-xl rounded-full border border-slate-800/60 px-5 py-2.5 shadow-xl">
          <div className="flex items-center gap-5 text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${panning ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-slate-400">{panning ? 'Panning' : 'Right-click Pan'}</span>
            </div>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">
              Tool: <span className="text-white font-semibold capitalize">{currentTool.replace('_', ' ')}</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">
              Zoom: <span className="text-white font-mono">{Math.round(zoom * 100)}%</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">
              {gridWidth}×{gridHeight}m
            </span>
            <span className="text-slate-700">|</span>
            <button onClick={() => setShowSaveMenu(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition">
              <Save size={13} /><span>Save</span>
            </button>
            <button onClick={() => setShowLoadMenu(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-full transition">
              <FolderOpen size={13} /><span>Load</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Setup Dialog ──────────────────────────────────────────────────────── */}
      {showSetupDialog && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-8 max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'inherit' }}>Floor Plan Editor</h2>
            <p className="text-slate-400 text-sm mb-6">Configure your canvas or load an existing project.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => { setShowSetupDialog(false); setShowLoadMenu(true); }}
                className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-transparent hover:border-blue-600 transition">
                <Database size={28} className="text-blue-400" />
                <span className="font-semibold text-white text-sm">From Database</span>
              </button>
              <button onClick={() => { setShowSetupDialog(false); loadFromFile(); }}
                className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-transparent hover:border-green-600 transition">
                <Upload size={28} className="text-green-400" />
                <span className="font-semibold text-white text-sm">From File</span>
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-slate-600 text-xs tracking-widest">NEW PROJECT</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {(['small','medium','large'] as const).map((p: 'small' | 'medium' | 'large') => (
                <button key={p} onClick={() => applyPreset(p)}
                  className="flex flex-col items-center gap-1.5 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border-2 border-transparent hover:border-slate-600 transition">
                  <span className="text-xl">{p === 'small' ? '🏢' : p === 'medium' ? '🏘️' : '🏙️'}</span>
                  <span className="font-semibold text-white text-sm capitalize">{p}</span>
                  <span className="text-slate-500 text-xs">
                    {p === 'small' ? '20×15m' : p === 'medium' ? '50×40m' : '100×80m'}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Width (m)', val: setupGridWidth, set: setSetupGridWidth, min: 10, max: 300 },
                { label: 'Height (m)', val: setupGridHeight, set: setSetupGridHeight, min: 10, max: 300 },
                { label: 'Cell (px/m)', val: setupCellSize, set: setSetupCellSize, min: 5, max: 50 },
              ].map(({ label, val, set, min, max }) => (
                <div key={label}>
                  <label className="block text-xs text-slate-400 mb-1">{label}</label>
                  <input type="number" min={min} max={max} value={val}
                    onChange={e => set(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>
              ))}
            </div>

            <button onClick={handleSetupComplete}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition shadow-lg">
              Start New Project
            </button>
          </div>
        </div>
      )}

      {/* ── Save Menu ─────────────────────────────────────────────────────────── */}
      {showSaveMenu && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto"
          onClick={() => setShowSaveMenu(false)}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-6 w-full max-w-sm mx-4"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white">Save Project</h3>
              <button onClick={() => setShowSaveMenu(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-3 mb-5">
              <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
                placeholder="Project name"
                className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none text-sm" />
              <textarea value={projectDescription} onChange={e => setProjectDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none resize-none text-sm"
                rows={2} />
            </div>
            <div className="space-y-2">
              <button onClick={saveToDatabase} disabled={isSaving}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg transition text-sm">
                {isSaving ? <Loader size={16} className="animate-spin" /> : <Database size={16} />}
                Save to Database
              </button>
              <button onClick={saveToFile}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm">
                <Download size={16} />Download .dsproj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Load Menu ─────────────────────────────────────────────────────────── */}
      {showLoadMenu && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto"
          onClick={() => setShowLoadMenu(false)}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 p-6 w-full max-w-xl mx-4 max-h-[80vh] overflow-auto"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white">Load Project</h3>
              <button onClick={() => setShowLoadMenu(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button onClick={loadFromFile}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition text-sm">
                <Upload size={16} />Upload File
              </button>
              <button onClick={fetchSavedProjects}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm">
                <Database size={16} />Refresh
              </button>
            </div>
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader size={28} className="animate-spin text-blue-500" /></div>
              ) : savedProjects.length === 0 ? (
                <p className="text-slate-500 text-center py-8 text-sm">No saved projects found</p>
              ) : savedProjects.map((p: typeof savedProjects[0]) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-xl">
                  <div>
                    <div className="text-white text-sm font-semibold">{p.name}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{p.grid_width}×{p.grid_height}m — {new Date(p.updated_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => loadFromDatabase(p.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs">
                      Load
                    </button>
                    <button onClick={() => deleteProject(p.id)}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition text-xs">
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating tooltip portal — fixed so it escapes toolbar overflow ── */}
      {hoveredTool && TOOL_TIPS[hoveredTool] && (() => {
        const tip = TOOL_TIPS[hoveredTool];
        const SHORTCUTS: Record<string,string> = {
          line:'L', room:'W', exit:'X', concrete_stairs:'C', fire_ladder:'R',
          npc:'N', npc_count:'Q', safezone:'S', gate:'G', fence:'F',
          path_walkable:'V', path_danger:'H', eraser:'E',
        };
        const maxY = window.innerHeight - 340;
        const ty   = Math.min(tooltipPos.y, maxY);
        return (
          <div className="fixed z-[9999] w-64 pointer-events-none"
            style={{ left: tooltipPos.x, top: ty, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.7))' }}>
            <div className="absolute -left-1.5 top-4 w-3 h-3 bg-slate-800 rotate-45 border-l border-b border-slate-700" />
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-2.5">
              <p className="text-white font-bold text-sm leading-tight">{tip.title}</p>
              {SHORTCUTS[hoveredTool] && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 font-mono">
                  Shortcut: <kbd className="text-white ml-1">{SHORTCUTS[hoveredTool]}</kbd>
                </span>
              )}
              <p className="text-slate-300 text-xs leading-relaxed">{tip.desc}</p>
              <div className="border-t border-slate-700 pt-2.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">How to use</p>
                <p className="text-slate-400 text-xs leading-relaxed">{tip.usage}</p>
              </div>
              {tip.tip && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                  <p className="text-blue-300 text-[11px] leading-relaxed">
                    <span className="font-bold">💡 </span>{tip.tip}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Helper component — properties box ─────────────────────────────────────────
function PropsBox({ obj, cellSize }: { obj: MapObject; cellSize: number }) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-3 text-xs space-y-1.5">
      <p className="text-slate-500 uppercase tracking-wider text-[9px] mb-2">Properties</p>
      <div className="flex justify-between">
        <span className="text-slate-500">Position</span>
        <span className="text-slate-300 font-mono">({(obj.x / cellSize).toFixed(1)}m, {(obj.y / cellSize).toFixed(1)}m)</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Size</span>
        <span className="text-slate-300 font-mono">{(obj.w / cellSize).toFixed(1)}×{(obj.h / cellSize).toFixed(1)}m</span>
      </div>
    </div>
  );
}