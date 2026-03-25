// SimulationList.tsx
import { useState, useEffect } from 'react';
import { pythonSimulationAPI, projectAPI } from '../lib/api';
import SimulationPlayback from './SimulationPlayback';
import PathVisualization from './PathVisualization';
import { Clock, CheckCircle, XCircle, Loader, Eye, Trash2, Route } from 'lucide-react';

const API_BASE =
  (import.meta.env.VITE_API_URL as string) ??
  (import.meta.env.VITE_PYTHON_API_URL as string) ??
  `${location.protocol}//${location.hostname}:5000`;

interface Simulation {
  id: string;
  user_id?: string;
  status: 'running' | 'completed' | 'failed';
  project_id?: number;
  project_name?: string;
  config?: {
    grid_size?: [number, number];
    num_evacuees?: number;
    num_responders?: number;
    disaster_type?: string;
  };
  results?: any;
  created_at: string;
  completed_at?: string | null;
  elapsed_s?: number;
  agents_spawned?: number;
  agents_evacuated?: number;
  agents_trapped?: number;
}

const disasterEmoji: Record<string, string> = { fire: '🔥', earthquake: '🌍', bomb: '💣' };

export default function SimulationList() {
  const [simulations,       setSimulations]       = useState<Simulation[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState<string | null>(null);
  const [deletingId,        setDeletingId]        = useState<string | null>(null);
  const [loadingPlayback,   setLoadingPlayback]   = useState<string | null>(null); // sim id

  // Playback
  const [playbackSim,       setPlaybackSim]       = useState<any | null>(null);
  const [playbackProject,   setPlaybackProject]   = useState<any | null>(null);

  // Path visualization
  const [pathSim,           setPathSim]           = useState<any | null>(null);
  const [pathProject,       setPathProject]       = useState<any | null>(null);

  useEffect(() => {
    loadSimulations();
    const iv = setInterval(loadSimulations, 10000);
    return () => clearInterval(iv);
  }, []);

  const loadSimulations = async () => {
    try {
      const data = await pythonSimulationAPI.getAll();
      setSimulations(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Load project + open playback ─────────────────────────────────────────
  const handlePlayback = async (sim: Simulation) => {
    if (!sim.project_id) { alert('No project linked to this simulation.'); return; }
    setLoadingPlayback(sim.id + '_play');
    try {
      const proj = await projectAPI.getOne(sim.project_id);
      // Merge top-level results fields if nested
      const merged = {
        ...sim,
        results: {
          ...(sim.results || {}),
          paths: sim.results?.paths || {},
          disaster_type: sim.config?.disaster_type || sim.results?.disaster_type || 'fire',
        },
        project_name: sim.project_name || proj.name,
      };
      setPlaybackSim(merged);
      setPlaybackProject(proj.project_data);
    } catch { alert('Failed to load project data.'); }
    finally { setLoadingPlayback(null); }
  };

  // ── Load project + open path visualization ───────────────────────────────
  const handleViewPaths = async (sim: Simulation) => {
    if (!sim.project_id) { alert('No project linked to this simulation.'); return; }
    setLoadingPlayback(sim.id + '_path');
    try {
      const proj = await projectAPI.getOne(sim.project_id);
      setPathSim(sim.results || sim);
      setPathProject(proj.project_data);
    } catch { alert('Failed to load project data.'); }
    finally { setLoadingPlayback(null); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (sim: Simulation) => {
    if (!confirm(`Delete simulation from ${new Date(sim.created_at).toLocaleString()}?\nThis cannot be undone.`)) return;
    setDeletingId(sim.id);
    try {
      const res = await fetch(`${API_BASE}/api/simulations/${sim.id}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (res.ok) setSimulations(prev => prev.filter(s => s.id !== sim.id));
      else alert('Failed to delete simulation.');
    } catch { alert('Network error.'); }
    finally { setDeletingId(null); }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const statusIcon = (s: string) => {
    if (s==='running')   return <Loader className="w-4 h-4 text-blue-500 animate-spin"/>;
    if (s==='completed') return <CheckCircle className="w-4 h-4 text-green-500"/>;
    if (s==='failed')    return <XCircle className="w-4 h-4 text-red-500"/>;
    return <Clock className="w-4 h-4 text-gray-400"/>;
  };

  const statusBadge = (s: string) => {
    if (s==='running')   return 'bg-blue-100 text-blue-700';
    if (s==='completed') return 'bg-green-100 text-green-700';
    if (s==='failed')    return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-600';
  };

  const fmtTime = (s: string) => new Date(s).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader className="w-8 h-8 animate-spin text-blue-600"/>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Simulations</h2>
          <p className="text-gray-500 text-sm mt-0.5">{simulations.length} simulation{simulations.length!==1?'s':''} saved</p>
        </div>
        <button onClick={loadSimulations}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center gap-1.5">
          <Loader className="w-3.5 h-3.5"/> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {simulations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
          <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4"/>
          <p className="text-gray-600 font-medium">No simulations yet</p>
          <p className="text-gray-400 text-sm mt-1">Run a simulation from the Projects page to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {simulations.map(sim => {
            const dtype  = sim.config?.disaster_type || sim.results?.disaster_type || 'fire';

            const isLoadingPlay = loadingPlayback === sim.id + '_play';
            const isLoadingPath = loadingPlayback === sim.id + '_path';
            const isDeleting    = deletingId === sim.id;

            return (
              <div key={sim.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4">

                  {/* Left: info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Title row */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {statusIcon(sim.status)}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(sim.status)}`}>
                        {sim.status.charAt(0).toUpperCase()+sim.status.slice(1)}
                      </span>
                      <span className="text-base font-semibold text-gray-700">
                        {disasterEmoji[dtype]} {dtype.charAt(0).toUpperCase()+dtype.slice(1)} Drill
                      </span>
                      {sim.project_name && (
                        <span className="text-xs text-gray-400 truncate">· {sim.project_name}</span>
                      )}
                    </div>



                    {/* Config row */}
                    {sim.config && (
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        {sim.config.grid_size && <span>Grid: {sim.config.grid_size[0]}×{sim.config.grid_size[1]}</span>}
                        {sim.config.num_evacuees && <span>· {sim.config.num_evacuees} evacuees configured</span>}
                      </div>
                    )}

                    <div className="text-xs text-gray-400">{fmtTime(sim.created_at)}</div>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {/* View Playback */}
                    <button
                      onClick={() => handlePlayback(sim)}
                      disabled={!!loadingPlayback || isDeleting}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition text-sm font-medium"
                    >
                      {isLoadingPlay
                        ? <><Loader className="w-3.5 h-3.5 animate-spin"/> Loading…</>
                        : <><Eye className="w-3.5 h-3.5"/> Playback</>}
                    </button>

                    {/* View Paths */}
                    <button
                      onClick={() => handleViewPaths(sim)}
                      disabled={!!loadingPlayback || isDeleting || sim.status !== 'completed'}
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition text-sm font-medium"
                      title={sim.status !== 'completed' ? 'Only available for completed simulations' : undefined}
                    >
                      {isLoadingPath
                        ? <><Loader className="w-3.5 h-3.5 animate-spin"/> Loading…</>
                        : <><Route className="w-3.5 h-3.5"/> View Paths</>}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(sim)}
                      disabled={!!loadingPlayback || isDeleting}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 border border-red-200 rounded-lg transition text-sm font-medium"
                    >
                      {isDeleting
                        ? <><Loader className="w-3.5 h-3.5 animate-spin"/> Deleting…</>
                        : <><Trash2 className="w-3.5 h-3.5"/> Delete</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Playback modal */}
      {playbackSim && playbackProject && (
        <SimulationPlayback
          simulation={playbackSim}
          projectData={playbackProject}
          onClose={() => { setPlaybackSim(null); setPlaybackProject(null); }}
        />
      )}

      {/* Path visualization modal */}
      {pathSim && pathProject && (
        <PathVisualization
          simulationResults={pathSim}
          projectData={pathProject}
          onClose={() => { setPathSim(null); setPathProject(null); }}
        />
      )}
    </div>
  );
}