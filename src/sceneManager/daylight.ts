import { Color, MathUtils } from 'three';

const night = {
  hour: 0, x: 0.35, height: 0.95,
  sun: new Color(0xabbfff), sunStrength: 0.43,
  sky: new Color(0x98aedf), ground: new Color(0x586786), skyStrength: 0.61,
  shallows: new Color(0x314965), deep: new Color(0x1f304a), lamps: 1,
};

const morning = {
  hour: 6.25, x: 1, height: 0.46,
  sun: new Color(0xffc091), sunStrength: 0.96,
  sky: new Color(0xf0cccb), ground: new Color(0xb69788), skyStrength: 1.04,
  shallows: new Color(0xa5b5bb), deep: new Color(0x738aa4), lamps: 0.52,
};

const noon = {
  hour: 12, x: -0.33, height: 1.45,
  sun: new Color(0xffedcf), sunStrength: 1.65,
  sky: new Color(0xfff9ec), ground: new Color(0xc0d9cc), skyStrength: 1.45,
  shallows: new Color(0x82c9bc), deep: new Color(0x568fa4), lamps: 0,
};

const evening = {
  hour: 18.5, x: -1, height: 0.43,
  sun: new Color(0xffad83), sunStrength: 0.85,
  sky: new Color(0xb3bce3), ground: new Color(0x78687b), skyStrength: 1.04,
  shallows: new Color(0x8498ac), deep: new Color(0x454e77), lamps: 0.84,
};

const skyStops = [
  night,
  { ...night, hour: 4.5 },
  morning,
  { ...noon, hour: 9, x: 0.72, height: 1.15 },
  noon,
  { ...noon, hour: 15.5, x: -0.82, height: 1.1 },
  evening,
  { ...night, hour: 21 },
  { ...night, hour: 24 },
];

// Interpolate in linear light. The last key matches midnight to wrap smoothly.
export function daylightAt(hour: number) {
  const next = skyStops.findIndex((stop) => stop.hour > hour);
  const a = skyStops[next - 1],
    b = skyStops[next];
  const mix = MathUtils.smoothstep(hour, a.hour, b.hour);
  return { a, b, mix };
}
