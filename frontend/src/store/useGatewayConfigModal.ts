import { useEffect, useMemo, useState } from 'react';
import type { GatewayConfig } from '../types/gateway';
import { useStore } from './useStore';

export type GatewayConfigModalManagerState = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  gateway?: GatewayConfig;
  openCreate: () => void;
  openEdit: (gateway: GatewayConfig) => void;
  close: () => void;
  setGateway: (g: GatewayConfig | undefined) => void;

  // Used to force RegisteredGatewaysList to reload immediately after saves.
  gatewayRefreshVersion: number;
  triggerGatewayRefresh: () => void;
};



export function useGatewayConfigModalManager(): GatewayConfigModalManagerState {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [gateway, setGateway] = useState<GatewayConfig | undefined>(undefined);

  const { gatewayRefreshVersion, triggerGatewayRefresh } = useStore();


  const openCreate = () => {
    setMode('create');
    setGateway(undefined);
    setIsOpen(true);
  };

  const openEdit = (g: GatewayConfig) => {
    setMode('edit');
    setGateway(g);
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  useEffect(() => {
    const onCreate = () => openCreate();
    const onEdit = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail) openEdit(ce.detail as GatewayConfig);
    };

    window.addEventListener('gateway-config-create', onCreate as any);
    window.addEventListener('gateway-config-edit', onEdit as any);
    return () => {
      window.removeEventListener('gateway-config-create', onCreate as any);
      window.removeEventListener('gateway-config-edit', onEdit as any);
    };
  }, []);

  return useMemo(
    () => ({
      isOpen,
      mode,
      gateway,
      openCreate,
      openEdit,
      close,
      setGateway,
      gatewayRefreshVersion,
      triggerGatewayRefresh,
    }),
    [gateway, isOpen, mode, gatewayRefreshVersion]
  );
}


