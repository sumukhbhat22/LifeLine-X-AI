import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, TrendingUp, BarChart3, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Analytics = () => {
  const metrics = [
    { label: 'Total Simulations Run', value: '12', change: '+3 this week' },
    { label: 'Avg Clearance Rate', value: '87%', change: '+5% with surge predictor' },
    { label: 'Peak Hour Improvement', value: '42%', change: 'During IT shift times' },
    { label: 'Ambulance Response Time', value: '-18s', change: 'avg per junction' },
  ];

  const surgeAnalysis = [
    { time: '8:30 AM', peak: 'High', congestion: '78%', withPredictor: '52%' },
    { time: '1:00 PM', peak: 'Medium', congestion: '61%', withPredictor: '38%' },
    { time: '6:30 PM', peak: 'Very High', congestion: '85%', withPredictor: '61%' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-50 py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <h1 className="font-semibold">Performance Analytics</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Key Metrics */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Key Performance Indicators</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {metrics.map((metric, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-border bg-card">
                <div className="text-2xl font-bold text-primary mb-1">{metric.value}</div>
                <div className="text-sm text-muted-foreground mb-2">{metric.label}</div>
                <div className="text-xs text-green-600 font-medium">{metric.change}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Surge Impact Analysis */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Surge Predictor Impact Analysis</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-semibold">Shift Time</th>
                  <th className="text-left p-3 font-semibold">Congestion Level</th>
                  <th className="text-left p-3 font-semibold">Without Predictor</th>
                  <th className="text-left p-3 font-semibold">With Predictor</th>
                  <th className="text-left p-3 font-semibold">Improvement</th>
                </tr>
              </thead>
              <tbody>
                {surgeAnalysis.map((row, idx) => {
                  const without = parseInt(row.withPredictor);
                  const with_ = parseInt(row.congestion);
                  const improvement = Math.round(((with_ - without) / with_) * 100);

                  return (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono text-primary">{row.time}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          row.peak === 'Very High' ? 'bg-red-100 text-red-700' :
                          row.peak === 'High' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {row.peak}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{row.congestion}</td>
                      <td className="p-3 font-mono text-green-600">{row.withPredictor}</td>
                      <td className="p-3 font-bold text-green-600">↓ {improvement}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming Features */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Analytics Features (Coming Soon)</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-sm">Real-time Heatmap</h3>
              </div>
              <p className="text-xs text-muted-foreground">Live congestion visualization across all routes</p>
            </div>
            <div className="p-4 rounded-lg border border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-sm">Journey Analytics</h3>
              </div>
              <p className="text-xs text-muted-foreground">Track individual ambulance metrics and routes</p>
            </div>
            <div className="p-4 rounded-lg border border-border/30 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-sm">Zone Performance</h3>
              </div>
              <p className="text-xs text-muted-foreground">Compare metrics across different areas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
