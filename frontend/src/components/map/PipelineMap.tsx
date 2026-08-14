import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useStore } from '../../store/useStore';
import { healthColor } from '../../utils/colors';
import { AlertTriangle } from 'lucide-react';

function MapFocus({ segmentId }: { segmentId: string | null }) {
  const map = useMap();
  const segments = useStore(s => s.segments);

  useEffect(() => {
    if (!segmentId) return;
    const seg = segments.find(s => s.id === segmentId);
    if (!seg) return;
    if (seg.route && seg.route.length > 0) {
      const mid = seg.route[Math.floor(seg.route.length / 2)];
      map.panTo([mid.lat, mid.lng], { animate: true, duration: 0.5 });
    } else if (seg.latitude !== null && seg.longitude !== null) {
      map.panTo([seg.latitude, seg.longitude], { animate: true, duration: 0.5 });
    }
  }, [segmentId, segments, map]);

  return null;
}

function SensorDots({ segmentId }: { segmentId: string }) {
  const sensors = useStore(s => s.getSensorsForSegment(segmentId));
  return (
    <>
      {sensors
        .filter(s => s.latitude !== undefined && s.longitude !== undefined)
        .map(sensor => (
          <CircleMarker
            key={sensor.id}
            center={[sensor.latitude as number, sensor.longitude as number]}
            radius={sensor.status === 'offline' ? 4 : 3}
            pathOptions={{
              fillColor: sensor.status === 'offline' ? '#6B7280' : '#378ADD',
              fillOpacity: 0.9,
              weight: 0,
              color: 'transparent',
            }}
          >
            <Popup>
              <div style={{ minWidth: '180px', fontSize: '12px' }}>
                <b style={{ color: '#E8ECEF' }}>{sensor.id}</b>
                <div style={{ color: '#9E9E9E', marginTop: '2px' }}>{sensor.sensor_type.replace(/_/g, ' ')}</div>
                {sensor.asset_name && <div style={{ color: '#858C94' }}>{sensor.asset_name}</div>}
                <hr style={{ border: 'none', borderTop: '1px solid #3A3F44', margin: '6px 0' }} />
                <div>
                  <span style={{ color: '#858C94' }}>Last: </span>
                  <span style={{ color: '#E8ECEF', fontFamily: 'monospace' }}>
                    {sensor.last_value !== null ? sensor.last_value.toFixed(2) : '-'} {sensor.unit}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#858C94' }}>Status: </span>
                  <span style={{ color: sensor.status === 'online' ? '#5ABFA5' : '#6B7280' }}>
                    {sensor.status}
                  </span>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
    </>
  );
}

// Alerts have no lat/lng in the real schema -- position derived from the
// linked asset's real coordinates instead of fabricating alert-level geo.
function AlertMarkers() {
  const alerts = useStore(s => s.alerts.filter(a => a.status === 'open' || a.status === 'escalated'));
  const segments = useStore(s => s.segments);

  return (
    <>
      {alerts.map(alert => {
        const asset = segments.find(s => s.id === alert.asset_id);
        if (!asset || asset.latitude === null || asset.longitude === null) return null;
        const pos: [number, number] = [asset.latitude, asset.longitude];

        return (
          <CircleMarker
            key={alert.id}
            center={pos}
            radius={alert.tier === 'red' ? 22 : alert.tier === 'yellow' ? 16 : 12}
            pathOptions={{
              color: '#E5484D',
              fillColor: '#E5484D',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '6 4',
            }}
          >
            <CircleMarker center={pos} radius={8} pathOptions={{ fillColor: '#E5484D', fillOpacity: 0.9, weight: 0 }}>
              <Popup>
                <div style={{ minWidth: '200px', fontSize: '12px' }}>
                  <b style={{ color: '#E5484D' }}>{alert.tier.toUpperCase()} ALERT</b>
                  <p style={{ color: '#E8ECEF', marginTop: '4px' }}>{alert.trigger_summary}</p>
                  <p style={{ color: '#F06A50', marginTop: '2px' }}>{alert.recommended_action}</p>
                  <div style={{ color: '#9E9E9E', marginTop: '4px' }}>
                    Confidence: <strong style={{ color: '#FFD00A' }}>
                      {alert.confidence !== null ? `${Math.round(alert.confidence * 100)}%` : 'n/a'}
                    </strong>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </CircleMarker>
        );
      })}
    </>
  );
}

export const PipelineMap: React.FC = () => {
  const { segments, selectedSegmentId, selectSegment, getPredictionForSegment, isOffline } = useStore();
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <MapContainer
        center={[32.05, -101.8]}
        zoom={7}
        minZoom={5}
        maxBounds={[[20, -115], [45, -88]]}
        maxBoundsViscosity={0.8}
        style={{ width: '100%', height: '100%', background: '#1A1C1E' }}
        zoomControl
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          maxZoom={18}
        />

        <MapFocus segmentId={selectedSegmentId} />

        {segments.map(seg => {
          const isSelected = seg.id === selectedSegmentId;
          const color = healthColor(seg.health_score ?? 100);
          const prediction = getPredictionForSegment(seg.id);
          const hasRoute = seg.route && seg.route.length >= 2;
          const hasPin = !hasRoute && seg.latitude !== null && seg.longitude !== null;

          const popupBody = (
            <div style={{ minWidth: '220px', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#E8ECEF', marginBottom: '6px' }}>
                {seg.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                <span style={{ color: '#9E9E9E' }}>Health</span>
                <span style={{ color, fontWeight: 700 }}>{seg.health_score ?? '-'}%</span>
                <span style={{ color: '#9E9E9E' }}>Zone (seeded)</span>
                <span style={{ color: '#E8ECEF' }}>{seg.zone ?? '-'}</span>
                {prediction && (
                  <>
                    <span style={{ color: '#9E9E9E' }}>RUL</span>
                    <span style={{
                      color: (prediction.rul_days ?? 999) <= 39 ? '#F06A50' : (prediction.rul_days ?? 999) <= 69 ? '#D4A24B' : '#5ABFA5',
                      fontWeight: 600,
                    }}>
                      {prediction.rul_days === 0 ? 'NOW' : prediction.rul_days != null ? `${prediction.rul_days}d` : '-'}
                    </span>
                    <span style={{ color: '#9E9E9E' }}>Risk</span>
                    <span style={{ color: '#F06A50' }}>
                      {prediction.anomaly_score != null ? `${Math.round(prediction.anomaly_score * 100)}%` : '-'}
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => selectSegment(seg.id)}
                style={{
                  marginTop: '8px', width: '100%', padding: '6px',
                  background: '#0078D4', border: 'none', borderRadius: '4px',
                  color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px',
                }}
              >
                Open Detail
              </button>
            </div>
          );

          return (
            <React.Fragment key={seg.id}>
              {hasRoute && (
                <Polyline
                  positions={seg.route!.map(p => [p.lat, p.lng] as [number, number])}
                  pathOptions={{
                    color,
                    weight: isSelected ? 7 : 5,
                    opacity: isSelected ? 1 : 0.82,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                  eventHandlers={{
                    click: () => selectSegment(isSelected ? null : seg.id),
                  }}
                >
                  <Popup>{popupBody}</Popup>
                </Polyline>
              )}

              {hasPin && (
                <CircleMarker
                  center={[seg.latitude as number, seg.longitude as number]}
                  radius={isSelected ? 10 : 7}
                  pathOptions={{
                    fillColor: color,
                    color,
                    fillOpacity: 0.85,
                    weight: isSelected ? 3 : 1,
                  }}
                  eventHandlers={{
                    click: () => selectSegment(isSelected ? null : seg.id),
                  }}
                >
                  <Popup>{popupBody}</Popup>
                </CircleMarker>
              )}

              <SensorDots segmentId={seg.id} />
            </React.Fragment>
          );
        })}

        <AlertMarkers />
      </MapContainer>

      <div style={{
        position: 'absolute', bottom: '24px', left: '12px', zIndex: 1000,
        background: 'rgba(22,27,36,0.92)', border: '1px solid var(--border)',
        borderRadius: '6px', padding: '10px 14px', backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px' }}>
          SEGMENT HEALTH
        </div>
        {[['#5ABFA5', 'Good (70-100%)'], ['#D4A24B', 'Warning (40-69%)'], ['#F06A50', 'Critical (0-39%)']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '24px', height: '4px', background: c, borderRadius: '2px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#378ADD', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Sensor online</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E5484D', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Active alert</span>
          </div>
        </div>
      </div>

      {isOffline && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
          background: 'rgba(89,89,89,0.85)', border: '1px solid #595959',
          borderRadius: '4px', padding: '6px 10px', fontSize: '11px',
          color: '#C0C0C0', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <AlertTriangle size={12} />
          Offline - data may be stale
        </div>
      )}
    </div>
  );
};
