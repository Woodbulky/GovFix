// Sun position over Navnagar (about 18.5° N, IST) from a sim-time Date. Cosmetic only: no SLA logic here.

const IST_OFFSET_MIN = 330;
const SUNRISE = 6.25;
const SUNSET = 18.6;
const NOON_ELEVATION = 68;

export type Sun = {
  /** Unit vector towards the sun in city space (+x east, +y up, +z south). */
  dir: [number, number, number];
  elevation: number;
  /** 0 by day, 1 at night, smooth through dusk and dawn. */
  night: number;
  hour: number;
};

export function sunAt(date: Date): Sun {
  const minutes = (date.getUTCHours() * 60 + date.getUTCMinutes() + IST_OFFSET_MIN) % 1440;
  const hour = minutes / 60;
  const t = (hour - SUNRISE) / (SUNSET - SUNRISE); // 0 at sunrise, 1 at sunset
  const elevation = Math.sin(t * Math.PI) * NOON_ELEVATION * (t >= 0 && t <= 1 ? 1 : 0.35);
  const azimuth = ((100 + t * 160) * Math.PI) / 180; // east-south-east to west-south-west, from north clockwise
  const el = (elevation * Math.PI) / 180;
  const dir: Sun['dir'] = [Math.sin(azimuth) * Math.cos(el), Math.sin(el), -Math.cos(azimuth) * Math.cos(el)];
  const night = Math.min(1, Math.max(0, (4 - elevation) / 10));
  return { dir, elevation, night: night * night * (3 - 2 * night), hour };
}

/** A fixed late-morning sun for when "follow sim time" is off. */
export const DAY = sunAt(new Date(Date.UTC(2026, 9, 11, 5, 0)));
