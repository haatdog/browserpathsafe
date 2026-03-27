// SimulationResultsModal
import React, { useState, useEffect } from 'react';
import { X, Play, Clock, Users, CheckCircle, XCircle, TrendingUp, Map as MapIcon, AlertCircle } from 'lucide-react';
import SimulationPlayback from './SimulationPlayback';
import PathVisualization from './PathVisualization';
import { T, C } from '../design/DesignTokens';

export interface SimulationResultsModalProps {
  simulation: any;
  onClose: () => void;
}

const SimulationResultsModal: React.FC<SimulationResultsModalProps> = ({ simulation, onClose }) => {
  const [showPlayback, setShowPlayback] = useState(false);
  const [showPathViz,  setShowPathViz]  = useState(false);

  useEffect(() => {
    console.log('📊 SimulationResultsModal mounted with data:', simulation);
  }, [simulation]);

  const stats = [
    { label: 'Simulation Time',        value: `${simulation.evacuation_time || '0'}s`, icon: Clock,       color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'Agents Spawned',         value: simulation.agents_spawned    || 0,        icon: Users,       color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Successfully Evacuated', value: simulation.agents_evacuated  || 0,        icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Trapped',                value: simulation.agents_trapped    || 0,        icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-50'    },
    {
      label: 'Evacuation Rate',
      value: simulation.agents_spawned
        ? `${Math.round((simulation.agents_evacuated / simulation.agents_spawned) * 100)}%`
        : '0%',
      icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50',
    },
  ];

  const hasProjectData = !!simulation?.project_data;
  const hasResults     = !!simulation?.results;
  const hasPaths       = !!simulation?.results?.paths;

  const handleShowPlayback = () => {
    if (!hasProjectData) { alert('Error: Project data is missing.'); return; }
    if (!hasResults)      { alert('Error: Simulation results are missing.'); return; }
    setShowPlayback(true);
  };

  const handleShowPaths = () => {
    if (!hasProjectData)      { alert('Error: Project data is missing.'); return; }
    if (!hasResults || !hasPaths) { alert('Error: Path data is missing.'); return; }
    setShowPathViz(true);
  };

  if (showPlayback) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <SimulationPlayback simulation={simulation} projectData={simulation.project_data}
          onClose={() => setShowPlayback(false)} />
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-6 relative">
            <button onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Simulation Complete!</h2>
                <p className="text-green-100 text-sm mt-0.5">
                  {simulation.project_name || 'Unnamed Project'} · {(simulation.steps || 0).toLocaleString()} steps
                </p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {stats.map((stat, i) => (
                <div key={i} className={`${stat.bg} rounded-xl p-5`}>
                  <div className="flex items-center justify-between mb-2">
                    <stat.icon className={`w-7 h-7 ${stat.color}`} />
                    <span className="text-xl font-bold text-gray-900">{stat.value}</span>
                  </div>
                  <p style={T.meta}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Warning */}
            {(!hasProjectData || !hasResults) && (
              <div className="mb-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-900 mb-1">Warning: Incomplete Data</p>
                  <p style={T.meta} className="text-yellow-800">
                    {!hasProjectData && '• Project data is missing. '}
                    {!hasResults && '• Simulation results are missing. '}
                    Some features may not be available.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button onClick={handleShowPlayback} disabled={!hasProjectData || !hasResults}
                className="flex-1 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <Play className="w-4 h-4" /> Watch Playback
              </button>
              <button onClick={handleShowPaths} disabled={!hasProjectData || !hasPaths}
                className="flex-1 px-5 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <MapIcon className="w-4 h-4" /> View Evacuation Paths
              </button>
            </div>

            {/* Performance */}
            <div className="mt-6 bg-gray-50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Performance Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span style={T.meta}>Completion Status</span>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {(simulation.agents_trapped || 0) === 0 ? '✅ All Evacuated' : '⚠️ Some Trapped'}
                  </p>
                </div>
                <div>
                  <span style={T.meta}>Elapsed Time</span>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {simulation.elapsed_s?.toFixed(2) || '0.00'}s
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPathViz && hasProjectData && hasPaths && (
        <PathVisualization projectData={simulation.project_data} simulationResults={simulation.results}
          onClose={() => setShowPathViz(false)} />
      )}
    </>
  );
};

export default SimulationResultsModal;