// One generation per page session: later visits to the explorer reuse the same data.
import type { CityData } from './city';

let pending: Promise<CityData> | null = null;

export function loadCity(): Promise<CityData> {
  pending ??= new Promise<CityData>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch {
      // No module workers: generate on the main thread (slower first paint, same city).
      import('./city').then((m) => resolve(m.generateCity()), reject);
      return;
    }
    worker.onmessage = (e: MessageEvent<{ ok: boolean; data?: CityData; error?: string }>) => {
      worker.terminate();
      if (e.data.ok && e.data.data) resolve(e.data.data);
      else reject(new Error(e.data.error ?? 'City generation failed'));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage(null);
  }).catch((e) => {
    pending = null; // let a retry try again
    throw e;
  });
  return pending;
}
