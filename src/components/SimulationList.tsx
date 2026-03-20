//SimulationList
import { useState, useEffect } from 'react';
import { pythonSimulationAPI } from '../lib/api';
import { projectAPI } from '../lib/api';
import SimulationPlayback from './SimulationPlayback';
import { Clock, CheckCircle, XCircle, Loader, Eye, Trash2 } from 'lucide-react';

interface Simulation {
  id: string;
  user_id?: string;
  status: 'running' | 'completed' | 'failed';
  project_id?: number; // ✅ Added for playback
  config?: {
    grid_size?: [number, number];
    num_evacuees?: number;
    num_responders?: number;
    disaster_type?: string;
  };
  results?: any;
  created_at: string;
  completed_at?: string | null;
}

export default function SimulationList() {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSim, setSelectedSim] = useState<Simulation | null>(null);
  
  // ✅ NEW: Playback states
  const [playbackSimulation, setPlaybackSimulation] = useState<any | null>(null);
  const [playbackProjectData, setPlaybackProjectData] = useState<any | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState(false);

  useEffect(() => {
    loadSimulations();
    const interval = setInterval(loadSimulations, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSimulations = async () => {
    try {
      const data = await pythonSimulationAPI.getAll();
      setSimulations(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error loading simulations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Load project data and start playback
  const handleViewPlayback = async (sim: any) => {
    if (!sim.project_id) {
      alert('No project data available for this simulation');
      return;
    }

    setLoadingPlayback(true);
    try {
      // Load full project data
      const projectData = await projectAPI.getOne(sim.project_id);
      
      setPlaybackSimulation(sim);
      setPlaybackProjectData(projectData.project_data);
    } catch (error) {
      console.error('Error loading project data:', error);
      alert('Failed to load project data for playback');
    } finally {
      setLoadingPlayback(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Simulations</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {simulations.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <Clock className="w-16 h-16 text-gray-400 mx-auto" />
          </div>
          <p className="text-gray-600 text-lg mb-2">No simulations yet</p>
          <p className="text-gray-500 text-sm">
            Create your first simulation to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {simulations.map((sim) => (
            <div
              key={sim.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(sim.status)}
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        sim.status
                      )}`}
                    >
                      {sim.status.charAt(0).toUpperCase() + sim.status.slice(1)}
                    </span>
                  </div>

                  {sim.config && (
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mt-3">
                      {sim.config.grid_size && (
                        <div>
                          <span className="font-medium">Grid:</span>{' '}
                          {sim.config.grid_size[0]} × {sim.config.grid_size[1]}
                        </div>
                      )}
                      {sim.config.num_evacuees && (
                        <div>
                          <span className="font-medium">Evacuees:</span>{' '}
                          {sim.config.num_evacuees}
                        </div>
                      )}
                      {sim.config.num_responders && (
                        <div>
                          <span className="font-medium">Responders:</span>{' '}
                          {sim.config.num_responders}
                        </div>
                      )}
                      {sim.config.disaster_type && (
                        <div>
                          <span className="font-medium">Type:</span>{' '}
                          {sim.config.disaster_type}
                        </div>
                      )}
                    </div>
                  )}

                  {sim.status === 'completed' && sim.results && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-2">Results:</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Evacuated:</span>{' '}
                          <span className="font-medium text-green-600">
                            {sim.results.evacuated || sim.results.agents_evacuated || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Casualties:</span>{' '}
                          <span className="font-medium text-red-600">
                            {sim.results.casualties || sim.results.agents_trapped || 0}
                          </span>
                        </div>
                        {sim.results.evacuation_time && (
                          <div>
                            <span className="text-gray-600">Evacuation Time:</span>{' '}
                            <span className="font-medium">
                              {sim.results.evacuation_time}s
                            </span>
                          </div>
                        )}
                        {sim.results.exits_count && (
                          <div>
                            <span className="text-gray-600">Exits Used:</span>{' '}
                            <span className="font-medium">
                              {sim.results.exits_count}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-gray-500">
                    {new Date(sim.created_at).toLocaleString()}
                  </div>
                </div>

                {/* ✅ UPDATED: View Playback button */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewPlayback(sim)}
                    disabled={loadingPlayback}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingPlayback ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        View Playback
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Old detail modal (JSON view) - keep for debugging */}
      {selectedSim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                Simulation Details
              </h3>
              <button
                onClick={() => setSelectedSim(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(selectedSim, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* ✅ NEW: Playback Modal */}
      {playbackSimulation && playbackProjectData && (
        <SimulationPlayback
          simulation={playbackSimulation}
          projectData={playbackProjectData}
          onClose={() => {
            setPlaybackSimulation(null);
            setPlaybackProjectData(null);
          }}
        />
      )}
    </div>
  );
}