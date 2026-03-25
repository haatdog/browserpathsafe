// MapRenderers.ts - Canvas Drawing Functions

import type { MapObject, Point, BuildingOutline } from './MapEditorTypes';

export interface RenderContext {
  zoom: number;
  offsetX: number;
  offsetY: number;
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  showGrid: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const RULER_SIZE = 28; // px — width of left ruler / height of top ruler

// ── Coordinate helpers ────────────────────────────────────────────────────────

export const worldpxToScreen = (x: number, y: number, zoom: number, offsetX: number, offsetY: number): Point => ({
  x: x * zoom + offsetX,
  y: y * zoom + offsetY,
});

export const screenToWorldpx = (sx: number, sy: number, zoom: number, offsetX: number, offsetY: number): Point => ({
  x: (sx - offsetX) / zoom,
  y: (sy - offsetY) / zoom,
});

// ── Ruler rendering ───────────────────────────────────────────────────────────

/**
 * Draw architectural rulers along top and left edges.
 * Graduations are in metres (worldPx / cellSize).
 */
export const drawRulers = (
  ctx: CanvasRenderingContext2D,
  rctx: RenderContext,
  canvasW: number,
  canvasH: number
): void => {
  const { zoom, offsetX, offsetY, cellSize } = rctx;
  const R = RULER_SIZE;

  // Determine tick spacing (world px between ticks)
  // Try to keep screen spacing between 40-120 px
  const meterPx = cellSize * zoom; // screen px per metre
  const rawStep = 80 / meterPx;   // target ~80px between labels
  const niceSteps = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  const step = niceSteps.find(s => s >= rawStep) ?? 500; // metres per tick

  const tickPx = step * cellSize; // world px per tick

  const BG = '#0d1117';
  const TICK_COLOR = '#64748b';
  const LABEL_COLOR = '#94a3b8';
  const ACCENT = '#3b82f6';

  ctx.save();
  ctx.font = `10px "JetBrains Mono", "Fira Mono", monospace`;
  ctx.textBaseline = 'middle';

  // ── Horizontal ruler (top) ──────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(R, 0, canvasW - R, R);

  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(R, R);
  ctx.lineTo(canvasW, R);
  ctx.stroke();

  // Calculate first tick in world coords
  const worldLeft = (R - offsetX) / zoom;
  const firstTickX = Math.ceil(worldLeft / tickPx) * tickPx;

  for (let wx = firstTickX; wx < (canvasW - offsetX) / zoom; wx += tickPx) {
    const sx = wx * zoom + offsetX;
    if (sx < R) continue;
    const metres = Math.round(wx / cellSize);
    const isMajor = metres % (step * 5) === 0 || step >= 5;

    ctx.strokeStyle = isMajor ? ACCENT : TICK_COLOR;
    ctx.lineWidth = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, R - (isMajor ? 10 : 6));
    ctx.lineTo(sx, R);
    ctx.stroke();

    if (isMajor || step <= 2) {
      ctx.fillStyle = isMajor ? '#f1f5f9' : LABEL_COLOR;
      ctx.textAlign = 'center';
      ctx.fillText(`${metres}m`, sx, R / 2 - 1);
    }
  }

  // ── Vertical ruler (left) ───────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, R, R, canvasH - R);

  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(R, R);
  ctx.lineTo(R, canvasH);
  ctx.stroke();

  const worldTop = (R - offsetY) / zoom;
  const firstTickY = Math.ceil(worldTop / tickPx) * tickPx;

  for (let wy = firstTickY; wy < (canvasH - offsetY) / zoom; wy += tickPx) {
    const sy = wy * zoom + offsetY;
    if (sy < R) continue;
    const metres = Math.round(wy / cellSize);
    const isMajor = metres % (step * 5) === 0 || step >= 5;

    ctx.strokeStyle = isMajor ? ACCENT : TICK_COLOR;
    ctx.lineWidth = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(R - (isMajor ? 10 : 6), sy);
    ctx.lineTo(R, sy);
    ctx.stroke();

    if (isMajor || step <= 2) {
      ctx.save();
      ctx.fillStyle = isMajor ? '#f1f5f9' : LABEL_COLOR;
      ctx.textAlign = 'center';
      ctx.translate(R / 2, sy);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${metres}m`, 0, 0);
      ctx.restore();
    }
  }

  // ── Corner box ───────────────────────────────────────────────────────────────
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, R, R);
  ctx.strokeStyle = '#2d3748';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, R, R);

  // small crosshair icon in corner
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(R / 2, 6); ctx.lineTo(R / 2, R - 6);
  ctx.moveTo(6, R / 2); ctx.lineTo(R - 6, R / 2);
  ctx.stroke();

  ctx.restore();
};

// ── Grid rendering ─────────────────────────────────────────────────────────────

export const drawGrid = (ctx: CanvasRenderingContext2D, renderCtx: RenderContext): void => {
  if (!renderCtx.showGrid) return;
  const { zoom, offsetX, offsetY, cellSize, gridWidth, gridHeight } = renderCtx;

  // Fine grid lines
  ctx.strokeStyle = 'rgba(100,120,150,0.25)';
  ctx.lineWidth = 0.5;

  for (let x = 0; x <= gridWidth; x++) {
    if (x % 5 === 0) continue;
    const sp1 = worldpxToScreen(x * cellSize, 0, zoom, offsetX, offsetY);
    const sp2 = worldpxToScreen(x * cellSize, gridHeight * cellSize, zoom, offsetX, offsetY);
    ctx.beginPath(); ctx.moveTo(sp1.x, sp1.y); ctx.lineTo(sp2.x, sp2.y); ctx.stroke();
  }
  for (let y = 0; y <= gridHeight; y++) {
    if (y % 5 === 0) continue;
    const sp1 = worldpxToScreen(0, y * cellSize, zoom, offsetX, offsetY);
    const sp2 = worldpxToScreen(gridWidth * cellSize, y * cellSize, zoom, offsetX, offsetY);
    ctx.beginPath(); ctx.moveTo(sp1.x, sp1.y); ctx.lineTo(sp2.x, sp2.y); ctx.stroke();
  }

  // Major grid lines (every 5 cells)
  ctx.strokeStyle = 'rgba(80,110,160,0.45)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= gridWidth; x += 5) {
    const sp1 = worldpxToScreen(x * cellSize, 0, zoom, offsetX, offsetY);
    const sp2 = worldpxToScreen(x * cellSize, gridHeight * cellSize, zoom, offsetX, offsetY);
    ctx.beginPath(); ctx.moveTo(sp1.x, sp1.y); ctx.lineTo(sp2.x, sp2.y); ctx.stroke();
  }
  for (let y = 0; y <= gridHeight; y += 5) {
    const sp1 = worldpxToScreen(0, y * cellSize, zoom, offsetX, offsetY);
    const sp2 = worldpxToScreen(gridWidth * cellSize, y * cellSize, zoom, offsetX, offsetY);
    ctx.beginPath(); ctx.moveTo(sp1.x, sp1.y); ctx.lineTo(sp2.x, sp2.y); ctx.stroke();
  }

  // Canvas boundary
  const b1 = worldpxToScreen(0, 0, zoom, offsetX, offsetY);
  const b2 = worldpxToScreen(gridWidth * cellSize, gridHeight * cellSize, zoom, offsetX, offsetY);
  ctx.strokeStyle = 'rgba(96,165,250,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b1.x, b1.y, b2.x - b1.x, b2.y - b1.y);
};

// ── Label background helper ───────────────────────────────────────────────────
function labelBg(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fill();
  ctx.restore();
}

// ── Object rendering ──────────────────────────────────────────────────────────

export const drawObject = (
  ctx: CanvasRenderingContext2D,
  obj: MapObject,
  zoom: number,
  offsetX: number,
  offsetY: number,
  isPreview = false
): void => {
  const alpha = isPreview ? 0.55 : 1;

  // ── LINE / ROOM WALL ─────────────────────────────────────────────────────────
  if (obj.type === 'line') {
    const p1 = worldpxToScreen(obj.x1!, obj.y1!, zoom, offsetX, offsetY);
    const p2 = worldpxToScreen(obj.x2!, obj.y2!, zoom, offsetX, offsetY);
    const isRoomWall = (obj as any).is_room_wall === true;

    if (!isPreview) {
      ctx.shadowColor = isRoomWall ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)';
      ctx.shadowBlur  = isRoomWall ? 4 : 2;
    }

    // Room walls: thick dark architectural lines. Regular lines: thinner slate.
    ctx.strokeStyle = isPreview
      ? (isRoomWall ? 'rgba(30,41,59,0.5)' : 'rgba(148,163,184,0.5)')
      : (isRoomWall ? 'rgba(30,41,59,0.97)' : 'rgba(148,163,184,0.9)');

    // Fixed 10 world-px width regardless of zoom, minimum 1.5 screen-px
    ctx.lineWidth = Math.max(1.5, Math.min(10 * zoom, 10));
    ctx.lineCap   = isRoomWall ? 'square' : 'round';
    ctx.lineJoin  = 'miter';
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.shadowColor = 'transparent';

    // Endpoint dots only on thin lines (room walls are joined — no dots needed)
    if (!isPreview && !isRoomWall) {
      ctx.fillStyle = 'rgba(148,163,184,0.6)';
      [p1, p2].forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5 * zoom, 0, Math.PI * 2); ctx.fill(); });
    }
    return;
  }

  const sp = worldpxToScreen(obj.x, obj.y, zoom, offsetX, offsetY);
  const sw = Math.max(1, obj.w * zoom);
  const sh = Math.max(1, obj.h * zoom);

  // ── WALL (legacy objects only) ──────────────────────────────────────────────
  // New rooms are stored as 4 line segments. This branch handles any old wall
  // objects that were saved before the Room tool was introduced.
  if (obj.type === 'wall') {
    const wt = Math.max(3, 4 * zoom);
    if (!isPreview) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 5; }
    ctx.strokeStyle = isPreview ? 'rgba(30,41,59,0.5)' : 'rgba(30,41,59,0.97)';
    ctx.lineWidth = wt; ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.rect(sp.x + wt / 2, sp.y + wt / 2, sw - wt, sh - wt);
    ctx.stroke();
    ctx.shadowColor = 'transparent';
  }

  // ── EXIT ──────────────────────────────────────────────────────────────────────
  else if (obj.type === 'exit') {
    ctx.fillStyle = `rgba(34,197,94,${alpha * 0.12})`;
    ctx.fillRect(sp.x, sp.y, sw, sh);
    ctx.strokeStyle = `rgba(34,197,94,${alpha * 0.9})`;
    ctx.lineWidth = Math.max(2, 2 * zoom);
    ctx.setLineDash([6 * zoom, 3 * zoom]);
    ctx.strokeRect(sp.x, sp.y, sw, sh);
    ctx.setLineDash([]);

    if (!isPreview && sw > 20) {
      ctx.fillStyle = `rgba(34,197,94,${alpha * 0.9})`;
      ctx.font = `bold ${Math.max(10, 13 * zoom)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', sp.x + sw / 2, sp.y + sh / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    }
  }

  // ── CONCRETE STAIRS ───────────────────────────────────────────────────────────
  else if (obj.type === 'concrete_stairs') {
    ctx.fillStyle = `rgba(245,158,11,${alpha * 0.12})`;
    ctx.fillRect(sp.x, sp.y, sw, sh);
    ctx.strokeStyle = `rgba(245,158,11,${alpha * 0.9})`;
    ctx.lineWidth = Math.max(2, 2 * zoom);
    ctx.strokeRect(sp.x, sp.y, sw, sh);

    // Draw stair-step pattern (architectural symbol)
    const steps = Math.max(3, Math.floor(sh / (6 * zoom)));
    ctx.strokeStyle = `rgba(245,158,11,${alpha * 0.5})`;
    ctx.lineWidth = Math.max(0.5, zoom * 0.8);
    for (let i = 1; i < steps; i++) {
      const y = sp.y + (sh / steps) * i;
      const indent = sw * (i / steps) * 0.3;
      ctx.beginPath(); ctx.moveTo(sp.x + indent, y); ctx.lineTo(sp.x + sw - indent, y); ctx.stroke();
    }

    if (!isPreview && sw > 24) {
      ctx.fillStyle = `rgba(245,158,11,${alpha})`;
      ctx.font = `bold ${Math.max(9, 11 * zoom)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⬍ STAIRS', sp.x + sw / 2, sp.y + sh / 2 - 8 * zoom);
      ctx.font = `${Math.max(8, 9 * zoom)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = `rgba(245,158,11,${alpha * 0.7})`;
      ctx.fillText('CONCRETE', sp.x + sw / 2, sp.y + sh / 2 + 8 * zoom);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
  }

  // ── FIRE LADDER ───────────────────────────────────────────────────────────────
  else if (obj.type === 'fire_ladder') {
    ctx.fillStyle = `rgba(239,68,68,${alpha * 0.1})`;
    ctx.fillRect(sp.x, sp.y, sw, sh);

    // Dashed border to indicate "conditional use"
    ctx.strokeStyle = `rgba(239,68,68,${alpha * 0.9})`;
    ctx.lineWidth = Math.max(2, 2 * zoom);
    ctx.setLineDash([5 * zoom, 3 * zoom]);
    ctx.strokeRect(sp.x, sp.y, sw, sh);
    ctx.setLineDash([]);

    // Ladder rungs (horizontal lines between two vertical rails)
    const railOffset = sw * 0.25;
    const rungs = Math.max(3, Math.floor(sh / (8 * zoom)));
    ctx.strokeStyle = `rgba(239,68,68,${alpha * 0.7})`;
    ctx.lineWidth = Math.max(1, zoom * 1.2);

    // Rails
    ctx.beginPath();
    ctx.moveTo(sp.x + railOffset, sp.y + 4);
    ctx.lineTo(sp.x + railOffset, sp.y + sh - 4);
    ctx.moveTo(sp.x + sw - railOffset, sp.y + 4);
    ctx.lineTo(sp.x + sw - railOffset, sp.y + sh - 4);
    ctx.stroke();

    // Rungs
    ctx.lineWidth = Math.max(0.8, zoom * 0.9);
    for (let i = 0; i <= rungs; i++) {
      const y = sp.y + 4 + ((sh - 8) / rungs) * i;
      ctx.beginPath();
      ctx.moveTo(sp.x + railOffset, y);
      ctx.lineTo(sp.x + sw - railOffset, y);
      ctx.stroke();
    }

    if (!isPreview && sw > 24) {
      ctx.fillStyle = `rgba(239,68,68,${alpha})`;
      ctx.font = `bold ${Math.max(9, 11 * zoom)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔥 LADDER', sp.x + sw / 2, sp.y + sh / 2 - 8 * zoom);
      ctx.font = `${Math.max(8, 9 * zoom)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = `rgba(239,68,68,${alpha * 0.6})`;
      ctx.fillText('FIRE ONLY', sp.x + sw / 2, sp.y + sh / 2 + 8 * zoom);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
  }

  // ── NPC ZONE (density-based) ─────────────────────────────────────────────────
  else if (obj.type === 'npc') {
    const grad = ctx.createLinearGradient(sp.x, sp.y, sp.x + sw, sp.y + sh);
    grad.addColorStop(0, `rgba(59,130,246,${alpha * 0.15})`);
    grad.addColorStop(1, `rgba(59,130,246,${alpha * 0.08})`);
    ctx.fillStyle = grad;
    ctx.fillRect(sp.x, sp.y, sw, sh);

    ctx.strokeStyle = `rgba(59,130,246,${alpha * 0.8})`;
    ctx.lineWidth = Math.max(1.5, 2 * zoom);
    ctx.setLineDash([6 * zoom, 3 * zoom]);
    ctx.strokeRect(sp.x, sp.y, sw, sh);
    ctx.setLineDash([]);

    if (!isPreview && sw > 20) {
      ctx.fillStyle = `rgba(59,130,246,${alpha * 0.9})`;
      ctx.font = `bold ${Math.max(9, 12 * zoom)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(obj.name || 'AGENTS', sp.x + sw / 2, sp.y + sh / 2);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
  }

  // ── NPC COUNT ZONE (sequential spawner) ──────────────────────────────────────
  else if (obj.type === 'npc_count') {
    // Orange tint to distinguish from blue density-based zones
    ctx.fillStyle = `rgba(249,115,22,${alpha * 0.12})`;
    ctx.fillRect(sp.x, sp.y, sw, sh);

    ctx.strokeStyle = `rgba(249,115,22,${alpha * 0.9})`;
    ctx.lineWidth = Math.max(1.5, 2 * zoom);
    ctx.setLineDash([4 * zoom, 4 * zoom]);
    ctx.strokeRect(sp.x, sp.y, sw, sh);
    ctx.setLineDash([]);

    // Small arrow dots along left edge — suggests sequential release
    if (!isPreview && sh > 20 * zoom) {
      ctx.fillStyle = `rgba(249,115,22,${alpha * 0.5})`;
      const dotCount = Math.max(2, Math.floor(sh / (8 * zoom)));
      for (let d = 0; d < dotCount; d++) {
        const dy = sp.y + (sh / dotCount) * (d + 0.5);
        ctx.beginPath();
        ctx.arc(sp.x + 6 * zoom, dy, 2 * zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (!isPreview && sw > 24) {
      ctx.fillStyle = `rgba(249,115,22,${alpha})`;
      ctx.font = `bold ${Math.max(9, 11 * zoom)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const countLabel = obj.agent_count != null ? `▶ ${obj.agent_count} agents` : '▶ QUEUE';
      ctx.fillText(countLabel, sp.x + sw / 2, sp.y + sh / 2 - 7 * zoom);
      ctx.font = `${Math.max(8, 9 * zoom)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = `rgba(249,115,22,${alpha * 0.7})`;
      ctx.fillText(obj.name || 'SEQUENTIAL', sp.x + sw / 2, sp.y + sh / 2 + 7 * zoom);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
  }

  // ── SAFE ZONE ─────────────────────────────────────────────────────────────────
  else if (obj.type === 'safezone') {
    ctx.fillStyle = `rgba(14,165,233,${alpha * 0.1})`;
    ctx.fillRect(sp.x, sp.y, sw, sh);
    ctx.strokeStyle = `rgba(14,165,233,${alpha * 0.9})`;
    ctx.lineWidth = Math.max(1.5, 2 * zoom);
    // Cross hatching
    ctx.strokeStyle = `rgba(14,165,233,${alpha * 0.15})`;
    ctx.lineWidth = 0.5;
    const spacing = 12 * zoom;
    for (let x = sp.x; x < sp.x + sw; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, sp.y); ctx.lineTo(x, sp.y + sh); ctx.stroke();
    }
    for (let y = sp.y; y < sp.y + sh; y += spacing) {
      ctx.beginPath(); ctx.moveTo(sp.x, y); ctx.lineTo(sp.x + sw, y); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(14,165,233,${alpha * 0.9})`;
    ctx.lineWidth = Math.max(1.5, 2 * zoom);
    ctx.strokeRect(sp.x, sp.y, sw, sh);

    if (!isPreview && sw > 20) {
      ctx.fillStyle = `rgba(14,165,233,${alpha})`;
      ctx.font = `bold ${Math.max(9, 12 * zoom)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⛶ SAFE ZONE', sp.x + sw / 2, sp.y + sh / 2 - 8 * zoom);
      if (obj.capacity) {
        ctx.font = `${Math.max(8, 9 * zoom)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = `rgba(14,165,233,${alpha * 0.7})`;
        ctx.fillText(`cap: ${obj.capacity}`, sp.x + sw / 2, sp.y + sh / 2 + 8 * zoom);
      }
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
  }

  // ── GATE ─────────────────────────────────────────────────────────────────────
  else if (obj.type === 'gate') {
    const open = obj.is_open !== false;
    const col = open ? '16,185,129' : '239,68,68';
    ctx.fillStyle = `rgba(${col},${alpha * 0.1})`;
    ctx.fillRect(sp.x, sp.y, sw, sh);
    ctx.strokeStyle = `rgba(${col},${alpha * 0.9})`;
    ctx.lineWidth = Math.max(2, 2.5 * zoom);
    ctx.strokeRect(sp.x, sp.y, sw, sh);
    if (!isPreview && sw > 16) {
      ctx.fillStyle = `rgba(${col},${alpha})`;
      ctx.font = `bold ${Math.max(9, 12 * zoom)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(open ? 'OPEN' : 'CLOSED', sp.x + sw / 2, sp.y + sh / 2);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
  }

  // ── FENCE ────────────────────────────────────────────────────────────────────
  else if (obj.type === 'fence') {
    ctx.fillStyle = `rgba(180,120,40,${alpha * 0.1})`;
    ctx.fillRect(sp.x, sp.y, sw, sh);

    const postSpacing = Math.max(12, 16 * zoom);
    ctx.strokeStyle = `rgba(251,191,36,${alpha * 0.8})`;
    ctx.lineWidth = Math.max(1.5, 2 * zoom);
    for (let x = sp.x; x <= sp.x + sw; x += postSpacing) {
      ctx.beginPath(); ctx.moveTo(x, sp.y); ctx.lineTo(x, sp.y + sh); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(180,120,40,${alpha * 0.9})`;
    ctx.lineWidth = Math.max(1, 1.5 * zoom);
    [0.3, 0.7].forEach(r => {
      const y = sp.y + sh * r;
      ctx.beginPath(); ctx.moveTo(sp.x, y); ctx.lineTo(sp.x + sw, y); ctx.stroke();
    });
    ctx.strokeStyle = `rgba(180,120,40,${alpha * 0.9})`;
    ctx.lineWidth = Math.max(1.5, 2 * zoom);
    ctx.strokeRect(sp.x, sp.y, sw, sh);
  }
  // ── PATH WALKABLE ────────────────────────────────────────────────────────────
  else if (obj.type === 'path_walkable') {
    // Solid green fill — no transparency so tiles don't stack visually
    ctx.fillStyle = isPreview ? 'rgba(34,197,94,0.5)' : '#4ade80';
    ctx.fillRect(sp.x, sp.y, sw, sh);
    // Thin dark border to show cell edges
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = Math.max(0.5, zoom * 0.8);
    ctx.strokeRect(sp.x, sp.y, sw, sh);
  }

  // ── PATH DANGEROUS ────────────────────────────────────────────────────────────
  else if (obj.type === 'path_danger') {
    // Solid red fill
    ctx.fillStyle = isPreview ? 'rgba(248,113,113,0.5)' : '#f87171';
    ctx.fillRect(sp.x, sp.y, sw, sh);
    // Dark border
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = Math.max(0.5, zoom * 0.8);
    ctx.strokeRect(sp.x, sp.y, sw, sh);
  }
};

// ── Eraser preview ────────────────────────────────────────────────────────────

export const drawEraserPreview = (
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  halfSize: number,   // half the eraser side in screen-px
  cellScreenSize?: number  // cell size in screen-px (zoom * cellSize) — for cell grid
): void => {
  const x = Math.round(screenX - halfSize);
  const y = Math.round(screenY - halfSize);
  const s = Math.round(halfSize * 2);

  ctx.save();

  // Fill affected cells in a distinct red tint
  ctx.fillStyle = 'rgba(239,68,68,0.12)';
  ctx.fillRect(x, y, s, s);

  // If we know the cell size, draw individual cell outlines so user can see
  // exactly which grid cells will be cleared
  if (cellScreenSize && cellScreenSize > 4) {
    ctx.strokeStyle = 'rgba(239,68,68,0.4)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);
    for (let cx2 = x; cx2 < x + s; cx2 += cellScreenSize) {
      for (let cy2 = y; cy2 < y + s; cy2 += cellScreenSize) {
        ctx.strokeRect(cx2, cy2, Math.min(cellScreenSize, x + s - cx2), Math.min(cellScreenSize, y + s - cy2));
      }
    }
  }

  // Outer dashed border
  ctx.strokeStyle = 'rgba(239,68,68,0.95)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x, y, s, s);

  // Crosshair at centre
  const cx = Math.round(screenX), cy = Math.round(screenY);
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(239,68,68,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
  ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
  ctx.stroke();
  ctx.restore();
};

// ── Building outline ──────────────────────────────────────────────────────────

export const drawBuildingOutline = (
  ctx: CanvasRenderingContext2D,
  outline: BuildingOutline,
  selected: boolean,
  zoom: number,
  offsetX: number,
  offsetY: number,
  isPreview = false
): void => {
  const baseColor = isPreview ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.7)';
  const selectedColor = 'rgba(245,158,11,0.9)';

  ctx.strokeStyle = selected ? selectedColor : baseColor;
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.setLineDash(isPreview ? [8, 4] : []);

  if (outline.shape === 'rect') {
    const sp = worldpxToScreen(outline.x!, outline.y!, zoom, offsetX, offsetY);
    const sw = Math.max(1, outline.w! * zoom);
    const sh = Math.max(1, outline.h! * zoom);
    if (isPreview) {
      ctx.fillStyle = 'rgba(148,163,184,0.05)';
      ctx.fillRect(sp.x, sp.y, sw, sh);
    }
    ctx.strokeRect(sp.x, sp.y, sw, sh);
  } else if (outline.points && outline.points.length >= 2) {
    const pts = outline.points.map(p => worldpxToScreen(p.x, p.y, zoom, offsetX, offsetY));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    if (pts.length >= 3) ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
};