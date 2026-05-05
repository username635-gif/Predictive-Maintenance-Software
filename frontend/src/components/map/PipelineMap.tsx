import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useStore } from '../../store/useStore';
import { healthColor } from '../../utils/colors';
import { AlertTriangle } from 'lucide-react';

// ─── Helper: re-centre map when selection changes ─────────────────────────────
function MapFocus({ segmentId }: { segmentId: string | null }) {
  const map = useMap();
  const segments = useStore(s => s.segments);

  useEffect(() => {
    if (!segmentId) return;
    const seg = segments.find(s => s.id === segmentId);
    if (!seg || seg.coordinates.length === 0) return;
    const mid = seg.coordinates[Math.floor(seg.coordinates.length / 2)];
    map.panTo(mid, { animate: true, duration: 0.5 });
  }, [segmentId, segments, map]);

  return null;
}

// ─── Sensor Dot ───────────────────────────────────────────────────────────────
function SensorDots({ segmentId }: { segmentId: string }) {
  const sensors = useStore(s => s.getSensorsForSegment(segmentId));
  return (
    <>
      {sensors.map(sensor => (
        <CircleMarker
          key={sensor.id}
          center={[sensor.lat, sensor.lng]}
          radius={sensor.status === 'offline' ? 4 : 3}
          pathOptions={{
            fillColor: sensor.status === 'offline' ? '#5A5F66' : sensor.status === 'degraded' ? '#F76808' : '#0090FF',
            fillOpacity: 0.9,
            weight: 0,
            color: 'transparent',
          }}
        >
          <Popup>
            <div style={{ minWidth: '180px', fontSize: '12px' }}>
              <b style={{ color: '#E8ECEF' }}>{sensor.name}</b>
              <div style={{ color: '#9E9E9E', marginTop: '2px' }}>{sensor.type.replace(/_/g, ' ')}</div>
              <div style={{ color: '#858C94' }}>Mile {sensor.mile_marker}</div>
              <hr style={{ border: 'none', borderTop: '1px solid #3A3F44', margin: '6px 0' }} />
              <div>
                <span style={{ color: '#858C94' }}>Last: </span>
                <span style={{ color: '#E8ECEF', fontFamily: 'monospace' }}>
                  {sensor.last_reading?.value.toFixed(2)} {sensor.unit}
                </span>
              </div>
              <div>
                <span style={{ color: '#858C94' }}>Status: </span>
                <span style={{
                  color: sensor.status === 'online' ? '#30A46C' : sensor.status === 'degraded' ? '#F76808' : '#5A5F66'
                }}>
                  {sensor.status}
                </span>
              </div>
              <div style={{ color: '#9E9E9E' }}>Protocol: {sensor.protocol}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

// ─── Alert Marker ─────────────────────────────────────────────────────────────
function AlertMarkers() {
  const alerts = useStore(s => s.alerts.filter(a => !a.acknowledged && a.location));
  return (
    <>
      {alerts.map(alert => (
        <CircleMarker
          key={alert.id}
          center={[alert.location!.lat, alert.location!.lng]}
          radius={alert.location!.radius_m / 5000 * 40 + 14}
          pathOptions={{
            color: '#E5484D',
            fillColor: '#E5484D',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '6 4',
          }}
        >
          <CircleMarker
            center={[alert.location!.lat, alert.location!.lng]}
            radius={8}
            pathOptions={{ fillColor: '#E5484D', fillOpacity: 0.9, weight: 0 }}
          >
            <Popup>
              <div style={{ minWidth: '200px', fontSize: '12px' }}>
                <b style={{ color: '#E5484D' }}>⚠ {alert.type.replace(/_/g, ' ').toUpperCase()}</b>
                <p style={{ color: '#E8ECEF', marginTop: '4px' }}>{alert.message}</p>
                <div style={{ color: '#9E9E9E', marginTop: '4px' }}>
                  Confidence: <strong style={{ color: '#FFD00A' }}>{Math.round(alert.confidence * 100)}%</strong>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        </CircleMarker>
      ))}
    </>
  );
}

// ─── Main Map ─────────────────────────────────────────────────────────────────
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
        {!isOffline ? (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            maxZoom={18}
          />
        ) : (
          // Cached tiles from service worker will still load; fallback dark bg
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
            maxZoom={18}
          />
        )}

        <MapFocus segmentId={selectedSegmentId} />

        {/* Pipeline segments */}
        {segments.map(seg => {
          const isSelected = seg.id === selectedSegmentId;
          const color = healthColor(seg.health_score);
          const prediction = getPredictionForSegment(seg.id);

          return (
            <React.Fragment key={seg.id}>
              <Polyline
                positions={seg.coordinates}
                pathOptions={{
                  color,
                  weight: isSelected ? 7 : 5,
                  opacity: isSelected ? 1 : 0.82,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                eventHandlers={{
                  click: () => selectSegment(isSelected ? null : seg.id),
                  mouseover: (e) => {
                    e.target.setStyle({ weight: 8, opacity: 1 });
                  },
                  mouseout: (e) => {
                    e.target.setStyle({ weight: isSelected ? 7 : 5, opacity: isSelected ? 1 : 0.82 });
                  },
                }}
              >
                <Popup>
                  <div style={{ minWidth: '220px', fontSize: '12px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#E8ECEF', marginBottom: '6px' }}>
                      {seg.name}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                      <span style={{ color: '#9E9E9E' }}>Health</span>
                      <span style={{ color, fontWeight: 700 }}>{seg.health_score}%</span>
                      <span style={{ color: '#9E9E9E' }}>Wall Thick.</span>
                      <span style={{ color: '#E8ECEF', fontFamily: 'monospace' }}>{seg.wall_thickness_mm} mm</span>
                      <span style={{ color: '#9E9E9E' }}>Pressure</span>
                      <span style={{ color: '#E8ECEF', fontFamily: 'monospace' }}>{seg.operating_pressure_psi} PSI</span>
                      {prediction && (
                        <>
                          <span style={{ color: '#9E9E9E' }}>RUL</span>
                          <span style={{ color: prediction.rul_days < 30 ? '#E5484D' : '#FFD00A', fontWeight: 600 }}>
                            {prediction.rul_days === 0 ? 'NOW' : `${prediction.rul_days}d`}
                          </span>
                          <span style={{ color: '#9E9E9E' }}>Risk</span>
                          <span style={{ color: '#F76808' }}>{Math.round(prediction.anomaly_score * 100)}%</span>
                        </>
                      )}
                      {seg.last_pig_run && (
                        <>
                          <span style={{ color: '#9E9E9E' }}>Last PIG</span>
                          <span style={{ color: '#9E9E9E' }}>{seg.last_pig_run}</span>
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
                      Open Detail →
                    </button>
                  </div>
                </Popup>
              </Polyline>

              {/* Sensor dots (visible when zoomed in) */}
              <SensorDots segmentId={seg.id} />
            </React.Fragment>
          );
        })}

        {/* Alert markers */}
        <AlertMarkers />
      </MapContainer>

      {/* Map legend */}
      <div style={{
        position: 'absolute', bottom: '24px', left: '12px', zIndex: 1000,
        background: 'rgba(19,22,31,0.92)', border: '1px solid var(--border)',
        borderRadius: '6px', padding: '10px 14px', backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>
          SEGMENT HEALTH
        </div>
        {[['#2ECC40', 'Good (70–100%)'], ['#FFDC00', 'Warning (40–69%)'], ['#FF4136', 'Critical (0–39%)']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '24px', height: '4px', background: c, borderRadius: '2px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{l}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0078D4', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Sensor online</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF4136', flexShrink: 0, boxShadow: '0 0 6px rgba(255,65,54,0.6)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Active alert</span>
          </div>
        </div>
      </div>

      {/* Offline overlay indicator */}
      {isOffline && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
          background: 'rgba(89,89,89,0.85)', border: '1px solid #595959',
          borderRadius: '4px', padding: '6px 10px', fontSize: '11px',
          color: '#C0C0C0', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <AlertTriangle size={12} />
          Cached map tiles – real-time alerts paused
        </div>
      )}
    </div>
  );
};
