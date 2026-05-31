import React from 'react';

type SensorStatus = 'active' | 'inactive';

type ProtocolRow = {
  label: string;
  portOrEndpoint: string;
  status: SensorStatus;
  actionLabel: string;
};

const protocolRows: ProtocolRow[] = [
  {
    label: 'MQTT',
    portOrEndpoint: 'port 1883 / 8883 TLS',
    status: 'active',
    actionLabel: 'Configure',
  },
  {
    label: 'OPC-UA',
    portOrEndpoint: 'port 4840',
    status: 'active',
    actionLabel: 'Configure',
  },
  {
    label: 'Modbus TCP',
    portOrEndpoint: 'port 502',
    status: 'inactive',
    actionLabel: 'Enable',
  },
  {
    label: 'REST API',
    portOrEndpoint: 'endpoint POST /api/v1/ingest',
    status: 'active',
    actionLabel: 'View Docs',
  },
];

const getStatusStyles = (status: SensorStatus): { badgeText: string; badgeColor: string } => {
  if (status === 'active') {
    return { badgeText: 'Active', badgeColor: '#5ABFA5' };
  }
  return { badgeText: 'Inactive', badgeColor: '#9BA3B2' };
};

const SensorConnectionsCard: React.FC = () => {
  return (
    <div
      style={{
        background: '#161B24',
        border: '0.5px solid #3B4560',
        borderRadius: '10px',
        padding: '24px',
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: '#C8D0DC', fontSize: '15px', fontWeight: 500 }}>Sensor Connections</div>
        <div style={{ color: '#9BA3B2', fontSize: '13px', marginTop: '4px' }}>
          Connect field sensors and edge gateway devices to ReliabilityOS
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {protocolRows.map((row: ProtocolRow) => {
          const status = getStatusStyles(row.status);
          return (
            <div
              key={row.label}
              style={{
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '0.5px solid #3B4560',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ color: '#C8D0DC', fontSize: '13px' }}>{row.label}</div>
                <div style={{ color: '#9BA3B2', fontSize: '12px' }}>{row.portOrEndpoint}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: status.badgeColor,
                  }}
                >
                  {status.badgeText}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    // No-op: UI only (no new packages/routes). Hook up to real actions later.
                  }}
                  style={{
                    background: '#1E2533',
                    border: '0.5px solid #3B4560',
                    color: '#9BA3B2',
                    fontSize: '12px',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    const target: HTMLButtonElement = e.currentTarget;
                    target.style.borderColor = '#378ADD';
                    target.style.color = '#378ADD';
                  }}
                  onMouseLeave={(e) => {
                    const target: HTMLButtonElement = e.currentTarget;
                    target.style.borderColor = '#3B4560';
                    target.style.color = '#9BA3B2';
                  }}
                >
                  {row.actionLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        style={{
          marginTop: '16px',
          width: '100%',
          background: '#1E2533',
          border: '0.5px solid #3B4560',
          color: '#C8D0DC',
          fontSize: '13px',
          borderRadius: '8px',
          padding: '8px 16px',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          const target: HTMLButtonElement = e.currentTarget;
          target.style.background = '#2A3245';
        }}
        onMouseLeave={(e) => {
          const target: HTMLButtonElement = e.currentTarget;
          target.style.background = '#1E2533';
        }}
        onClick={() => {
          // No-op: UI only.
        }}
      >
        + Register New Gateway
      </button>
    </div>
  );
};

export default SensorConnectionsCard;

