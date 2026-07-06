import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GatewayConfig, GatewayProtocol, GatewaySourceType, GatewayStatus } from '../../types/gateway';

export type GatewayConfigModalProps = {
  mode: 'create' | 'edit';
  gateway?: GatewayConfig; // required if mode === 'edit'
  isOpen: boolean;
  onClose: () => void;
  onSave: (gateway: GatewayConfig) => Promise<void>;
};

type Protocol = GatewayProtocol;

type Toast = { type: 'success' | 'error'; message: string } | null;

function protocolWarning(protocol: Protocol) {
  if (protocol === 'Modbus TCP') {
    return (
      <div
        style={{
          marginTop: 10,
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid rgba(255,176,32,0.6)',
          background: 'rgba(255,176,32,0.08)',
          color: '#FFB020',
          fontSize: 12,
          lineHeight: 1.35,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>
          Security note
        </div>
        Modbus TCP has no native authentication or encryption. Use network segmentation, VPNs,
        and firewall rules to restrict access.
      </div>
    );
  }
  return null;
}

function InlineField(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ color: '#C8D0DC', fontSize: 12, fontWeight: 800 }}>{props.label}</div>
        {props.right}
      </div>
      {props.children}
      {props.hint ? <div style={{ color: '#9BA3B2', fontSize: 11 }}>{props.hint}</div> : null}
    </div>
  );
}

function ModalShell(props: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  if (!props.children) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        zIndex: 1000,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        style={{
          width: 'min(980px, 100%)',
          maxHeight: '85vh',
          overflow: 'auto',
          background: '#161B24',
          border: '0.5px solid #3B4560',
          borderRadius: 12,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ color: '#C8D0DC', fontSize: 14, fontWeight: 950 }}>{props.title}</div>
            <div style={{ color: '#9BA3B2', fontSize: 12 }}>Configure protocol connection settings and persist to the gateway registry.</div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9BA3B2',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 900,
              padding: 8,
            }}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: 16 }}>{props.children}</div>
        {props.footer ? <div style={{ marginTop: 18 }}>{props.footer}</div> : null}
      </div>
    </div>
  );
}

const protocolList: Protocol[] = ['MQTT', 'OPC-UA', 'Modbus TCP', 'REST API'];

type MqttConfig = {
  host: string;
  port: number;
  tlsEnabled: boolean;
  authMode: 'none' | 'usernamePassword' | 'clientCert';
  username: string;
  password: string;
  topicNamespace: string;
  clientCertPem?: string; // client cert file content (optional)
};

type OpcUaConfig = {
  endpointUrl: string;
  securityPolicy: 'None' | 'Basic256Sha256';
  authMode: 'Anonymous' | 'Username' | 'Certificate';
  username: string;
  password: string;
  certificatePem?: string;
};

type ModbusTcpRegisterRow = {
  id: string;
  address: number;
  dataType: 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32';
};

type ModbusTcpConfig = {
  ip: string;
  port: number;
  unitId: number;
  registerMap: ModbusTcpRegisterRow[];
};

function newRegisterRow(): ModbusTcpRegisterRow {
  return {
    id: crypto.randomUUID(),
    address: 0,
    dataType: 'uint16',
  };
}

export default function GatewayConfigModal(props: GatewayConfigModalProps) {
  const { mode, gateway, isOpen, onClose, onSave } = props;

  const initialProtocol = (gateway?.protocol ?? 'MQTT') as Protocol;

  const [toast, setToast] = useState<Toast>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [protocol, setProtocol] = useState<Protocol>(initialProtocol);

  // Minimal registry-backed fields (must exist in GatewayConfig)
  const [name, setName] = useState(gateway?.name ?? '');
  const [source, setSource] = useState<GatewaySourceType>(gateway?.source ?? 'real');
  const [segment_assignment, setSegmentAssignment] = useState(gateway?.segment_assignment ?? '');
  const [status, setStatus] = useState<GatewayStatus>(gateway?.status ?? 'online');

  // Protocol-specific form state (stored locally only for now; only top-level GatewayConfig fields are persisted by existing backend)
  const [mqtt, setMqtt] = useState<MqttConfig>({
    host: 'localhost',
    port: 1883,
    tlsEnabled: true,
    authMode: 'usernamePassword',
    username: '',
    password: '',
    topicNamespace: 'plant',
    clientCertPem: undefined,
  });

  const [opcua, setOpcua] = useState<OpcUaConfig>({
    endpointUrl: 'opc.tcp://localhost:4840',
    securityPolicy: 'Basic256Sha256',
    authMode: 'Username',
    username: '',
    password: '',
    certificatePem: undefined,
  });

  const [modbus, setModbus] = useState<ModbusTcpConfig>({
    ip: '127.0.0.1',
    port: 502,
    unitId: 1,
    registerMap: [newRegisterRow()],
  });

  const didInitRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    if (didInitRef.current) return;
    didInitRef.current = true;

    setProtocol(initialProtocol);
    setName(gateway?.name ?? '');
    setSource(gateway?.source ?? 'real');
    setSegmentAssignment(gateway?.segment_assignment ?? '');
    setStatus(gateway?.status ?? 'online');
  }, [isOpen, initialProtocol, gateway]);

  useEffect(() => {
    if (!isOpen) {
      didInitRef.current = false;
    }
  }, [isOpen]);

  const protocolForm = useMemo(() => {
    if (protocol === 'MQTT') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <InlineField label="Host">
            <input
              value={mqtt.host}
              onChange={(e) => setMqtt((m) => ({ ...m, host: e.target.value }))}
              style={inputStyle}
              placeholder="mqtt.example.com"
            />
          </InlineField>
          <InlineField label="Port">
            <input
              type="number"
              value={mqtt.port}
              onChange={(e) => setMqtt((m) => ({ ...m, port: Number(e.target.value) || 0 }))}
              style={inputStyle}
            />
          </InlineField>

          <InlineField label="TLS" right={<span style={{ color: '#9BA3B2', fontSize: 11 }}>(default on)</span>}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#C8D0DC', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={mqtt.tlsEnabled}
                onChange={(e) => setMqtt((m) => ({ ...m, tlsEnabled: e.target.checked }))}
              />
              Enable TLS (8883)
            </label>
          </InlineField>

          <InlineField
            label="Auth"
            hint="Choose how the gateway authenticates to the broker."
          >
            <select
              value={mqtt.authMode}
              onChange={(e) => setMqtt((m) => ({ ...m, authMode: e.target.value as MqttConfig['authMode'] }))}
              style={inputStyle}
            >
              <option value="none">None</option>
              <option value="usernamePassword">Username/Password</option>
              <option value="clientCert">Client certificate</option>
            </select>
          </InlineField>

          {mqtt.authMode === 'usernamePassword' ? (
            <>
              <InlineField label="Username">
                <input value={mqtt.username} onChange={(e) => setMqtt((m) => ({ ...m, username: e.target.value }))} style={inputStyle} />
              </InlineField>
              <InlineField label="Password">
                <input
                  type="password"
                  value={mqtt.password}
                  onChange={(e) => setMqtt((m) => ({ ...m, password: e.target.value }))}
                  style={inputStyle}
                />
              </InlineField>
            </>
          ) : null}

          {mqtt.authMode === 'clientCert' ? (
            <InlineField label="Client cert PEM">
              <input
                type="file"
                accept=".pem,.crt,.cer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  setMqtt((m) => ({ ...m, clientCertPem: text }));
                }}
                style={inputStyle}
              />
              {mqtt.clientCertPem ? <div style={{ color: '#9BA3B2', fontSize: 11 }}>Loaded PEM ({mqtt.clientCertPem.length} chars)</div> : null}
            </InlineField>
          ) : null}

          <InlineField label="Topic namespace">
            <input
              value={mqtt.topicNamespace}
              onChange={(e) => setMqtt((m) => ({ ...m, topicNamespace: e.target.value }))}
              style={inputStyle}
              placeholder="plant"
            />
          </InlineField>

          <div style={{ gridColumn: '1 / -1' }}>{protocolWarning(protocol)}</div>
        </div>
      );
    }

    if (protocol === 'OPC-UA') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <InlineField label="Endpoint URL">
            <input
              value={opcua.endpointUrl}
              onChange={(e) => setOpcua((o) => ({ ...o, endpointUrl: e.target.value }))}
              style={inputStyle}
              placeholder="opc.tcp://host:4840"
            />
          </InlineField>

          <InlineField label="Security policy">
            <select
              value={opcua.securityPolicy}
              onChange={(e) => setOpcua((o) => ({ ...o, securityPolicy: e.target.value as OpcUaConfig['securityPolicy'] }))}
              style={inputStyle}
            >
              <option value="None">None (warn)</option>
              <option value="Basic256Sha256">Basic256Sha256</option>
            </select>
          </InlineField>

          <InlineField label="Auth mode">
            <select
              value={opcua.authMode}
              onChange={(e) => setOpcua((o) => ({ ...o, authMode: e.target.value as OpcUaConfig['authMode'] }))}
              style={inputStyle}
            >
              <option value="Anonymous">Anonymous</option>
              <option value="Username">Username</option>
              <option value="Certificate">Certificate</option>
            </select>
          </InlineField>

          {opcua.authMode === 'Username' ? (
            <>
              <InlineField label="Username">
                <input value={opcua.username} onChange={(e) => setOpcua((o) => ({ ...o, username: e.target.value }))} style={inputStyle} />
              </InlineField>
              <InlineField label="Password">
                <input type="password" value={opcua.password} onChange={(e) => setOpcua((o) => ({ ...o, password: e.target.value }))} style={inputStyle} />
              </InlineField>
            </>
          ) : null}

          {opcua.authMode === 'Certificate' ? (
            <InlineField label="Client certificate PEM">
              <input
                type="file"
                accept=".pem,.crt,.cer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  setOpcua((o) => ({ ...o, certificatePem: text }));
                }}
                style={inputStyle}
              />
              {opcua.certificatePem ? <div style={{ color: '#9BA3B2', fontSize: 11 }}>Loaded PEM ({opcua.certificatePem.length} chars)</div> : null}
            </InlineField>
          ) : null}

          {opcua.securityPolicy === 'None' ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,176,32,0.6)',
                  background: 'rgba(255,176,32,0.08)',
                  color: '#FFB020',
                  fontSize: 12,
                  lineHeight: 1.35,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 6 }}>
                  Security warning
                </div>
                OPC-UA “None” disables message signing/encryption for the chosen security mode.
                Prefer Basic256Sha256 when possible.
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (protocol === 'Modbus TCP') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <InlineField label="IP">
              <input value={modbus.ip} onChange={(e) => setModbus((m) => ({ ...m, ip: e.target.value }))} style={inputStyle} />
            </InlineField>
            <InlineField label="Port">
              <input type="number" value={modbus.port} onChange={(e) => setModbus((m) => ({ ...m, port: Number(e.target.value) || 0 }))} style={inputStyle} />
            </InlineField>
            <InlineField label="Unit ID">
              <input type="number" value={modbus.unitId} onChange={(e) => setModbus((m) => ({ ...m, unitId: Number(e.target.value) || 0 }))} style={inputStyle} />
            </InlineField>
          </div>

          <div
            style={{
              border: '0.5px solid #3B4560',
              borderRadius: 10,
              background: '#121824',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr auto',
                gap: 0,
                padding: '10px 12px',
                fontSize: 10,
                color: '#9BA3B2',
                fontWeight: 900,
                background: '#0F1520',
              }}
            >
              <div>Address</div>
              <div>Data type</div>
              <div>Preview</div>
              <div />
            </div>

            {modbus.registerMap.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr auto',
                  gap: 0,
                  padding: '10px 12px',
                  borderTop: '0.5px solid #3B4560',
                  alignItems: 'center',
                }}
              >
                <input
                  type="number"
                  value={r.address}
                  onChange={(e) => {
                    const address = Number(e.target.value) || 0;
                    setModbus((m) => ({
                      ...m,
                      registerMap: m.registerMap.map((x) => (x.id === r.id ? { ...x, address } : x)),
                    }));
                  }}
                  style={inputStyle}
                />
                <select
                  value={r.dataType}
                  onChange={(e) => {
                    const dataType = e.target.value as ModbusTcpRegisterRow['dataType'];
                    setModbus((m) => ({
                      ...m,
                      registerMap: m.registerMap.map((x) => (x.id === r.id ? { ...x, dataType } : x)),
                    }));
                  }}
                  style={inputStyle}
                >
                  <option value="int16">int16</option>
                  <option value="uint16">uint16</option>
                  <option value="int32">int32</option>
                  <option value="uint32">uint32</option>
                  <option value="float32">float32</option>
                </select>

                <div style={{ color: '#9BA3B2', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  {`A${r.address} (${r.dataType})`}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setModbus((m) => ({
                      ...m,
                      registerMap: m.registerMap.length <= 1 ? m.registerMap : m.registerMap.filter((x) => x.id !== r.id),
                    }));
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#E5484D',
                    cursor: 'pointer',
                    fontWeight: 900,
                  }}
                  title="Remove row"
                  aria-label="Remove register map row"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setModbus((m) => ({ ...m, registerMap: [...m.registerMap, newRegisterRow()] }))}
              style={secondaryButtonStyle}
            >
              + Add register
            </button>
          </div>

          {protocolWarning(protocol)}
        </div>
      );
    }

    return (
      <div style={{ color: '#9BA3B2', fontSize: 12 }}>
        No configuration fields implemented for protocol: <b style={{ color: '#C8D0DC' }}>{protocol}</b>.
      </div>
    );
  }, [protocol, mqtt, opcua, modbus]);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!segment_assignment.trim()) return false;
    if (!protocolList.includes(protocol)) return false;
    return true;
  }, [name, segment_assignment, protocol]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setToast(null);
    setIsSaving(true);
    try {
      const payloadGateway: GatewayConfig = {
        id: mode === 'edit' ? gateway?.id ?? '' : gateway?.id ?? crypto.randomUUID(),
        name: name.trim(),
        protocol,
        source,
        segment_assignment: segment_assignment.trim(),
        last_seen_at: gateway?.last_seen_at ?? null,
        status,
      };
      await onSave(payloadGateway);
      onClose();
    } catch (e) {
      setToast({ type: 'error', message: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = () => {
    setToast({ type: 'error', message: 'Live connection testing not yet available' });
  };

  return (
    <ModalShell
      title={mode === 'create' ? 'Register New Gateway' : `Edit Gateway: ${gateway?.name ?? ''}`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {toast ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${toast.type === 'success' ? 'rgba(90,191,165,0.6)' : 'rgba(255,176,32,0.6)'}`,
                  background: toast.type === 'success' ? 'rgba(90,191,165,0.10)' : 'rgba(255,176,32,0.08)',
                  color: toast.type === 'success' ? '#5ABFA5' : '#FFB020',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {toast.message}
              </div>
            ) : (
              <div style={{ height: 0 }} />
            )}

            <div style={{ color: '#9BA3B2', fontSize: 11 }}>
              Test Connection: {`Live connection testing not yet available`} (no fake success).
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" style={secondaryButtonStyle} onClick={handleTestConnection} disabled={isSaving}>
              Test Connection
            </button>
            <button
              type="button"
              style={{
                ...primaryButtonStyle,
                opacity: canSave && !isSaving ? 1 : 0.6,
                cursor: canSave && !isSaving ? 'pointer' : 'not-allowed',
              }}
              onClick={handleSave}
              disabled={!canSave || isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <InlineField label="Gateway name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="EG-01" />
        </InlineField>

        <InlineField label="Protocol">
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as Protocol)}
            style={inputStyle}
          >
            {protocolList.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </InlineField>

        <InlineField label="Source" hint="Real or simulator source type for gateway." >
          <select value={source} onChange={(e) => setSource(e.target.value as GatewaySourceType)} style={inputStyle}>
            <option value="real">real</option>
            <option value="simulator">simulator</option>
          </select>
        </InlineField>

        <InlineField label="Segment assignment">
          <input
            value={segment_assignment}
            onChange={(e) => setSegmentAssignment(e.target.value)}
            style={inputStyle}
            placeholder="SEG-021"
          />
        </InlineField>

        <InlineField label="Registry status">
          <select value={status} onChange={(e) => setStatus(e.target.value as GatewayStatus)} style={inputStyle}>
            <option value="online">online</option>
            <option value="offline">offline</option>
            <option value="degraded">degraded</option>
          </select>
        </InlineField>

        <div />

        <div style={{ gridColumn: '1 / -1' }}>
          {protocolForm}
        </div>
      </div>

      <div style={{ marginTop: 12, color: '#9BA3B2', fontSize: 11, lineHeight: 1.35 }}>
        Note: This UI captures protocol-specific connection fields, but the existing backend `PUT /api/v1/gateways/:gatewayId`
        currently persists only top-level registry fields (name/protocol/source/segment_assignment/status). Protocol connection
        fields are collected here for the next backend update.
      </div>
    </ModalShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0F1520',
  border: '0.5px solid #3B4560',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#C8D0DC',
  fontSize: 12,
  outline: 'none',
};

const primaryButtonStyle: React.CSSProperties = {
  background: '#5ABFA5',
  border: '0.5px solid rgba(90,191,165,0.7)',
  color: '#0B1210',
  fontSize: 13,
  borderRadius: 10,
  padding: '10px 16px',
  fontWeight: 950,
};

const secondaryButtonStyle: React.CSSProperties = {
  background: '#1E2533',
  border: '0.5px solid #3B4560',
  color: '#C8D0DC',
  fontSize: 13,
  borderRadius: 10,
  padding: '10px 16px',
  fontWeight: 900,
};

