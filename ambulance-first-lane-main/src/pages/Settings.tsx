import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, Clock, Zap, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React from 'react';

const SettingsPage = () => {
  const [surgeSettings, setSurgeSettings] = React.useState([
    { id: 1, hour: 8, minute: 30, name: 'Morning Shift' },
    { id: 2, hour: 13, minute: 0, name: 'Afternoon Shift' },
    { id: 3, hour: 18, minute: 30, name: 'Evening Shift' },
  ]);

  const signalSettings = {
    defaultGreenDuration: 5,
    surgeGreenMultiplier: 1.4,
    preWarningMinutes: 10,
    surgeActiveWindow: 15,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-50 py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-purple-600" />
            <h1 className="font-semibold">Configuration Settings</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Surge Times Configuration */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Tech Park Surge Times
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure the expected surge times for your city's IT park operations
          </p>
          <div className="space-y-4">
            {surgeSettings.map((surge) => (
              <div key={surge.id} className="p-4 rounded-lg border border-border/50 bg-muted/20">
                <div className="grid grid-cols-4 gap-3 items-end">
                  <div>
                    <Label className="text-xs text-muted-foreground">Shift Name</Label>
                    <Input 
                      value={surge.name} 
                      className="mt-1" 
                      disabled
                      placeholder="Shift name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Hour (0-23)</Label>
                    <Input 
                      type="number" 
                      value={surge.hour} 
                      className="mt-1" 
                      min="0" 
                      max="23"
                      placeholder="Hour"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Minute (0-59)</Label>
                    <Input 
                      type="number" 
                      value={surge.minute} 
                      className="mt-1" 
                      min="0" 
                      max="59"
                      placeholder="Minute"
                    />
                  </div>
                  <Button size="sm" variant="outline">Edit</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Signal Timing Configuration */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            Signal Timing Parameters
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Adjust traffic signal behavior and surge predictor sensitivity
          </p>
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Default Green Light Duration (seconds)</Label>
                  <div className="mt-2 p-3 rounded bg-card border border-border flex items-center justify-between">
                    <span className="font-mono font-semibold text-lg">{signalSettings.defaultGreenDuration}s</span>
                    <Button size="sm" variant="outline" disabled>Edit</Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pre-Surge Green Multiplier</Label>
                  <div className="mt-2 p-3 rounded bg-card border border-border flex items-center justify-between">
                    <span className="font-mono font-semibold text-lg">{signalSettings.surgeGreenMultiplier}x</span>
                    <span className="text-xs text-green-600 font-medium">+40% extension</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Pre-Surge Warning Window (minutes)</Label>
                  <div className="mt-2 p-3 rounded bg-card border border-border flex items-center justify-between">
                    <span className="font-mono font-semibold text-lg">{signalSettings.preWarningMinutes} min</span>
                    <span className="text-xs text-blue-600 font-medium">Before surge</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Surge Active Window (minutes)</Label>
                  <div className="mt-2 p-3 rounded bg-card border border-border flex items-center justify-between">
                    <span className="font-mono font-semibold text-lg">{signalSettings.surgeActiveWindow} min</span>
                    <span className="text-xs text-red-600 font-medium">Peak period</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Simulation Settings */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Simulation Parameters</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Settings for the traffic simulation environment
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between p-3 rounded border border-border/50 bg-muted/20">
              <span>Total Vehicles</span>
              <span className="font-semibold">24</span>
            </div>
            <div className="flex justify-between p-3 rounded border border-border/50 bg-muted/20">
              <span>Number of Junctions</span>
              <span className="font-semibold">3</span>
            </div>
            <div className="flex justify-between p-3 rounded border border-border/50 bg-muted/20">
              <span>Non-Cooperative Probability</span>
              <span className="font-semibold">15%</span>
            </div>
            <div className="flex justify-between p-3 rounded border border-border/50 bg-muted/20">
              <span>Ambulance Base Speed</span>
              <span className="font-semibold">120 px/s</span>
            </div>
          </div>
        </Card>

        {/* Save & Sync */}
        <div className="flex justify-end gap-3">
          <Button variant="outline">Discard Changes</Button>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
