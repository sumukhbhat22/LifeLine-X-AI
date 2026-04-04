import { useSimulation } from '@/hooks/useSimulation';
import { SimulationCanvas } from '@/components/simulation/SimulationCanvas';
import { ControlsPanel } from '@/components/simulation/ControlsPanel';
import { HeaderBar } from '@/components/simulation/HeaderBar';
import { MiniMap } from '@/components/simulation/MiniMap';

const Index = () => {
  const {
    state, start, pause, resume, reset,
    setSpeed, setLanguage, toggleHeatmap, toggleInstructions,
  } = useSimulation();

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <HeaderBar
        phase={state.phase}
        ambulances={state.ambulances}
        vehiclesCleared={state.vehiclesCleared}
        junctionsPrepared={state.junctionsPrepared}
        co2Saved={state.co2Saved}
        timeSavedSeconds={state.timeSavedSeconds}
        techParkSurgeActive={state.techParkSurgeActive}
      />

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div className="w-full max-w-6xl aspect-[11/5] rounded-xl border border-border overflow-hidden shadow-2xl relative">
          <SimulationCanvas state={state} />
          <MiniMap state={state} />
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 flex justify-center">
        <ControlsPanel
          phase={state.phase}
          speed={state.speed}
          language={state.language}
          showHeatmap={state.showHeatmap}
          showInstructions={state.showInstructions}
          surgeMode={state.surgeMode}
          minutesUntilSurge={state.minutesUntilSurge}
          techParkSurgeActive={state.techParkSurgeActive}
          onStart={start}
          onPause={pause}
          onResume={resume}
          onReset={reset}
          onSpeedChange={setSpeed}
          onLanguageChange={setLanguage}
          onToggleHeatmap={toggleHeatmap}
          onToggleInstructions={toggleInstructions}
        />
      </div>
    </div>
  );
};

export default Index;
