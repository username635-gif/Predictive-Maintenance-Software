import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { format } from 'date-fns';

/**
 * Simulates live sensor data by updating sensor readings
 * and occasionally tweaking health scores (as a live demo).
 */
export function useSimulator() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const { sensors, segments, isOffline } = useStore.getState();

      // Update sensor readings with small noise
      const updatedSensors = sensors.map(sensor => {
        const base = sensor.last_reading?.value ?? 0;
        const noise = (sensor.normal_range[1] - sensor.normal_range[0]) * 0.005;
        const newValue = +(base + (Math.random() - 0.5) * noise).toFixed(3);
        const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
        return {
          ...sensor,
          last_reading: sensor.last_reading
            ? { ...sensor.last_reading, value: newValue, timestamp: now, was_offline: isOffline }
            : sensor.last_reading,
          history: [
            ...sensor.history.slice(-23),
            { timestamp: now, value: newValue },
          ],
        };
      });

      useStore.setState({ sensors: updatedSensors });

      // Very occasionally nudge a warning segment health slightly
      if (Math.random() < 0.05) {
        const updatedSegments = segments.map(seg => {
          if (seg.health_status === 'warning' && Math.random() < 0.3) {
            const delta = (Math.random() - 0.5) * 2;
            const newScore = Math.max(30, Math.min(69, seg.health_score + delta));
            return { ...seg, health_score: Math.round(newScore) };
          }
          return seg;
        });
        useStore.setState({ segments: updatedSegments });
      }
    }, 2000); // update every 2 seconds

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}
