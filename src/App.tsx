export default function App() {
  return (
    <div className="min-h-screen bg-surface-900 text-ink-primary flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface-800 border border-surface-600 rounded-xl p-6 shadow-xl space-y-4 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-strava-orange/15 text-strava-orange font-bold text-xl">
          FC
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
          Fitness Community &amp; Activity Feed
        </h1>
        <p className="text-sm text-ink-secondary">
          Foundation scaffolded. Ready for feature implementations and telemetry modules.
        </p>
        <div className="pt-2 flex justify-center gap-2">
          <span className="px-2.5 py-1 text-xs rounded-full bg-sport-run/15 text-sport-run border border-sport-run/30 font-medium">
            Run
          </span>
          <span className="px-2.5 py-1 text-xs rounded-full bg-sport-ride/15 text-sport-ride border border-sport-ride/30 font-medium">
            Ride
          </span>
          <span className="px-2.5 py-1 text-xs rounded-full bg-sport-swim/15 text-sport-swim border border-sport-swim/30 font-medium">
            Swim
          </span>
        </div>
      </div>
    </div>
  );
}
