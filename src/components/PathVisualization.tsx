// PathVisualization.tsx
import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Download, ArrowUpDown } from 'lucide-react';

interface PathVisualizationProps {
  projectData: any;
  simulationResults: any;
  onClose: () => void;
}

// ── Shared object renderer ────────────────────────────────────────────────────
function drawMapObject(ctx: CanvasRenderingContext2D, obj: any) {
  const t = obj.type;
  if (t === 'line') {
    const x1=obj.x1??0, y1=obj.y1??0, x2=obj.x2??0, y2=obj.y2??0;
    const isRoom = obj.is_room_wall===true;
    ctx.save();
    ctx.strokeStyle = isRoom?'#1e293b':'#94a3b8';
    ctx.lineWidth   = isRoom?(obj.thickness??7):(obj.thickness??3);
    ctx.lineCap     = isRoom?'square':'round';
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = isRoom?3:1;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.restore(); return;
  }
  if (t==='wall') {
    ctx.save(); ctx.strokeStyle='#1e293b'; ctx.lineWidth=5; ctx.lineCap='square'; ctx.lineJoin='miter';
    ctx.strokeRect(obj.x+2.5,obj.y+2.5,obj.w-5,obj.h-5); ctx.restore(); return;
  }
  if (t==='exit') {
    ctx.save();
    ctx.fillStyle='rgba(34,197,94,0.18)'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='#22c55e'; ctx.lineWidth=2; ctx.setLineDash([5,3]);
    ctx.strokeRect(obj.x,obj.y,obj.w,obj.h); ctx.setLineDash([]);
    ctx.fillStyle='#16a34a'; ctx.font='bold 13px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('EXIT',obj.x+obj.w/2,obj.y+obj.h/2); ctx.restore(); return;
  }
  if (t==='safezone') {
    ctx.save();
    ctx.fillStyle='rgba(14,165,233,0.10)'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='rgba(14,165,233,0.2)'; ctx.lineWidth=0.5;
    for(let x=obj.x;x<obj.x+obj.w;x+=10){ctx.beginPath();ctx.moveTo(x,obj.y);ctx.lineTo(x,obj.y+obj.h);ctx.stroke();}
    for(let y=obj.y;y<obj.y+obj.h;y+=10){ctx.beginPath();ctx.moveTo(obj.x,y);ctx.lineTo(obj.x+obj.w,y);ctx.stroke();}
    ctx.strokeStyle='#0ea5e9'; ctx.lineWidth=2; ctx.strokeRect(obj.x,obj.y,obj.w,obj.h);
    ctx.fillStyle='#0ea5e9'; ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⛶ SAFE ZONE',obj.x+obj.w/2,obj.y+obj.h/2); ctx.restore(); return;
  }
  if (t==='npc') {
    ctx.save();
    ctx.fillStyle='rgba(59,130,246,0.12)'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
    ctx.strokeRect(obj.x,obj.y,obj.w,obj.h); ctx.setLineDash([]);
    ctx.fillStyle='#1d4ed8'; ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(obj.name||'SPAWN',obj.x+obj.w/2,obj.y+obj.h/2); ctx.restore(); return;
  }
  if (t==='npc_count') {
    ctx.save();
    ctx.fillStyle='rgba(249,115,22,0.10)'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='#f97316'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
    ctx.strokeRect(obj.x,obj.y,obj.w,obj.h); ctx.setLineDash([]);
    ctx.fillStyle='#c2410c'; ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(obj.agent_count!=null?`▶ ${obj.agent_count}`:'▶ QUEUE',obj.x+obj.w/2,obj.y+obj.h/2);
    ctx.restore(); return;
  }
  if (t==='concrete_stairs'||t==='stairs') {
    ctx.save();
    ctx.fillStyle='rgba(245,158,11,0.12)'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='#f59e0b'; ctx.lineWidth=2; ctx.strokeRect(obj.x,obj.y,obj.w,obj.h);
    const steps=Math.max(3,Math.floor(obj.h/8));
    ctx.strokeStyle='rgba(245,158,11,0.4)'; ctx.lineWidth=0.8;
    for(let i=1;i<steps;i++){const sy=obj.y+(obj.h/steps)*i;ctx.beginPath();ctx.moveTo(obj.x,sy);ctx.lineTo(obj.x+obj.w,sy);ctx.stroke();}
    ctx.fillStyle='#d97706'; ctx.font='bold 10px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⬍ STAIRS',obj.x+obj.w/2,obj.y+obj.h/2);
    if(obj.name){ctx.font='9px monospace';ctx.fillText(obj.name,obj.x+obj.w/2,obj.y+obj.h-6);}
    ctx.restore(); return;
  }
  if (t==='fire_ladder') {
    ctx.save();
    ctx.fillStyle='rgba(239,68,68,0.08)'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='#ef4444'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
    ctx.strokeRect(obj.x,obj.y,obj.w,obj.h); ctx.setLineDash([]);
    const rail=obj.w*0.25;
    ctx.strokeStyle='rgba(239,68,68,0.5)'; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(obj.x+rail,obj.y+3); ctx.lineTo(obj.x+rail,obj.y+obj.h-3);
    ctx.moveTo(obj.x+obj.w-rail,obj.y+3); ctx.lineTo(obj.x+obj.w-rail,obj.y+obj.h-3);
    ctx.stroke();
    const rungs=Math.max(3,Math.floor(obj.h/10));
    for(let i=0;i<=rungs;i++){const ry=obj.y+3+((obj.h-6)/rungs)*i;ctx.beginPath();ctx.moveTo(obj.x+rail,ry);ctx.lineTo(obj.x+obj.w-rail,ry);ctx.stroke();}
    ctx.fillStyle='#dc2626'; ctx.font='bold 10px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🔥 LADDER',obj.x+obj.w/2,obj.y+obj.h/2); ctx.restore(); return;
  }
  if (t==='gate') {
    const open=obj.is_open!==false;
    ctx.save();
    ctx.fillStyle=open?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle=open?'#10b981':'#ef4444'; ctx.lineWidth=2; ctx.strokeRect(obj.x,obj.y,obj.w,obj.h);
    ctx.fillStyle=open?'#065f46':'#991b1b'; ctx.font='bold 10px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(open?'OPEN':'CLOSED',obj.x+obj.w/2,obj.y+obj.h/2); ctx.restore(); return;
  }
  if (t==='fence') {
    ctx.save();
    ctx.fillStyle='rgba(146,64,14,0.1)'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='rgba(180,120,40,0.9)'; ctx.lineWidth=2; ctx.strokeRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='rgba(251,191,36,0.7)'; ctx.lineWidth=1;
    for(let x=obj.x;x<=obj.x+obj.w;x+=16){ctx.beginPath();ctx.moveTo(x,obj.y);ctx.lineTo(x,obj.y+obj.h);ctx.stroke();}
    ctx.restore(); return;
  }
  if (t === 'path_walkable') {
    ctx.save(); ctx.fillStyle='#4ade80'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='#16a34a'; ctx.lineWidth=0.5; ctx.strokeRect(obj.x,obj.y,obj.w,obj.h);
    ctx.restore(); return;
  }
  if (t === 'path_danger') {
    ctx.save(); ctx.fillStyle='#f87171'; ctx.fillRect(obj.x,obj.y,obj.w,obj.h);
    ctx.strokeStyle='#b91c1c'; ctx.lineWidth=0.5; ctx.strokeRect(obj.x,obj.y,obj.w,obj.h);
    ctx.restore(); return;
  }
}

function getPathPoints(entry: any): Array<[number,number]> {
  if (Array.isArray(entry)) return entry;
  if (entry && Array.isArray(entry.points)) return entry.points;
  return [];
}

// ── Flatten all paths from the results object into a single list ──────────────
function collectAllPaths(paths: any): Array<[number,number]>[] {
  const result: Array<[number,number]>[] = [];
  if (!paths || typeof paths !== 'object') return result;

  const addEntry = (e: any) => {
    if (!e) return;
    if (e.is_corridor === true) return;
    const pts = getPathPoints(e);
    if (pts.length >= 2) result.push(pts);
  };

  // paths["0"]["0"] = [{points, spawn_step, zone_agent_count}, ...]
  Object.values(paths).forEach((byFloor: any) => {
    if (!byFloor || typeof byFloor !== 'object') return;
    if (Array.isArray(byFloor)) {
      byFloor.forEach(addEntry);
    } else {
      Object.values(byFloor).forEach((entries: any) => {
        if (Array.isArray(entries)) {
          entries.forEach(addEntry);
        } else {
          addEntry(entries);
        }
      });
    }
  });

  return result;
}

export default function PathVisualization({ projectData, simulationResults, onClose }: PathVisualizationProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [zoom,       setZoom]   = useState(1);
  const [offset,     setOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef  = useRef<{ x: number; y: number } | null>(null);

  const cellSize   = projectData?.cell_size  || 10;
  const gridWidth  = projectData?.grid_width  || 80;
  const gridHeight = projectData?.grid_height || 60;

  // Get the flat object list — works for single-building single-floor maps
  const objects: any[] = (() => {
    if (!projectData) return [];
    // buildings[0].layers[0] structure
    if (projectData.buildings?.[0]?.layers?.[0]) return projectData.buildings[0].layers[0];
    // flat objects array
    if (Array.isArray(projectData.objects)) return projectData.objects;
    return [];
  })();

  const allPaths = collectAllPaths(simulationResults?.paths);
  const pathCount = allPaths.length;

  // ── Draw helpers ──────────────────────────────────────────────────────────

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(100,120,150,0.15)'; ctx.lineWidth = 0.5;
    for(let x=0;x<=gridWidth;x+=5){ctx.beginPath();ctx.moveTo(x*cellSize,0);ctx.lineTo(x*cellSize,gridHeight*cellSize);ctx.stroke();}
    for(let y=0;y<=gridHeight;y+=5){ctx.beginPath();ctx.moveTo(0,y*cellSize);ctx.lineTo(gridWidth*cellSize,y*cellSize);ctx.stroke();}
  }, [gridWidth, gridHeight, cellSize]);

  const drawPath = useCallback((ctx: CanvasRenderingContext2D, path: Array<[number,number]>, idx: number) => {
    if (path.length < 2) return;
    const colors = ['#3b82f6','#8b5cf6','#ec4899','#f97316','#10b981','#06b6d4','#f59e0b','#ef4444'];
    const color  = colors[idx % colors.length];
    ctx.save();
    // Draw thin path line — no shadow/glow so it doesn't visually bleed into walls
    ctx.strokeStyle=color; ctx.lineWidth=1.5;
    ctx.lineCap='round'; ctx.lineJoin='round'; ctx.globalAlpha=0.85;
    ctx.beginPath(); ctx.moveTo(path[0][0],path[0][1]);
    for(let i=1;i<path.length;i++) ctx.lineTo(path[i][0],path[i][1]);
    ctx.stroke(); ctx.globalAlpha=1;

    // Start dot
    const [sx,sy] = path[0];
    ctx.fillStyle=color+'40'; ctx.beginPath(); ctx.arc(sx,sy,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=color;      ctx.beginPath(); ctx.arc(sx,sy,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffffff';  ctx.beginPath(); ctx.arc(sx,sy,2.5,0,Math.PI*2); ctx.fill();

    // Arrow at end
    const ex=path[path.length-1][0], ey=path[path.length-1][1];
    const px=path[path.length-2][0], py=path[path.length-2][1];
    const angle=Math.atan2(ey-py,ex-px), as=12;
    ctx.fillStyle=color; ctx.shadowBlur=4; ctx.shadowColor=color;
    ctx.beginPath();
    ctx.moveTo(ex,ey);
    ctx.lineTo(ex-as*Math.cos(angle-Math.PI/6),ey-as*Math.sin(angle-Math.PI/6));
    ctx.lineTo(ex-as*Math.cos(angle+Math.PI/6),ey-as*Math.sin(angle+Math.PI/6));
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
    ctx.restore();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx    = canvas.getContext('2d'); if (!ctx) return;
    canvas.width  = gridWidth  * cellSize;
    canvas.height = gridHeight * cellSize;

    ctx.fillStyle = '#f8f7f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    drawGrid(ctx);
    objects.forEach(obj => drawMapObject(ctx, obj));

    // Draw path_walkable overlay with subtle highlight so safe corridor is visible
    objects.filter((o:any) => o.type === 'path_walkable').forEach((o:any) => {
      ctx.save();
      ctx.fillStyle = 'rgba(74,222,128,0.35)';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.restore();
    });

    if (allPaths.length > 0) {
      allPaths.forEach((path, idx) => drawPath(ctx, path, idx));
    } else {
      ctx.fillStyle = 'rgba(100,116,139,0.7)';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('No evacuation paths recorded', (gridWidth*cellSize)/2, (gridHeight*cellSize)/2);
    }

    ctx.restore();
  }, [gridWidth, gridHeight, cellSize, offset, zoom, drawGrid, drawPath, objects, allPaths]);

  useEffect(() => { draw(); }, [draw]);

  // ── Pan / zoom ─────────────────────────────────────────────────────────────

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Mouse position in CSS pixels relative to the canvas — same space as offset
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => {
      const nz = Math.min(Math.max(prev * delta, 0.15), 10);
      setOffset(o => ({ x: mx-(mx-o.x)*(nz/prev), y: my-(my-o.y)*(nz/prev) }));
      return nz;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPanningRef.current = true;
    panStartRef.current  = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanningRef.current || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPanningRef.current = false;
    panStartRef.current  = null;
    e.currentTarget.style.cursor = 'grab';
  };

  const resetView = () => { setZoom(1); setOffset({ x:0, y:0 }); };

  const handleDownload = () => {
    // Draw the full unzoomed map onto a correctly-sized canvas and download it
    const w   = gridWidth  * cellSize;
    const h   = gridHeight * cellSize;
    const tmp = document.createElement('canvas');
    tmp.width  = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d');
    if (!tctx) return;
    tctx.fillStyle = '#f8f7f4';
    tctx.fillRect(0, 0, w, h);
    drawGrid(tctx);
    objects.forEach(obj => drawMapObject(tctx, obj));
    allPaths.forEach((path, idx) => drawPath(tctx, path, idx));
    const a = document.createElement('a');
    a.download = `evacuation_paths_${Date.now()}.png`;
    a.href = tmp.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden border border-gray-200 flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Evacuation Path Visualization</h2>
            <p className="text-blue-100 text-sm mt-0.5">
              {pathCount > 0
                ? `${pathCount} evacuation path${pathCount !== 1 ? 's' : ''} recorded`
                : 'No paths recorded for this simulation'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition flex items-center gap-2 text-sm">
              <Download className="w-4 h-4"/> Download
            </button>
            <button onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition text-white">
              <X className="w-6 h-6"/>
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-gray-100 relative">
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
            <button onClick={() => setZoom(z => Math.min(z * 1.25, 10))}
              className="w-8 h-8 bg-white border border-gray-300 rounded-lg shadow text-gray-700 hover:bg-gray-50 flex items-center justify-center font-bold text-lg">+</button>
            <div className="w-8 h-8 bg-white border border-gray-300 rounded-lg shadow text-gray-600 flex items-center justify-center text-[10px] font-mono">
              {Math.round(zoom * 100)}%
            </div>
            <button onClick={() => setZoom(z => Math.max(z / 1.25, 0.15))}
              className="w-8 h-8 bg-white border border-gray-300 rounded-lg shadow text-gray-700 hover:bg-gray-50 flex items-center justify-center font-bold text-lg">−</button>
            <button onClick={resetView}
              className="w-8 h-8 bg-white border border-gray-300 rounded-lg shadow text-gray-500 hover:bg-gray-50 flex items-center justify-center text-xs">↺</button>
          </div>

          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-gray-400 bg-white/80 px-3 py-1 rounded-full pointer-events-none z-10">
            Scroll to zoom · Drag to pan
          </p>

          <div className="w-full h-full flex justify-center overflow-hidden">
            <canvas ref={canvasRef}
              className="border border-gray-300 rounded-xl shadow-xl bg-white"
              style={{ cursor: 'grab' }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-center gap-5 text-xs flex-wrap text-gray-600">
            <div className="flex items-center gap-1.5"><div className="w-6 h-1.5 bg-blue-500 rounded"/><span>Path</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow"/><span>Spawn Origin</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-green-500 rounded"/><span>Exit</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-amber-400 rounded"/><span>Stairs</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-sky-400 rounded"/><span>Safe Zone</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-slate-800 rounded"/><span>Wall</span></div>
            <div className="flex items-center gap-1.5"><div className="w-4 h-4 border-2 border-orange-400 rounded"/><span>Queue Zone</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}