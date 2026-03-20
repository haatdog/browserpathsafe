//SimulationResultsModal
import { useState, useEffect } from 'react';
import { X, Play, Clock, Users, CheckCircle, XCircle, TrendingUp, Map as MapIcon, AlertCircle } from 'lucide-react';
import SimulationPlayback from './SimulationPlayback';
import PathVisualization from './PathVisualization';

interface SimulationResultsModalProps {
  simulation: any;
  onClose: () => void;
}

export default function SimulationResultsModal({ simulation, onClose }: SimulationResultsModalProps) {
  const [showPlayback, setShowPlayback] = useState(false);
  const [showPathViz, setShowPathViz] = useState(false);

  // ✅ DEBUG: Log simulation data
  useEffect(() => {
    console.log('📊 SimulationResultsModal mounted with data:');
    console.log('  - simulation:', simulation);
    console.log('  - project_data exists?', !!simulation?.project_data);
    console.log('  - project_data:', simulation?.project_data);
    console.log('  - results exists?', !!simulation?.results);
    console.log('  - paths exist?', !!simulation?.results?.paths);
    console.log('  - paths:', simulation?.results?.paths);
    
    if (simulation?.project_data) {
      console.log('  - buildings count:', simulation.project_data.buildings?.length);
      console.log('  - buildings:', simulation.project_data.buildings);
    }
  }, [simulation]);

  const stats = [
    {
      label: 'Simulation Time',
      value: `${simulation.evacuation_time || '0'}s`,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      label: 'Agents Spawned',
      value: simulation.agents_spawned || 0,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      label: 'Successfully Evacuated',
      value: simulation.agents_evacuated || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      label: 'Trapped',
      value: simulation.agents_trapped || 0,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50'
    },
    {
      label: 'Evacuation Rate',
      value: simulation.agents_spawned 
        ? `${Math.round((simulation.agents_evacuated / simulation.agents_spawned) * 100)}%`
        : '0%',
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    }
  ];

  // ✅ Check if we have required data
  const hasProjectData = !!simulation?.project_data;
  const hasResults = !!simulation?.results;
  const hasPaths = !!simulation?.results?.paths;

  const handleShowPlayback = () => {
    console.log('▶️ Watch Playback clicked');
    console.log('  - Has project_data?', hasProjectData);
    console.log('  - Has results?', hasResults);
    
    if (!hasProjectData) {
      alert('Error: Project data is missing. Cannot show playback.');
      return;
    }
    
    if (!hasResults) {
      alert('Error: Simulation results are missing. Cannot show playback.');
      return;
    }
    
    setShowPlayback(true);
  };

  const handleShowPaths = () => {
    console.log('🗺️ View Paths clicked');
    console.log('  - Has project_data?', hasProjectData);
    console.log('  - Has results?', hasResults);
    console.log('  - Has paths?', hasPaths);
    
    if (!hasProjectData) {
      alert('Error: Project data is missing. Cannot show paths.');
      console.error('Missing project_data in simulation object');
      return;
    }
    
    if (!hasResults || !hasPaths) {
      alert('Error: Path data is missing. Cannot show visualization.');
      console.error('Missing results.paths in simulation object');
      return;
    }
    
    setShowPathViz(true);
  };

  if (showPlayback) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <SimulationPlayback
          simulation={simulation}
          projectData={simulation.project_data}
          onClose={() => setShowPlayback(false)}
        />
      </div>
    );
  }

  return (
    <>
      {/* Results Modal */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-6 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition text-white"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white">Simulation Complete!</h2>
                <p className="text-green-100 mt-1">
                  {simulation.project_name || 'Unnamed Project'} • {(simulation.steps || 0).toLocaleString()} steps
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {stats.map((stat, index) => (
                <div 
                  key={index}
                  className={`${stat.bg} rounded-xl p-6 border-2 border-transparent hover:border-${stat.color.replace('text-', '')} transition`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                    <span className="text-3xl font-bold text-gray-900">
                      {stat.value}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-600">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* ✅ Data Status Warning */}
            {(!hasProjectData || !hasResults) && (
              <div className="mb-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900 mb-1">Warning: Incomplete Data</p>
                  <p className="text-sm text-yellow-800">
                    {!hasProjectData && '• Project data is missing. '}
                    {!hasResults && '• Simulation results are missing. '}
                    Some features may not be available.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleShowPlayback}
                disabled={!hasProjectData || !hasResults}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold transition flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5" />
                <span>Watch Playback</span>
              </button>

              <button
                onClick={handleShowPaths}
                disabled={!hasProjectData || !hasPaths}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold transition flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MapIcon className="w-5 h-5" />
                <span>View Evacuation Paths</span>
              </button>
            </div>

            {/* Performance Info */}
            <div className="mt-6 bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Performance Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Completion Status:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {(simulation.agents_trapped || 0) === 0 ? '✅ All Evacuated' : '⚠️ Some Trapped'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Elapsed Time:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {simulation.elapsed_s?.toFixed(2) || '0.00'}s
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Path Visualization - Only show if we have data */}
      {showPathViz && hasProjectData && hasPaths && (
        <PathVisualization
          projectData={simulation.project_data}
          simulationResults={simulation.results}
          onClose={() => {
            console.log('✕ Closing path visualization');
            setShowPathViz(false);
          }}
        />
      )}
    </>
  );
}