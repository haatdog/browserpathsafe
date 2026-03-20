// PathVisualization.tsx
import { useRef, useEffect, useState } from 'react';
import { X, Download, Building2, Layers, ArrowUpDown } from 'lucide-react';

interface PathVisualizationProps {
  projectData: any;
  simulationResults: any;
  onClose: () => void;
}

// ── Shared object renderer (mirrors SimulationPlayback drawMapObject) ──────────
function drawMapObject(ctx: CanvasRenderingContext2D, obj: any) {
  const t = obj.type;

  // ── Line / Room wall ──────────────────────────────────────────────────────────
  if (t === 'line') {
    const x1 = obj.x1 ?? 0, y1 = obj.y1 ?? 0;
    const x2 = obj.x2 ?? 0, y2 = obj.y2 ?? 0;
    const isRoom = obj.is_room_wall === true;
    ctx.save();
    ctx.strokeStyle = isRoom ? '#1e293b' : '#94a3b8';
    ctx.lineWidth   = isRoom ? (obj.thickness ?? 7) : (obj.thickness ?? 3);
    ctx.lineCap     = isRoom ? 'square' : 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur  = isRoom ? 3 : 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
    return;
  }

  // ── Legacy wall ───────────────────────────────────────────────────────────────
  if (t === 'wall') {
    ctx.save();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 5;
    ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
    ctx.strokeRect(obj.x + 2.5, obj.y + 2.5, obj.w - 5, obj.h - 5);
    ctx.restore();
    return;
  }

  // ── Exit ──────────────────────────────────────────────────────────────────────
  if (t === 'exit') {
    ctx.save();
    ctx.fillStyle = 'rgba(34,197,94,0.18)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]); ctx.strokeRect(obj.x, obj.y, obj.w, obj.h); ctx.setLineDash([]);
    ctx.fillStyle = '#16a34a';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── Safe zone ─────────────────────────────────────────────────────────────────
  if (t === 'safezone') {
    ctx.save();
    ctx.fillStyle = 'rgba(14,165,233,0.10)'; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    // cross-hatch
    ctx.strokeStyle = 'rgba(14,165,233,0.2)'; ctx.lineWidth = 0.5;
    for (let x = obj.x; x < obj.x + obj.w; x += 10) { ctx.beginPath(); ctx.moveTo(x, obj.y); ctx.lineTo(x, obj.y + obj.h); ctx.stroke(); }
    for (let y = obj.y; y < obj.y + obj.h; y += 10) { ctx.beginPath(); ctx.moveTo(obj.x, y); ctx.lineTo(obj.x + obj.w, y); ctx.stroke(); }
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2; ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    ctx.fillStyle = '#0ea5e9';
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⛶ SAFE ZONE', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── NPC spawn zone ────────────────────────────────────────────────────────────
  if (t === 'npc') {
    ctx.save();
    ctx.fillStyle = 'rgba(59,130,246,0.12)'; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]); ctx.strokeRect(obj.x, obj.y, obj.w, obj.h); ctx.setLineDash([]);
    ctx.fillStyle = '#1d4ed8';
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(obj.name || 'SPAWN', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── NPC count zone ────────────────────────────────────────────────────────────
  if (t === 'npc_count') {
    ctx.save();
    ctx.fillStyle = 'rgba(249,115,22,0.10)'; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]); ctx.strokeRect(obj.x, obj.y, obj.w, obj.h); ctx.setLineDash([]);
    ctx.fillStyle = '#c2410c';
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(obj.agent_count != null ? `▶ ${obj.agent_count}` : '▶ QUEUE', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── Concrete stairs ───────────────────────────────────────────────────────────
  if (t === 'concrete_stairs' || t === 'stairs') {
    ctx.save();
    ctx.fillStyle = 'rgba(245,158,11,0.12)'; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    const steps = Math.max(3, Math.floor(obj.h / 8));
    ctx.strokeStyle = 'rgba(245,158,11,0.4)'; ctx.lineWidth = 0.8;
    for (let i = 1; i < steps; i++) {
      const sy = obj.y + (obj.h / steps) * i;
      ctx.beginPath(); ctx.moveTo(obj.x, sy); ctx.lineTo(obj.x + obj.w, sy); ctx.stroke();
    }
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⬍ STAIRS', obj.x + obj.w / 2, obj.y + obj.h / 2);
    if (obj.name) {
      ctx.font = '9px monospace';
      ctx.fillText(obj.name, obj.x + obj.w / 2, obj.y + obj.h - 6);
    }
    ctx.restore();
    return;
  }

  // ── Fire ladder ───────────────────────────────────────────────────────────────
  if (t === 'fire_ladder') {
    ctx.save();
    ctx.fillStyle = 'rgba(239,68,68,0.08)'; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]); ctx.strokeRect(obj.x, obj.y, obj.w, obj.h); ctx.setLineDash([]);
    const rail = obj.w * 0.25;
    ctx.strokeStyle = 'rgba(239,68,68,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(obj.x + rail, obj.y + 3); ctx.lineTo(obj.x + rail, obj.y + obj.h - 3);
    ctx.moveTo(obj.x + obj.w - rail, obj.y + 3); ctx.lineTo(obj.x + obj.w - rail, obj.y + obj.h - 3);
    ctx.stroke();
    const rungs = Math.max(3, Math.floor(obj.h / 10));
    for (let i = 0; i <= rungs; i++) {
      const ry = obj.y + 3 + ((obj.h - 6) / rungs) * i;
      ctx.beginPath(); ctx.moveTo(obj.x + rail, ry); ctx.lineTo(obj.x + obj.w - rail, ry); ctx.stroke();
    }
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔥 LADDER', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── Gate ─────────────────────────────────────────────────────────────────────
  if (t === 'gate') {
    const open = obj.is_open !== false;
    ctx.save();
    ctx.fillStyle = open ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = open ? '#10b981' : '#ef4444'; ctx.lineWidth = 2;
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    ctx.fillStyle = open ? '#065f46' : '#991b1b';
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'OPEN' : 'CLOSED', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── Fence ─────────────────────────────────────────────────────────────────────
  if (t === 'fence') {
    ctx.save();
    ctx.fillStyle = 'rgba(146,64,14,0.1)'; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = 'rgba(180,120,40,0.9)'; ctx.lineWidth = 2;
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    const postSp = 16;
    ctx.strokeStyle = 'rgba(251,191,36,0.7)'; ctx.lineWidth = 1;
    for (let x = obj.x; x <= obj.x + obj.w; x += postSp) {
      ctx.beginPath(); ctx.moveTo(x, obj.y); ctx.lineTo(x, obj.y + obj.h); ctx.stroke();
    }
    ctx.restore();
    return;
  }
}

// ── Extract points array from a path entry (flat array OR {points, spawn_step}) ─
function getPathPoints(entry: any): Array<[number, number]> {
  if (Array.isArray(entry)) return entry;
  if (entry && Array.isArray(entry.points)) return entry.points;
  return [];
}

export default function PathVisualization({ projectData, simulationResults, onClose }: PathVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode]                   = useState<'campus' | 'building'>('campus');
  const [selectedBuildingIdx, setSelectedBuildingIdx] = useState<number>(0);
  const [selectedFloorIdx, setSelectedFloorIdx]   = useState<number>(0);
  const [showStairConnections, setShowStairConnections] = useState<boolean>(true);

  const cellSize   = projectData?.cell_size   || 10;
  const gridWidth  = projectData?.width       || 80;
  const gridHeight = projectData?.height      || 60;

  const buildings       = projectData?.buildings || [];
  const currentBuilding = buildings[selectedBuildingIdx];
  const floors          = currentBuilding?.layers || [];

  useEffect(() => {
    const paths = simulationResults?.paths || {};
    const first = Object.keys(paths)[0];
    if (first) setSelectedBuildingIdx(parseInt(first));
  }, [simulationResults]);

  useEffect(() => { drawCurrentView(); },
    [projectData, simulationResults, viewMode, selectedBuildingIdx, selectedFloorIdx, showStairConnections]);

  // ── Drawing ──────────────────────────────────────────────────────────────────

  const drawCurrentView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width  = gridWidth  * cellSize;
    canvas.height = gridHeight * cellSize;
    ctx.fillStyle = '#f8f7f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx);
    viewMode === 'campus' ? drawCampusView(ctx) : drawBuildingFloorView(ctx);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(100,120,150,0.15)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= gridWidth; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, gridHeight * cellSize); ctx.stroke();
    }
    for (let y = 0; y <= gridHeight; y += 5) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize); ctx.lineTo(gridWidth * cellSize, y * cellSize); ctx.stroke();
    }
  };

  const drawCampusView = (ctx: CanvasRenderingContext2D) => {
    // Draw all objects from all buildings (floor 0)
    buildings.forEach((building: any) => {
      const layer0 = building.layers?.[0] || [];
      layer0.forEach((obj: any) => drawMapObject(ctx, obj));
    });

    // Overlay building outlines + labels
    buildings.forEach((building: any, idx: number) => {
      const outline = building.outline;
      const isSelected = idx === selectedBuildingIdx;
      if (!outline) return;

      ctx.save();
      ctx.strokeStyle = isSelected ? 'rgba(139,92,246,0.9)' : 'rgba(100,116,139,0.5)';
      ctx.lineWidth   = isSelected ? 3 : 1.5;
      ctx.setLineDash(isSelected ? [] : [6, 3]);
      if (outline.shape === 'rect') {
        ctx.strokeRect(outline.x, outline.y, outline.w, outline.h);
      } else if (outline.points?.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(outline.points[0].x, outline.points[0].y);
        outline.points.slice(1).forEach((p: any) => ctx.lineTo(p.x, p.y));
        ctx.closePath(); ctx.stroke();
      }
      ctx.setLineDash([]);

      const b = getBuildingBounds(outline);
      ctx.fillStyle = isSelected ? 'rgba(139,92,246,0.9)' : 'rgba(30,41,59,0.7)';
      ctx.font = `bold ${isSelected ? 14 : 12}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(building.name || `Building ${idx + 1}`, b.x + b.w / 2, b.y + b.h / 2);
      ctx.restore();
    });

    ctx.fillStyle = 'rgba(30,41,59,0.7)';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('← Select a building to view evacuation paths', 12, 12);
  };

  const drawBuildingFloorView = (ctx: CanvasRenderingContext2D) => {
    // Draw floor objects
    const layer = floors[selectedFloorIdx] || [];
    layer.forEach((obj: any) => drawMapObject(ctx, obj));

    // Draw paths
    const paths        = simulationResults?.paths || {};
    const buildingPaths = paths[selectedBuildingIdx.toString()];
    const floorPaths   = buildingPaths?.[selectedFloorIdx.toString()];

    if (floorPaths && Array.isArray(floorPaths) && floorPaths.length > 0) {
      floorPaths.forEach((entry: any, idx: number) => {
        const pts = getPathPoints(entry);
        if (pts.length >= 2) drawPath(ctx, pts, idx);
      });
      if (showStairConnections) drawStairConnections(ctx);
    } else {
      ctx.fillStyle = 'rgba(100,116,139,0.7)';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('No evacuation paths recorded for this floor',
        (gridWidth * cellSize) / 2, (gridHeight * cellSize) / 2);
    }

    // Label
    ctx.fillStyle = 'rgba(30,41,59,0.8)';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(
      `${currentBuilding?.name || `Building ${selectedBuildingIdx + 1}`} — Floor ${selectedFloorIdx + 1}`,
      12, 12
    );
  };

  const drawPath = (ctx: CanvasRenderingContext2D, path: Array<[number, number]>, pathIdx: number) => {
    if (path.length < 2) return;
    const colors = ['#3b82f6','#8b5cf6','#ec4899','#f97316','#10b981','#06b6d4','#f59e0b','#ef4444'];
    const color  = colors[pathIdx % colors.length];

    ctx.save();
    ctx.shadowBlur = 6; ctx.shadowColor = color;
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.75;

    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // Start dot
    const [sx, sy] = path[0];
    ctx.fillStyle = color + '40'; ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;        ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';    ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();

    // Arrow at end
    const ex = path[path.length - 1][0], ey = path[path.length - 1][1];
    const px = path[path.length - 2][0], py = path[path.length - 2][1];
    const angle = Math.atan2(ey - py, ex - px);
    const as = 12;
    ctx.fillStyle = color;
    ctx.shadowBlur = 4; ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - as * Math.cos(angle - Math.PI / 6), ey - as * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(ex - as * Math.cos(angle + Math.PI / 6), ey - as * Math.sin(angle + Math.PI / 6));
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawStairConnections = (ctx: CanvasRenderingContext2D) => {
    if (!floors[selectedFloorIdx]) return;
    const stairTypes = ['stairs', 'concrete_stairs', 'fire_ladder'];
    const stairs = (floors[selectedFloorIdx] as any[]).filter(o => stairTypes.includes(o.type));

    stairs.forEach((stair: any) => {
      const connectsTo = stair.connects_to;
      if (!connectsTo) return;
      floors.forEach((floorObjs: any[], fIdx: number) => {
        if (fIdx === selectedFloorIdx) return;
        const matched = (floorObjs as any[]).find(o => stairTypes.includes(o.type) && o.name === connectsTo);
        if (!matched) return;

        const cx = stair.x + stair.w / 2, cy = stair.y + stair.h / 2;
        const goingUp = fIdx > selectedFloorIdx;
        const angle = goingUp ? -Math.PI / 2 : Math.PI / 2;
        const len = 28;

        ctx.save();
        ctx.strokeStyle = 'rgba(245,158,11,0.65)'; ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke(); ctx.setLineDash([]);

        const ex = cx + Math.cos(angle) * len, ey = cy + Math.sin(angle) * len;
        const as = 9;
        ctx.fillStyle = 'rgba(245,158,11,0.8)';
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - as * Math.cos(angle - Math.PI / 6), ey - as * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ex - as * Math.cos(angle + Math.PI / 6), ey - as * Math.sin(angle + Math.PI / 6));
        ctx.closePath(); ctx.fill();

        ctx.fillStyle = 'rgba(217,119,6,1)';
        ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`→ Floor ${fIdx + 1}`, ex + 38, ey);
        ctx.restore();
      });
    });
  };

  const getBuildingBounds = (outline: any) => {
    if (outline.shape === 'rect') return { x: outline.x, y: outline.y, w: outline.w, h: outline.h };
    if (outline.points?.length > 0) {
      const xs = outline.points.map((p: any) => p.x), ys = outline.points.map((p: any) => p.y);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  };

  const getPathCount = (buildingIdx: number, floorIdx?: number) => {
    const paths = simulationResults?.paths || {};
    const bp    = paths[buildingIdx.toString()];
    if (floorIdx !== undefined) {
      const fp = bp?.[floorIdx.toString()];
      return Array.isArray(fp) ? fp.length : 0;
    }
    let total = 0;
    if (bp) Object.values(bp).forEach((fp: any) => { if (Array.isArray(fp)) total += fp.length; });
    return total;
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const name = viewMode === 'campus'
      ? `campus_overview_${Date.now()}.png`
      : `${(currentBuilding?.name || `Building_${selectedBuildingIdx+1}`).replace(/\s+/g,'_')}_Floor_${selectedFloorIdx+1}_${Date.now()}.png`;
    const a = document.createElement('a');
    a.download = name; a.href = canvas.toDataURL('image/png'); a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden border border-gray-200 flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Evacuation Path Visualization</h2>
            <p className="text-blue-100 text-sm mt-0.5">
              {viewMode === 'campus'
                ? 'Campus overview — select a building to view paths'
                : `${currentBuilding?.name || `Building ${selectedBuildingIdx + 1}`} — Floor ${selectedFloorIdx + 1}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'building' && (
              <button
                onClick={() => setShowStairConnections(v => !v)}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm font-medium ${
                  showStairConnections ? 'bg-amber-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <ArrowUpDown className="w-4 h-4" /> Stair Links
              </button>
            )}
            <button onClick={handleDownload}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Download
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Building tabs */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-3 overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setViewMode('campus')}
            className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 whitespace-nowrap text-sm ${
              viewMode === 'campus'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Building2 className="w-4 h-4" /> Campus
          </button>
          {buildings.map((building: any, idx: number) => {
            const pc = getPathCount(idx);
            return (
              <button key={idx}
                onClick={() => { setSelectedBuildingIdx(idx); setSelectedFloorIdx(0); setViewMode('building'); }}
                className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap text-sm ${
                  viewMode === 'building' && selectedBuildingIdx === idx
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  {building.name || `Building ${idx + 1}`}
                  {pc > 0 && <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pc}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* Floor tabs */}
        {viewMode === 'building' && floors.length > 1 && (
          <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-2 overflow-x-auto flex-shrink-0">
            <Layers className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 mr-2 font-semibold uppercase tracking-wide">Floors</span>
            {floors.map((_: any, idx: number) => {
              const pc = getPathCount(selectedBuildingIdx, idx);
              return (
                <button key={idx} onClick={() => setSelectedFloorIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap text-sm ${
                    selectedFloorIdx === idx
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    Floor {idx + 1}
                    {pc > 0 && <span className="bg-blue-400 text-white text-xs px-1.5 rounded-full">{pc}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          <div className="flex justify-center">
            <canvas ref={canvasRef}
              className="border border-gray-300 rounded-xl shadow-xl bg-white" />
          </div>
        </div>

        {/* Legend */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-center gap-5 text-xs flex-wrap text-gray-600">
            <div className="flex items-center gap-1.5"><div className="w-6 h-1.5 bg-blue-500 rounded" /><span>Path</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" /><span>Spawn</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-green-500 rounded" /><span>Exit</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-amber-400 rounded" /><span>Stairs</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-sky-400 rounded" /><span>Safe Zone</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-slate-800 rounded" /><span>Room Wall</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-orange-400 rounded" /><span>Queue</span></div>
            {showStairConnections && viewMode === 'building' && (
              <div className="flex items-center gap-1.5"><ArrowUpDown className="w-4 h-4 text-amber-500" /><span>Floor Link</span></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}