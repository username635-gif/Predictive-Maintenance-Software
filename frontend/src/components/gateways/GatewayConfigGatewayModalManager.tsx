import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import type { GatewayConfig } from '../../types/gateway';
import GatewayConfigModal from './GatewayConfigModal';
import { api } from '../../services/api';


type Toast = { type: 'success' | 'error'; message: string } | null;


type Props = {};

export default function GatewayConfigGatewayModalManager(_props: Props) {
  const { fetchGateways } = useStore();

  // Local state only; modal visibility is driven by this component.
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [gateway, setGateway] = useState<GatewayConfig | undefined>(undefined);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    const onCreate = () => {
      setMode('create');
      setGateway(undefined);
      setOpen(true);
    };

    window.addEventListener('gateway-config-create' as any, onCreate);
    return () => {
      window.removeEventListener('gateway-config-create' as any, onCreate);
    };
  }, []);

  const openEdit = (g: GatewayConfig) => {
    setMode('edit');
    setGateway(g);
    setOpen(true);
  };

  // Expose a simple event for the edit rows.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const g = ce.detail as GatewayConfig;
      if (g && typeof g.id === 'string') openEdit(g);
    };

    window.addEventListener('gateway-config-edit' as any, handler);
    return () => {
      window.removeEventListener('gateway-config-edit' as any, handler);
    };
  }, []);

  const onClose = () => {
    setOpen(false);
  };


  const onSave = async (gw: GatewayConfig) => {
    setToast(null);
    try {
      if (mode === 'create') {
        await api.createGateway({
          name: gw.name,
          protocol: gw.protocol,
          source_type: gw.source,
          segment_assignment: gw.segment_assignment,
          status: gw.status,
        });
      } else {
        await api.updateGateway(gw.id, {
          name: gw.name,
          protocol: gw.protocol,
          source: gw.source,
          segment_assignment: gw.segment_assignment,
          status: gw.status,
        });
      }

      await fetchGateways();
      setOpen(false);
    } catch (e) {
      setToast({ type: 'error', message: e instanceof Error ? e.message : 'Save failed' });
      throw e;
    }
  };

  return (
    <>
      {toast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1500,
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${toast.type === 'success' ? 'rgba(90,191,165,0.6)' : 'rgba(255,176,32,0.6)'}`,
            background: toast.type === 'success' ? 'rgba(90,191,165,0.10)' : 'rgba(255,176,32,0.08)',
            color: toast.type === 'success' ? '#5ABFA5' : '#FFB020',
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {toast.message}
        </div>
      ) : null}

      <GatewayConfigModal
        mode={mode}
        gateway={gateway}
        isOpen={open}
        onClose={onClose}
        onSave={onSave}
      />
    </>
  );
}


