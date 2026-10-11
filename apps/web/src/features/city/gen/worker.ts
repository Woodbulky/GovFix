// Builds the city off the main thread so the page stays responsive on first load.
import { generateCity, transferables } from './city';

self.onmessage = () => {
  try {
    const data = generateCity();
    (self as unknown as Worker).postMessage({ ok: true, data }, transferables(data));
  } catch (e) {
    (self as unknown as Worker).postMessage({ ok: false, error: String(e) });
  }
};
