import type { OrthographicCamera } from 'three';
import { vehiclePerspective } from './perspective';

const profiles = {
  school: { range: 2.8, gain: 0.62 },
  lunch: { range: 1.9, gain: 0.53 },
  garden: { range: 1.3, gain: 0.57 },
  shutter: { range: 2.1, gain: 0.65 },
};
export type SidewalkClip = keyof typeof profiles;
export interface SidewalkSource {
  clip: SidewalkClip;
  point: { x: number; z: number };
  strength: number;
}

// Blend nearby groups into one stereo image per recording. A crowded gate can
// get louder without playing several synchronized copies of the same children.
export function sidewalkMix(
  sources: Iterable<SidewalkSource>,
  focus: { x: number; y: number },
  camera: OrthographicCamera
) {
  const mix = new Map<SidewalkClip, { gain: number; pan: number }>();
  const right = camera.matrixWorld.elements;
  for (const { clip, point, strength } of sources) {
    const profile = profiles[clip];
    const perspective = vehiclePerspective(
      point.x - focus.x,
      point.z - focus.y,
      camera.zoom,
      right[0],
      right[2],
      profile.range
    );
    const gain = strength * perspective.gain;
    if (gain < 0.015) continue;
    const total = mix.get(clip) ?? { gain: 0, pan: 0 };
    total.gain += gain;
    total.pan += gain * perspective.pan;
    mix.set(clip, total);
  }
  for (const [clip, value] of mix) {
    value.pan /= value.gain;
    value.gain = profiles[clip].gain * (1 - Math.exp(-value.gain));
  }
  return mix;
}

export class SidewalkAudio {
  private layers = new Map<
    SidewalkClip,
    { level: GainNode; stereo: StereoPannerNode }
  >();
  constructor(
    private ctx: AudioContext,
    private ambience: GainNode,
    private effects: GainNode
  ) {}

  update(
    sources: Iterable<SidewalkSource>,
    focus: { x: number; y: number },
    camera: OrthographicCamera,
    buffers: Pick<ReadonlyMap<SidewalkClip, AudioBuffer>, 'get'>
  ) {
    const mix = sidewalkMix(sources, focus, camera);
    for (const clip of mix.keys()) {
      const buffer = buffers.get(clip);
      if (!buffer || this.layers.has(clip)) continue;
      const loop = this.ctx.createBufferSource(),
        level = this.ctx.createGain(),
        stereo = this.ctx.createStereoPanner();
      level.gain.value = 0;
      stereo.pan.value = mix.get(clip)!.pan;
      loop.buffer = buffer;
      loop.loop = true;
      loop
        .connect(level)
        .connect(stereo)
        .connect(clip === 'shutter' ? this.effects : this.ambience);
      loop.start(0, this.ctx.currentTime % buffer.duration);
      this.layers.set(clip, { level, stereo });
    }
    for (const [clip, layer] of this.layers) {
      const target = mix.get(clip);
      layer.level.gain.setTargetAtTime(
        target?.gain ?? 0,
        this.ctx.currentTime,
        clip === 'shutter' ? 0.06 : 0.15
      );
      if (target)
        layer.stereo.pan.setTargetAtTime(target.pan, this.ctx.currentTime, 0.1);
    }
  }

  silence() {
    for (const { level } of this.layers.values()) {
      level.gain.cancelScheduledValues(this.ctx.currentTime);
      level.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }
}
