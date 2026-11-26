import type { OrthographicCamera } from 'three';
import type { Vehicle } from '../city/vehicle';
import { vehiclePerspective } from './perspective';

interface PassingVehicle {
  car: Vehicle;
  gain: number;
  pan: number;
}

export function nearestCars(
  traffic: readonly Vehicle[],
  focus: { x: number; y: number },
  camera: OrthographicCamera,
  playing: ReadonlyMap<number, unknown>
): PassingVehicle[] {
  const candidates: PassingVehicle[] = [];
  const right = camera.matrixWorld.elements;
  for (const car of traffic) {
    if (car.kind !== 'car') continue;
    const { gain, pan } = vehiclePerspective(
      car.position.x - focus.x,
      car.position.z - focus.y,
      camera.zoom,
      right[0],
      right[2],
      3.5
    );
    if (gain > 0.018) candidates.push({ car, gain, pan });
  }
  // Give an audible car a small lead to avoid swapping two neighbours every frame.
  const priority = ({ car, gain }: PassingVehicle) =>
    gain * (playing.has(car.id) ? 1.12 : 1);
  return candidates.sort((a, b) => priority(b) - priority(a)).slice(0, 3);
}

class MotorVoice {
  private motor: AudioBufferSourceNode;
  private wheels: AudioBufferSourceNode;
  private roll: GainNode;
  private volume: GainNode;
  private stereo: StereoPannerNode;
  private pitch: number;

  constructor(
    private ctx: AudioContext,
    output: GainNode,
    engine: AudioBuffer,
    tyres: AudioBuffer,
    id: number
  ) {
    this.pitch = 0.93 + (id % 9) * 0.018;
    this.stereo = ctx.createStereoPanner();
    this.volume = ctx.createGain();
    this.roll = ctx.createGain();
    this.volume.gain.value = this.roll.gain.value = 0;
    this.volume.connect(this.stereo).connect(output);
    this.roll.connect(this.volume);
    const loop = (buffer: AudioBuffer, dest: GainNode) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(dest);
      source.start(0, ((id * 0.61803) % 1) * buffer.duration);
      return source;
    };
    this.motor = loop(engine, this.volume);
    this.wheels = loop(tyres, this.roll);
  }

  update({ car, pan, gain }: PassingVehicle) {
    const t = this.ctx.currentTime,
      speed = car.speedFraction;
    this.motor.playbackRate.setTargetAtTime(
      this.pitch * (0.86 + speed * 0.63),
      t,
      0.15
    );
    this.roll.gain.setTargetAtTime(speed * speed * 0.85, t, 0.09);
    this.volume.gain.setTargetAtTime(gain * (0.19 + speed * 0.24), t, 0.09);
    this.stereo.pan.setTargetAtTime(pan, t, 0.06);
  }

  release() {
    const t = this.ctx.currentTime;
    this.volume.gain.setTargetAtTime(0, t, 0.035);
    this.wheels.onended = () => {
      this.motor.disconnect();
      this.wheels.disconnect();
      this.roll.disconnect();
      this.volume.disconnect();
      this.stereo.disconnect();
    };
    this.motor.stop(t + 0.18);
    this.wheels.stop(t + 0.18);
  }
}

export class RoadAudio {
  private voices = new Map<number, MotorVoice>();

  constructor(
    private ctx: AudioContext,
    private output: GainNode
  ) {}

  update(
    traffic: readonly Vehicle[],
    focus: { x: number; y: number },
    camera: OrthographicCamera,
    engine?: AudioBuffer,
    tyres?: AudioBuffer,
    diesel?: AudioBuffer
  ) {
    if (!tyres) return;
    const nearest = engine
      ? nearestCars(traffic, focus, camera, this.voices)
      : [];
    const truck = traffic.find((vehicle) => vehicle.kind === 'truck');
    if (truck && diesel) {
      const right = camera.matrixWorld.elements;
      const { gain, pan } = vehiclePerspective(
        truck.position.x - focus.x,
        truck.position.z - focus.y,
        camera.zoom,
        right[0],
        right[2],
        5
      );
      if (gain > 0.018) nearest.push({ car: truck, gain: gain * 1.25, pan });
    }
    for (const [id, voice] of this.voices) {
      if (!nearest.some(({ car }) => car.id === id)) {
        voice.release();
        this.voices.delete(id);
      }
    }
    for (const source of nearest) {
      let voice = this.voices.get(source.car.id);
      if (!voice) {
        voice = new MotorVoice(
          this.ctx,
          this.output,
          source.car.kind === 'truck' ? diesel! : engine!,
          tyres,
          source.car.id
        );
        this.voices.set(source.car.id, voice);
      }
      voice.update(source);
    }
  }

  silence() {
    for (const voice of this.voices.values()) voice.release();
    this.voices.clear();
  }
}
