import { Link } from 'react-router-dom';
import { Ambulance, Zap, ArrowRight, Clock, Leaf, ShieldCheck, Activity, HeartPulse, Shield, Construction, MapPin, SkipForward } from 'lucide-react';

const Dashboard = () => {
  const features = [
    {
      id: 'simulation',
      name: 'Ambulance Priority System',
      description: 'Real-time traffic management with AI-powered corridor clearing. Multi-ambulance support with CO₂ tracking.',
      icon: Ambulance,
      color: 'text-red-600',
      bgColor: 'bg-red-600/10',
      borderColor: 'border-red-600/20 hover:border-red-600/50',
      href: '/simulation',
      badge: 'Core Demo',
    },
    {
      id: 'surge-predictor',
      name: 'Tech Park Surge Predictor',
      description: 'Predicts IT-park shift surges 10 min ahead. Pre-optimizes signals for Bengaluru traffic patterns.',
      icon: Zap,
      color: 'text-amber-600',
      bgColor: 'bg-amber-600/10',
      borderColor: 'border-amber-600/20 hover:border-amber-600/50',
      href: '/surge-predictor',
      badge: 'AI Feature',
    },
    {
      id: 'traffic-admin',
      name: 'Traffic Admin Panel',
      description: 'Real-time breakdown detection, tow dispatch, and driver alert broadcasting for traffic department.',
      icon: Shield,
      color: 'text-rose-600',
      bgColor: 'bg-rose-600/10',
      borderColor: 'border-rose-600/20 hover:border-rose-600/50',
      href: '/traffic-admin',
      badge: 'Admin',
    },
    {
      id: 'disruption-reroute',
      name: 'Disruption & Smart Rerouting',
      description: 'Detects road disruptions (construction, processions) and reroutes vehicles to prevent congestion buildup.',
      icon: Construction,
      color: 'text-orange-600',
      bgColor: 'bg-orange-600/10',
      borderColor: 'border-orange-600/20 hover:border-orange-600/50',
      href: '/disruption-reroute',
      badge: 'Reroute AI',
    },
    {
      id: 'safety-routing',
      name: 'Safety-Aware Routing',
      description: 'Real-time map with OSRM API: detects unsafe zones and dynamically suggests safer routes using safety scoring.',
      icon: MapPin,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-600/10',
      borderColor: 'border-emerald-600/20 hover:border-emerald-600/50',
      href: '/safety-routing',
      badge: 'Map AI',
    },
    {
      id: 'phase-skipping',
      name: 'Phase Skipping Intelligence',
      description: 'Detects empty lanes at junctions and skips unnecessary signal phases, reducing idle wait and emissions.',
      icon: SkipForward,
      color: 'text-violet-600',
      bgColor: 'bg-violet-600/10',
      borderColor: 'border-violet-600/20 hover:border-violet-600/50',
      href: '/phase-skipping',
      badge: 'Signal AI',
    },
  ];

  const stats = [
    { label: 'Avg Time Saved', value: '38s', icon: Clock, color: 'text-blue-600' },
    { label: 'CO₂ Reduction', value: '0.15 kg', icon: Leaf, color: 'text-green-600' },
    { label: 'Clearance Rate', value: '94%', icon: Activity, color: 'text-amber-600' },
    { label: 'Lives Impacted', value: '1000+', icon: HeartPulse, color: 'text-red-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Hero Header */}
      <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-red-600/10 border border-red-600/20">
              <Ambulance className="h-7 w-7 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-red-600 via-amber-500 to-green-500 bg-clip-text text-transparent">
                  LifeLine-X+ AI
                </span>
              </h1>
              <p className="text-xs text-muted-foreground font-mono tracking-widest">
                AI SELF-CLEARING SMART CORRIDOR
              </p>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            Intelligent ambulance-first corridor system for Indian cities. Combines real-time traffic management,
            predictive surge detection, and multi-lingual vehicle instructions to save lives in emergencies.
          </p>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background/50">
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                  <div>
                    <div className="text-xl font-bold font-mono tabular-nums">{stat.value}</div>
                    <div className="text-[10px] text-muted-foreground font-mono tracking-wider uppercase">{stat.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Cards */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Primary Demo Card */}
        <Link to="/simulation" className="block mb-6">
          <div className="relative overflow-hidden p-6 md:p-8 rounded-2xl border-2 border-red-600/30 bg-gradient-to-r from-red-600/5 via-card to-amber-600/5 hover:border-red-600/60 transition-all duration-300 group hover:shadow-xl hover:shadow-red-600/5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-red-600/10">
                    <Ambulance className="h-6 w-6 text-red-600" />
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-red-600 text-white">
                    START HERE
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-2">Ambulance Priority System</h3>
                <p className="text-muted-foreground leading-relaxed max-w-xl">
                  Real-time map simulation with OSRM routing API. AI-powered corridor clearing across Bengaluru with junction signal management,
                  hospital bed routing, CO₂ tracking, and multilingual driver notifications.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {['Real Map', 'OSRM API', 'Corridor Clearing', 'Hospital Beds', '4 Languages', 'CO₂ Tracking'].map(tag => (
                    <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-red-600 transition-all group-hover:translate-x-1 mt-2 flex-shrink-0" />
            </div>
          </div>
        </Link>

        {/* Secondary feature cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.slice(1).map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.id} to={feature.href}>
                <div className={`h-full p-5 rounded-xl border ${feature.borderColor} bg-card hover:bg-card/80 transition-all duration-300 cursor-pointer group hover:shadow-lg`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${feature.bgColor}`}>
                      <Icon className={`h-5 w-5 ${feature.color}`} />
                    </div>
                    {feature.badge && (
                      <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{feature.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Innovation Highlights */}
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl border border-border/30 bg-gradient-to-b from-muted/20 to-transparent">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <h4 className="font-bold text-sm">Predictive AI</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Detects IT park traffic surges 10 min ahead using Bengaluru shift-time data.
              Pre-extends green lights 40% on outbound routes before gridlock begins.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-border/30 bg-gradient-to-b from-muted/20 to-transparent">
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="h-5 w-5 text-red-600" />
              <h4 className="font-bold text-sm">Hospital-Aware Routing</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time hospital bed availability integrated into routing decisions.
              Ambulances are directed to nearest hospital with available capacity.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-border/30 bg-gradient-to-b from-muted/20 to-transparent">
            <div className="flex items-center gap-2 mb-3">
              <Leaf className="h-5 w-5 text-green-600" />
              <h4 className="font-bold text-sm">Environmental Impact</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tracks CO₂ saved by reducing vehicle idle time during corridor clearing.
              Quantifies environmental impact alongside life-saving metrics.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-muted-foreground pb-8">
          <p className="font-mono">Built for Indian cities. Designed to save lives.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
