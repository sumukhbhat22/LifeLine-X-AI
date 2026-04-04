import React from 'react';
import { Hospital, AlertCircle } from 'lucide-react';

interface Hospital {
  name: string;
  beds: number;
  distance: number;
}

interface Props {
  hospitals: Hospital[];
  selectedHospital?: string;
}

export const HospitalBeds: React.FC<Props> = ({ hospitals, selectedHospital }) => {
  // Find hospital with most available beds
  const bestHospital = hospitals && hospitals.length > 0
    ? hospitals.reduce((best, current) =>
        current.beds > best.beds ? current : best
      )
    : hospitals[0] || { name: 'Unknown', beds: 0, distance: 0 };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Hospital className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Hospital Routing</h3>
      </div>

      <div className="space-y-2">
        {hospitals.map(hospital => (
          <div
            key={hospital.name}
            className={`flex items-center justify-between p-2 rounded border transition-colors ${
              hospital.name === bestHospital.name
                ? 'border-green-500 bg-green-50/30'
                : 'border-border bg-secondary/30'
            }`}
          >
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{hospital.name}</div>
              <div className="text-xs text-muted-foreground">{hospital.distance} min drive</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${hospital.beds > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {hospital.beds} {hospital.beds === 1 ? 'bed' : 'beds'}
              </div>
              {hospital.name === bestHospital.name && hospital.beds > 0 && (
                <div className="text-[9px] text-green-600 font-mono">✓ OPTIMAL</div>
              )}
              {hospital.beds === 0 && (
                <div className="text-[9px] text-red-600 font-mono">FULL</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {bestHospital.beds === 0 && (
        <div className="mt-3 flex items-start gap-2 p-2 rounded bg-red-50/30 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-red-700">No available beds. Routing to alternative facility.</div>
        </div>
      )}

      <div className="mt-3 text-[9px] text-muted-foreground font-mono">
        Selected: <span className="text-primary font-bold">{bestHospital.name}</span>
      </div>
    </div>
  );
};
