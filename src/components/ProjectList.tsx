//ProjectList - with simulation progress bar
import { useState, useEffect, useRef } from 'react';
import { projectAPI, simulationAPI } from '../lib/api';
import SimulationResultsModal from './SimulationResultsModal';
import SimulationCreator from './SimulationCreator';
import { T, C } from '../design/DesignTokens';
import {
  Map,
  Loader,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface MapProject {
  id: number;
  name: string;
  description: string;
  grid_width: number;
  grid_height: number;
  cell_size: number;
  building_count: number;
  total_floors: number;
  created_at: string;
  updated_at: string;
}

interface ProjectListProps {
  onOpenEditor?: (projectId: number) => void;
  onRunSimulation?: (projectId: number) => void;
}

// ── Simulation progress overlay ───────────────────────────────────────────────
function SimulationProgress({
  projectName,
  disasterType,
  jobId,
  onCompleted,
}: {
  projectName: string;
  disasterType: string;
  jobId: string;
  onCompleted: (results: any) => void;
}) {
  const [elapsed, setElapsed]   = useState(0);
  const [pct, setPct]           = useState(0);
  const [info, setInfo]         = useState({ evacuated: 0, remaining: 0, queued: 0, total: 0, step: 0 });
  const [phase, setPhase]       = useState<'queued'|'running'|'completed'|'cancelled'|'failed'>('queued');
  const [errMsg, setErrMsg]     = useState<string | null>(null);
  const startRef = useRef(Date.now());

  const fmt = (s: number) => s < 60 ? `${Math.floor(s)}s` : `${Math.floor(s/60)}m ${Math.floor(s%60)}s`;

  const disasterEmoji: Record<string, string> = { fire: '🔥', earthquake: '🌍', bomb: '💣' };

  // Tick elapsed time
  useEffect(() => {
    const id = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 500);
    return () => clearInterval(id);
  }, []);

  // Poll progress endpoint every second
  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      try {
        // Derive API base from Vite env or default to Flask port 5000
        const apiBase = (import.meta.env.VITE_API_URL as string) ?? 
                        (import.meta.env.VITE_PYTHON_API_URL as string) ??
                        `${location.protocol}//${location.hostname}:5000`;
        const res = await fetch(`${apiBase}/api/simulations/progress/${jobId}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setPhase(data.status);
        if (data.progress) {
          setPct(data.progress.pct ?? 0);
          setInfo({
            evacuated: data.progress.evacuated ?? 0,
            remaining: data.progress.remaining ?? 0,
            queued:    data.progress.queued    ?? 0,
            total:     data.progress.total     ?? 0,
            step:      data.progress.step      ?? 0,
          });
        }
        if (data.status === 'completed' && data.results) {
          onCompleted(data.results);
        }
        if (data.status === 'cancelled') {
          setErrMsg('Simulation was cancelled — no results saved.');
          setPhase('cancelled');
          // Auto-dismiss modal after 2 seconds
          setTimeout(() => onCompleted(null), 2000);
          return; // stop polling
        }
        if (data.status === 'failed') {
          setErrMsg(data.error ?? 'Unknown error');
        }
      } catch { /* ignore network blips */ }
    };
    poll(); // immediate first poll
    const id = setInterval(poll, 500);
    return () => clearInterval(id);
  }, [jobId]);

  const eta = pct > 0 && pct < 100
    ? fmt(elapsed / pct * (100 - pct))
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl">
            {disasterEmoji[disasterType] ?? '🚨'}
          </div>
          <div>
            <h3 style={T.pageTitle}>
              {phase === 'queued'    ? 'Starting simulation…' :
               phase === 'running'   ? 'Running Simulation' :
               phase === 'completed' ? 'Simulation Complete!' : 'Simulation Failed'}
            </h3>
            <p className="mt-0.5" style={{...T.body, color: C.inkMuted}}>{projectName} · {disasterType.toUpperCase()}</p>
          </div>
        </div>

        {errMsg && (
          <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-xl p-3">{errMsg}</div>
        )}

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>
              {phase === 'queued' ? 'Queued — starting soon…' :
               phase === 'running' ? `Step ${info.step.toLocaleString()} / pathfinding` :
               phase === 'completed' ? 'Done!' : ''}
            </span>
            <span className="font-mono" style={T.sectionHeader}>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: phase === 'completed'
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
              }}
            />
          </div>
        </div>



        {/* Time row */}
        <div className="flex justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="font-mono" style={T.sectionHeader}>{fmt(elapsed)}</span>
            <span>elapsed</span>
          </div>
          {eta && phase === 'running' && (
            <div className="text-gray-400">ETA ~{eta}</div>
          )}
        </div>

        {phase === 'completed' ? (
          <div className="text-center text-green-600 font-semibold text-sm">
            ✅ Results loading…
          </div>
        ) : phase === 'cancelled' ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-orange-400">
            <span>⛔ Simulation cancelled — no results saved.</span>
          </div>
        ) : phase === 'failed' ? null : (
          <div className="space-y-3">
            <p className="text-center" style={T.meta}>
              Progress updates every second.
            </p>
            <button
              onClick={async () => {
                try {
                  const apiBase = (import.meta.env.VITE_API_URL as string) ??
                                  (import.meta.env.VITE_PYTHON_API_URL as string) ??
                                  `${location.protocol}//${location.hostname}:5000`;
                  await fetch(`${apiBase}/api/simulations/cancel/${jobId}`, {
                    method: 'POST', credentials: 'include',
                  });
                  // Dismiss modal immediately on user-initiated cancel
                  setTimeout(() => onCompleted(null), 1500);
                } catch { /* ignore */ }
              }}
              className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition text-sm font-medium"
            >
              ⛔ Cancel Simulation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProjectList({ onOpenEditor, onRunSimulation }: ProjectListProps) {
  const [projects, setProjects]             = useState<MapProject[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<MapProject | null>(null);
  const onCompletedHandlerRef = useRef<((r: any) => void) | null>(null);
  const [runningSimulation, setRunningSimulation] = useState<{ id: number; name: string; disaster: string; jobId: string } | null>(null);
  const [selectedSimulation, setSelectedSimulation] = useState<any | null>(null);
  const [disasterTypes, setDisasterTypes]   = useState<Record<number, 'fire' | 'earthquake' | 'bomb'>>({});
  const [showEditor, setShowEditor]         = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectAPI.getAll();
      setProjects(data || []);
      const init: Record<number, 'fire' | 'earthquake' | 'bomb'> = {};
      data.forEach((p: MapProject) => { init[p.id] = 'fire'; });
      setDisasterTypes(init);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setDisasterType = (id: number, type: 'fire' | 'earthquake' | 'bomb') =>
    setDisasterTypes(prev => ({ ...prev, [id]: type }));

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete project "${name}"?\n\nThis action cannot be undone.`)) return;
    try {
      await projectAPI.delete(id);
      setProjects(p => p.filter(x => x.id !== id));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleRunSimulation = async (project: MapProject) => {
    if (onRunSimulation) { onRunSimulation(project.id); return; }

    const disasterType = disasterTypes[project.id] || 'fire';
    try {
      const fullProject = await projectAPI.getOne(project.id);

      // Start simulation — returns job_id immediately (202 Accepted)
      const startData = await simulationAPI.run({
        project_id: project.id,
        disaster_type: disasterType,
        max_steps: 10000,
      }) as any;
      if (!startData.job_id) throw new Error(startData.error || 'No job_id returned');

      const jobId: string = startData.job_id;
      setRunningSimulation({ id: project.id, name: project.name, disaster: disasterType, jobId });

      // onCompleted is called by SimulationProgress when polling detects status=completed
      const handleCompleted = async (results: any) => {
        if (!results) { setRunningSimulation(null); return; }
        // Close progress overlay first, reload projects, THEN show modal
        // so the re-render from loadProjects doesn't race with the modal state
        setRunningSimulation(null);
        await loadProjects();
        const simulationData = {
          id: Date.now(),
          project_id: project.id,
          project_name: project.name,
          project_data: fullProject.project_data,
          status: 'completed',
          steps: results.steps || 0,
          elapsed_s: results.elapsed_s || 0,
          evacuation_time: results.evacuation_time?.toString() || '0',
          agents_spawned: results.agents_spawned || 0,
          agents_evacuated: results.agents_evacuated || 0,
          agents_trapped: results.agents_trapped || 0,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          results: { ...results, paths: results.paths || {} },
          config: { max_steps: 10000, disaster_type: disasterType },
        };
        setSelectedSimulation(simulationData);
      };

      // Store handler in ref so it's available synchronously (no render gap)
      onCompletedHandlerRef.current = handleCompleted;

    } catch (err: any) {
      setRunningSimulation(null);
      alert(`Failed to start simulation: ${err.message}`);
    }
  };

  const handleOpenEditor = (id: number) => {
    if (onOpenEditor) { onOpenEditor(id); return; }
    setEditingProjectId(id);
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingProjectId(null);
    loadProjects();
  };

  const formatDate = (ds: string) => {
    const d = new Date(ds), now = new Date();
    const diff = now.getTime() - d.getTime();
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), day = Math.floor(diff / 86400000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (day < 7) return `${day}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (showEditor) {
    return (
      <div className="relative w-full h-screen">
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={handleCloseEditor}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900/95 hover:bg-slate-800 text-white rounded-lg transition shadow-lg backdrop-blur-xl border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </button>
        </div>
        <SimulationCreator initialProjectId={editingProjectId} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      {/* Progress overlay — shown while simulation is running */}
      {runningSimulation && (
        <SimulationProgress
          projectName={runningSimulation.name}
          disasterType={runningSimulation.disaster}
          jobId={runningSimulation.jobId}
          onCompleted={onCompletedHandlerRef.current ?? (() => setRunningSimulation(null))}
        />
      )}

      <div className="bg-white rounded-xl shadow-lg">
        {/* Header */}
        <div className="border-b border-gray-200 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 style={T.pageTitle}>Map Projects</h2>
            <p className="mt-1" style={{...T.body, color: C.inkMuted}}>
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} saved
            </p>
          </div>
          <button
            onClick={loadProjects}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            <Loader className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mx-8 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="p-8">
          {projects.length === 0 ? (
            <div className="text-center py-16">
              <Map className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h3 className="mb-2" style={T.sectionHeader}>No Projects Yet</h3>
              <p className="mb-6" style={{...T.body, color: C.inkMuted}}>Create your first evacuation map to get started</p>
              <button
                onClick={() => handleOpenEditor(-1)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                <Map className="w-5 h-5" />
                Create New Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="border border-gray-200 rounded-xl hover:shadow-xl transition-all duration-200 overflow-hidden bg-gradient-to-br from-white to-gray-50"
                >
                  {/* Card header */}
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                    <h3 className="text-white truncate" style={T.sectionHeader}>{project.name}</h3>
                    {project.description && (
                      <p className="text-blue-100 mt-1 line-clamp-2" style={T.body}>{project.description}</p>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><div className="text-gray-400 text-xs">Grid</div><div className="font-semibold">{project.grid_width} × {project.grid_height}m</div></div>
                      <div><div className="text-gray-400 text-xs">Buildings</div><div className="font-semibold">{project.building_count}</div></div>
                      <div><div className="text-gray-400 text-xs">Floors</div><div className="font-semibold">{project.total_floors}</div></div>
                      <div><div className="text-gray-400 text-xs">Updated</div><div className="font-semibold text-xs">{formatDate(project.updated_at)}</div></div>
                    </div>

                    {/* Disaster selector */}
                    <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-[10px] uppercase tracking-widest" style={T.pageTitle}>Disaster Type</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { key: 'fire',       emoji: '🔥', label: 'Fire'   },
                          { key: 'earthquake', emoji: '🌍', label: 'Quake'  },
                          { key: 'bomb',       emoji: '💣', label: 'Bomb'   },
                        ] as const).map(({ key, emoji, label }) => (
                          <button
                            key={key}
                            onClick={() => setDisasterType(project.id, key)}
                            className={`py-2 rounded-lg border-2 transition text-center ${
                              (disasterTypes[project.id] || 'fire') === key
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-white hover:border-gray-300 text-gray-500'
                            }`}
                          >
                            <div className="text-lg">{emoji}</div>
                            <div className="text-[10px] font-bold mt-0.5">{label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={() => handleOpenEditor(project.id)}
                        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm"
                      >
                        📝 Open in Editor
                      </button>

                      <button
                        onClick={() => handleRunSimulation(project)}
                        disabled={!!runningSimulation}
                        className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
                      >
                        {runningSimulation?.id === project.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader className="w-4 h-4 animate-spin" /> Running…
                          </span>
                        ) : '▶️ Run Simulation'}
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedProject(project)}
                          className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-xs font-medium"
                        >
                          👁️ Details
                        </button>
                        <button
                          onClick={() => handleDelete(project.id, project.name)}
                          className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition text-xs font-medium"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selectedProject && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedProject(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="mb-4" style={T.pageTitle}>{selectedProject.name}</h3>
            {selectedProject.description && <p className="mb-4" style={{...T.body, color: C.inkMuted}}>{selectedProject.description}</p>}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div className="bg-gray-50 p-3 rounded-lg"><div className="text-gray-500 text-xs mb-1">Grid size</div><div className="font-semibold">{selectedProject.grid_width} × {selectedProject.grid_height} metres</div></div>
              <div className="bg-gray-50 p-3 rounded-lg"><div className="text-gray-500 text-xs mb-1">Cell size</div><div className="font-semibold">{selectedProject.cell_size} px/m</div></div>
              <div className="bg-gray-50 p-3 rounded-lg"><div className="text-gray-500 text-xs mb-1">Created</div><div className="font-semibold">{new Date(selectedProject.created_at).toLocaleDateString()}</div></div>
              <div className="bg-gray-50 p-3 rounded-lg"><div className="text-gray-500 text-xs mb-1">Last updated</div><div className="font-semibold">{formatDate(selectedProject.updated_at)}</div></div>
            </div>
            <button onClick={() => setSelectedProject(null)} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition text-sm font-medium">Close</button>
          </div>
        </div>
      )}

      {selectedSimulation && (
        <SimulationResultsModal
          simulation={selectedSimulation}
          onClose={() => setSelectedSimulation(null)}
        />
      )}
    </>
  );
}