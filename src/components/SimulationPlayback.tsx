// SimulationPlayback.tsx
import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, X } from 'lucide-react';

interface SimulationPlaybackProps {
  simulation: any;
  projectData: any;
  onClose: () => void;
}

interface Agent {
  id: number;
  path: Array<[number, number]>;
  pathIndex: number;
  position: [number, number];
  velocity: [number, number];
  color: string;
  floor: number;
  evacuated: boolean;
  targetWaypoint: [number, number] | null;
  inSafeZone: boolean;
  safeZoneTarget: [number, number] | null;
  safeZoneId: string | null;
  spawnDelay: number;   // seconds before agent appears
  spawned: boolean;     // false = waiting to appear
}

// ── Draw a single map object onto a canvas context ────────────────────────────
function drawMapObject(ctx: CanvasRenderingContext2D, obj: any) {
  const t = obj.type;

  // ── Line / Room wall ───────────────────────────────────────────────────────
  if (t === 'line') {
    const x1 = obj.x1 ?? 0, y1 = obj.y1 ?? 0;
    const x2 = obj.x2 ?? 0, y2 = obj.y2 ?? 0;
    const isRoomWall = obj.is_room_wall === true;

    ctx.save();
    ctx.strokeStyle = isRoomWall ? '#1e293b' : '#94a3b8';
    ctx.lineWidth   = isRoomWall ? (obj.thickness ?? 7) : (obj.thickness ?? 3);
    ctx.lineCap     = isRoomWall ? 'square' : 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur  = isRoomWall ? 3 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // ── Legacy wall (solid fill for old maps) ──────────────────────────────────
  if (t === 'wall') {
    ctx.save();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 6;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.strokeRect(obj.x + 3, obj.y + 3, obj.w - 6, obj.h - 6);
    ctx.restore();
    return;
  }

  // ── Exit ───────────────────────────────────────────────────────────────────
  if (t === 'exit') {
    ctx.save();
    ctx.fillStyle = 'rgba(34,197,94,0.15)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    if (obj.w > 20) {
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', obj.x + obj.w / 2, obj.y + obj.h / 2);
    }
    ctx.restore();
    return;
  }

  // ── Safe zone ──────────────────────────────────────────────────────────────
  if (t === 'safezone') {
    ctx.save();
    // Cross-hatch fill
    ctx.fillStyle = 'rgba(14,165,233,0.08)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = 'rgba(14,165,233,0.25)';
    ctx.lineWidth = 0.5;
    const sp = 12;
    for (let x = obj.x; x < obj.x + obj.w; x += sp) {
      ctx.beginPath(); ctx.moveTo(x, obj.y); ctx.lineTo(x, obj.y + obj.h); ctx.stroke();
    }
    for (let y = obj.y; y < obj.y + obj.h; y += sp) {
      ctx.beginPath(); ctx.moveTo(obj.x, y); ctx.lineTo(obj.x + obj.w, y); ctx.stroke();
    }
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    ctx.fillStyle = '#0ea5e9';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛶ SAFE ZONE', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── NPC spawn zone ─────────────────────────────────────────────────────────
  if (t === 'npc') {
    ctx.save();
    ctx.fillStyle = 'rgba(251,191,36,0.1)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPAWN', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── NPC count zone (sequential queue spawner) ─────────────────────────────
  if (t === 'npc_count') {
    ctx.save();
    ctx.fillStyle = 'rgba(249,115,22,0.1)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const qLabel = obj.agent_count != null ? `▶ ${obj.agent_count}` : '▶ QUEUE';
    ctx.fillText(qLabel, obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── Concrete stairs ────────────────────────────────────────────────────────
  if (t === 'concrete_stairs' || t === 'stairs') {
    ctx.save();
    ctx.fillStyle = 'rgba(245,158,11,0.1)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    // Step lines
    const steps = Math.max(3, Math.floor(obj.h / 8));
    ctx.strokeStyle = 'rgba(245,158,11,0.4)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i < steps; i++) {
      const y = obj.y + (obj.h / steps) * i;
      ctx.beginPath(); ctx.moveTo(obj.x, y); ctx.lineTo(obj.x + obj.w, y); ctx.stroke();
    }
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬍ STAIRS', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── Fire ladder ────────────────────────────────────────────────────────────
  if (t === 'fire_ladder') {
    ctx.save();
    ctx.fillStyle = 'rgba(239,68,68,0.08)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    ctx.setLineDash([]);
    // Ladder rails
    const rail = obj.w * 0.25;
    ctx.strokeStyle = 'rgba(239,68,68,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(obj.x + rail, obj.y + 4); ctx.lineTo(obj.x + rail, obj.y + obj.h - 4);
    ctx.moveTo(obj.x + obj.w - rail, obj.y + 4); ctx.lineTo(obj.x + obj.w - rail, obj.y + obj.h - 4);
    ctx.stroke();
    const rungs = Math.max(3, Math.floor(obj.h / 10));
    for (let i = 0; i <= rungs; i++) {
      const y = obj.y + 4 + ((obj.h - 8) / rungs) * i;
      ctx.beginPath(); ctx.moveTo(obj.x + rail, y); ctx.lineTo(obj.x + obj.w - rail, y); ctx.stroke();
    }
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥 LADDER', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }

  // ── Fence ──────────────────────────────────────────────────────────────────
  if (t === 'fence') {
    ctx.save();
    ctx.fillStyle = 'rgba(180,120,40,0.15)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    const postSp = Math.max(12, 18);
    ctx.strokeStyle = 'rgba(251,191,36,0.8)';
    ctx.lineWidth = 1.5;
    for (let x = obj.x; x <= obj.x + obj.w; x += postSp) {
      ctx.beginPath(); ctx.moveTo(x, obj.y); ctx.lineTo(x, obj.y + obj.h); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(146,64,14,0.9)';
    ctx.lineWidth = 1;
    [0.3, 0.7].forEach(r => {
      const y = obj.y + obj.h * r;
      ctx.beginPath(); ctx.moveTo(obj.x, y); ctx.lineTo(obj.x + obj.w, y); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(146,64,14,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    ctx.restore();
    return;
  }

  // ── Gate ───────────────────────────────────────────────────────────────────
  if (t === 'gate') {
    const open = obj.is_open !== false;
    ctx.save();
    ctx.fillStyle = open ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeStyle = open ? '#10b981' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    ctx.fillStyle = open ? '#10b981' : '#ef4444';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'OPEN' : 'CLOSED', obj.x + obj.w / 2, obj.y + obj.h / 2);
    ctx.restore();
    return;
  }
}

export default function SimulationPlayback({ simulation, projectData, onClose }: SimulationPlaybackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [initialAgents, setInitialAgents] = useState<Agent[]>([]);
  const [simulationTime, setSimulationTime] = useState(0);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const cellSize = projectData?.cell_size || 10;
  const disasterType = simulation?.results?.disaster_type || 'fire';

  const MOVEMENT_SPEED = 3.4;
  const ANIMATION_SPEED = MOVEMENT_SPEED * cellSize;
  const WAYPOINT_LOOKAHEAD = 3;

  // Initialize agents from paths
  useEffect(() => {
    if (!simulation?.results?.paths) return;

    const newAgents: Agent[] = [];
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];

    // steps-per-second conversion: simulation runs at ~60 steps/s, playback at real time
    // We'll convert spawn_step to a real-time delay using simulationStepsPerSecond
    const STEPS_PER_SECOND = 60;

    Object.entries(simulation.results.paths).forEach(([, floorData]: [string, any]) => {
      if (typeof floorData === 'object' && !Array.isArray(floorData)) {
        Object.entries(floorData).forEach(([floorIdx, paths]: [string, any]) => {
          const floor = parseInt(floorIdx);
          if (Array.isArray(paths)) {
            paths.forEach((entry: any) => {
              // entry is {points: [...], spawn_step: N}  OR legacy flat array
              const path: Array<[number,number]> = Array.isArray(entry) ? entry : entry.points;
              const spawnStep: number = Array.isArray(entry) ? 0 : (entry.spawn_step ?? 0);
              const spawnDelay: number = spawnStep / STEPS_PER_SECOND; // seconds

              if (!Array.isArray(path) || path.length < 2) return;
              const spawnPos = path[0];
              if (!spawnPos || spawnPos.length !== 2) return;

              newAgents.push({
                id: newAgents.length,
                path,
                pathIndex: 0,
                position: [spawnPos[0], spawnPos[1]],
                velocity: [0, 0],
                targetWaypoint: path[1] || path[0],
                color: colors[newAgents.length % colors.length],
                floor,
                evacuated: false,
                inSafeZone: false,
                safeZoneTarget: null,
                safeZoneId: null,
                spawnDelay,      // seconds before this agent becomes visible
                spawned: spawnDelay === 0,  // immediately visible if no delay
              });
            });
          }
        });
      }
    });

    setAgents(newAgents);
    setInitialAgents(JSON.parse(JSON.stringify(newAgents)));
  }, [simulation?.results?.paths]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || agents.length === 0) return;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (delta > 0 && delta < 100) {
        setAgents(prevAgents => {
          const buildings = projectData?.buildings || [];
          const currentLayer = buildings[0]?.layers?.[currentFloor] || [];
          const safeZones = currentLayer.filter((obj: any) => obj.type === 'safezone');
          const safeZoneAgentCounts: { [key: string]: number } = {};
          prevAgents.forEach(a => {
            if (a.inSafeZone && a.safeZoneId) {
              safeZoneAgentCounts[a.safeZoneId] = (safeZoneAgentCounts[a.safeZoneId] || 0) + 1;
            }
          });

          return prevAgents.map(agent => {
            // Handle delayed spawn — agent is invisible until spawnDelay elapses
            if (!agent.spawned) {
              const remaining = agent.spawnDelay - delta / 1000;
              if (remaining > 0) return { ...agent, spawnDelay: remaining };
              return { ...agent, spawnDelay: 0, spawned: true };
            }

            if (agent.evacuated && !agent.safeZoneTarget) return agent;

            // Earthquake safe zone behavior
            if (disasterType === 'earthquake' && safeZones.length > 0) {
              for (const sz of safeZones) {
                const inside = (
                  agent.position[0] >= sz.x && agent.position[0] <= sz.x + sz.w &&
                  agent.position[1] >= sz.y && agent.position[1] <= sz.y + sz.h
                );
                if (inside) {
                  const zoneId = `${sz.x}-${sz.y}`;
                  if (!agent.inSafeZone) {
                    const idx = safeZoneAgentCounts[zoneId] || 0;
                    safeZoneAgentCounts[zoneId] = idx + 1;
                    const spacing = Math.max(3, 8 - Math.floor((idx / (sz.w * sz.h / 100))));
                    const margin = 15;
                    const cols = Math.max(1, Math.floor((sz.w - 2 * margin) / spacing));
                    const gx = sz.x + margin + (idx % cols) * spacing;
                    const gy = sz.y + margin + Math.floor(idx / cols) * spacing;
                    return { ...agent, inSafeZone: true, safeZoneId: zoneId, safeZoneTarget: [gx, gy] };
                  }
                  if (agent.safeZoneTarget) {
                    const [tx, ty] = agent.safeZoneTarget;
                    const dx = tx - agent.position[0], dy = ty - agent.position[1];
                    const dist = Math.hypot(dx, dy);
                    const dt = delta / 1000;
                    if (dist > 3) {
                      return {
                        ...agent,
                        position: [agent.position[0] + (dx / dist) * 15 * dt, agent.position[1] + (dy / dist) * 15 * dt],
                        velocity: [(dx / dist) * 15, (dy / dist) * 15],
                      };
                    }
                    return {
                      ...agent,
                      position: [
                        Math.max(sz.x + 10, Math.min(agent.position[0], sz.x + sz.w - 10)),
                        Math.max(sz.y + 10, Math.min(agent.position[1], sz.y + sz.h - 10)),
                      ],
                      evacuated: true,
                    };
                  }
                }
              }
            }

            // Reached end of path
            if (agent.pathIndex >= agent.path.length - 1) {
              return disasterType === 'fire' || disasterType === 'bomb'
                ? { ...agent, evacuated: true }
                : agent;
            }

            const dt = delta / 1000;
            const pos = agent.position;

            // Look-ahead waypoint selection
            let target = agent.path[agent.pathIndex + 1] || agent.path[agent.pathIndex];
            for (let i = 1; i <= WAYPOINT_LOOKAHEAD; i++) {
              const ni = agent.pathIndex + i;
              if (ni >= agent.path.length) break;
              if (Math.hypot(agent.path[ni][0] - pos[0], agent.path[ni][1] - pos[1]) < 30) {
                target = agent.path[ni];
              } else break;
            }

            const dx = target[0] - pos[0], dy = target[1] - pos[1];
            const dist = Math.hypot(dx, dy);

            if (dist < 8) {
              const ni = Math.min(agent.path.findIndex(p => p === target), agent.path.length - 1);
              return { ...agent, pathIndex: ni, targetWaypoint: agent.path[Math.min(ni + 1, agent.path.length - 1)] };
            }

            // Social avoidance
            let avX = 0, avY = 0;
            prevAgents.forEach(other => {
              if (other.id === agent.id || other.evacuated || other.floor !== agent.floor) return;
              const odx = pos[0] - other.position[0], ody = pos[1] - other.position[1];
              const od = Math.hypot(odx, ody);
              if (od < 12 && od > 0) {
                const s = (12 - od) / 12;
                avX += (odx / od) * s * 8;
                avY += (ody / od) * s * 8;
              }
            });

            const dvx = (dx / dist) * ANIMATION_SPEED + avX;
            const dvy = (dy / dist) * ANIMATION_SPEED + avY;
            const sm = 0.5;
            const nvx = agent.velocity[0] * (1 - sm) + dvx * sm;
            const nvy = agent.velocity[1] * (1 - sm) + dvy * sm;

            return {
              ...agent,
              position: [pos[0] + nvx * dt, pos[1] + nvy * dt],
              velocity: [nvx, nvy],
            };
          });
        });
        setSimulationTime(t => t + delta / 1000);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isPlaying, agents.length, disasterType, currentFloor]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White paper background (matches the editor)
    ctx.fillStyle = '#f8f7f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    const buildings = projectData?.buildings || [];
    const currentLayer = buildings[0]?.layers?.[currentFloor] || [];

    // Draw all map objects using the shared drawMapObject function
    currentLayer.forEach((obj: any) => drawMapObject(ctx, obj));

    // Draw agents
    agents
      .filter(a => {
        if (!a.spawned) return false;          // not yet visible
        if (a.floor !== currentFloor) return false;
        if ((disasterType === 'fire' || disasterType === 'bomb') && a.evacuated) return false;
        return true;
      })
      .forEach(agent => {
        const [x, y] = agent.position;
        const [vx, vy] = agent.velocity;
        const speed = Math.hypot(vx, vy);

        // Direction indicator
        if (speed > 0.1) {
          ctx.save();
          ctx.strokeStyle = agent.color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (vx / speed) * 10, y + (vy / speed) * 10);
          ctx.stroke();
          ctx.restore();
        }

        // Agent dot
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = agent.inSafeZone ? '#22c55e' : agent.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

    ctx.restore();
  }, [agents, currentFloor, zoom, offset, projectData, disasterType]);

  const handleReset = () => {
    setIsPlaying(false);
    setSimulationTime(0);
    lastTimeRef.current = 0;
    setAgents(JSON.parse(JSON.stringify(initialAgents)));
  };

  const agentsMoving = agents.filter(a => a.spawned && a.floor === currentFloor && !a.evacuated).length;
  const evacuated    = agents.filter(a => a.spawned && a.evacuated).length;
  const inSafeZone   = agents.filter(a => a.spawned && a.inSafeZone).length;
  const total        = agents.filter(a => a.spawned).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-7xl w-full h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Simulation Playback</h2>
            <p className="text-blue-100 text-sm mt-1">
              {simulation.project_name} • {disasterType.toUpperCase()} Drill • Floor {currentFloor + 1}
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-blue-800 rounded-lg p-2 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative bg-gray-800">
          <canvas ref={canvasRef} width={1200} height={800} className="w-full h-full" />

          {/* Stats */}
          <div className="absolute top-4 left-4 bg-black/75 rounded-lg p-4 text-white space-y-2 text-sm">
            <div><span className="text-gray-400">Time: </span><span className="font-semibold">{simulationTime.toFixed(1)}s</span></div>
            <div><span className="text-gray-400">Moving: </span><span className="font-semibold text-blue-400">{agentsMoving}</span></div>
            {disasterType === 'earthquake'
              ? <div><span className="text-gray-400">In Safe Zone: </span><span className="font-semibold text-green-400">{inSafeZone}/{total}</span></div>
              : <div><span className="text-gray-400">Evacuated: </span><span className="font-semibold text-green-400">{evacuated}/{total}</span></div>
            }
          </div>

          {/* Legend */}
          <div className="absolute top-4 right-4 bg-black/75 rounded-lg p-3 text-white space-y-1.5 text-xs">
            <div className="flex items-center gap-2"><div className="w-10 h-1.5 bg-slate-800 rounded" /><span>Room Wall</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-green-500" /><span>Exit</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-amber-400" /><span>Concrete Stairs</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-red-400 border-dashed" /><span>Fire Ladder</span></div>
            {disasterType === 'earthquake' && <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-sky-400" /><span>Safe Zone</span></div>}
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white" /><span>Agent</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white" /><span>Safe</span></div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 px-6 py-4 rounded-b-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-3 rounded-lg transition text-white ${isPlaying ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={handleReset} className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              <RotateCcw className="w-5 h-5" />
            </button>
            <span className="text-white text-sm ml-2">{isPlaying ? 'Playing' : 'Paused'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.3))} className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-white text-sm w-16 text-center">{(zoom * 100).toFixed(0)}%</span>
            <button onClick={() => setZoom(z => Math.min(z * 1.2, 3))} className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}