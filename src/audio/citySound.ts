import type { ICity } from '../city';
import type { ICameraManager } from '../cameraManager';
import type { OrthographicCamera } from 'three';
import type { BusLine } from '../sceneManager/busLine';
import { channels, soundSettings, type Channel } from './preferences';
import { neighborhoodMix, vehiclePerspective } from './perspective';
import type { Vehicle } from '../city/vehicle';
import { RoadAudio } from './roadAudio';
import car from './recordings/car.ogg';
import tyres from './recordings/tyres.ogg';
import shore from './recordings/shore.ogg';
import leaves from './recordings/leaves.ogg';
import street from './recordings/street.ogg';
import night from './recordings/night.ogg';
import engine from './recordings/engine.ogg';
import door from './recordings/door.ogg';
import doorClose from './recordings/close.ogg';
import departure from './recordings/departure.ogg';

const files = {
  car,
  tyres,
  shore,
  leaves,
  street,
  night,
  engine,
  door,
  doorClose,
  departure,
};
type Clip = keyof typeof files;
const beds = ['shore', 'leaves', 'street', 'night'] as const;

function ease(
  parameter: AudioParam,
  value: number,
  time: number,
  seconds = 0.12
) {
  parameter.setTargetAtTime(value, time, seconds);
}

class Mixer {
  readonly context = new AudioContext();
  readonly master = this.context.createGain();
  readonly groups = new Map<Channel, GainNode>();
  private road: RoadAudio;
  private filter = this.context.createBiquadFilter();
  private busPan = this.context.createStereoPanner();
  private busVolume = this.context.createGain();
  private buffers = new Map<Clip, AudioBuffer>();
  private levels = new Map<Clip, GainNode>();
  private playingCues = new Set<AudioBufferSourceNode>();
  private previousBus?: number;
  private previousPhase?: string;
  private nextPhrase = 0;
  private phraseIndex = 0;
  private lastEffect = -1;
  private requests = new AbortController();

  constructor() {
    const ctx = this.context;
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    for (const name of channels) {
      const gain = ctx.createGain();
      gain.connect(this.master);
      this.groups.set(name, gain);
    }
    this.road = new RoadAudio(ctx, this.groups.get('vehicles')!);
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.5;
    this.filter.connect(this.groups.get('ambience')!);
    this.busVolume.gain.value = 0;
    this.busVolume.connect(this.busPan);
    this.busPan.connect(this.groups.get('vehicles')!);
    for (const name of Object.keys(files) as Clip[]) void this.load(name);
  }

  private async load(name: Clip) {
    try {
      const result = await fetch(files[name], { signal: this.requests.signal });
      if (!result.ok) throw Error(result.statusText);
      const buffer = await this.context.decodeAudioData(
        await result.arrayBuffer()
      );
      if (this.requests.signal.aborted) return;
      this.buffers.set(name, buffer);
      if (name !== 'engine' && !beds.some((bed) => bed === name)) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = this.context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(name === 'engine' ? this.busVolume : this.filter);
      this.levels.set(name, gain);
      source.start();
    } catch (error) {
      if (!this.requests.signal.aborted)
        console.warn('Could not load city audio', name, error);
    }
  }

  settings(audible: boolean) {
    const prefs = soundSettings.read(),
      time = this.context.currentTime;
    ease(this.master.gain, audible ? prefs.master : 0, time, 0.035);
    for (const [name, gain] of this.groups)
      ease(gain.gain, prefs[name], time, 0.04);
  }

  update(
    city: ICity,
    focus: { x: number; y: number },
    camera: OrthographicCamera,
    dark: number,
    moving: boolean,
    bus: BusLine['soundSource'],
    traffic: readonly Vehicle[]
  ) {
    const t = this.context.currentTime;
    const mix = neighborhoodMix(city, focus.x, focus.y, camera.zoom, dark);
    ease(this.filter.frequency, mix.cutoff, t, 0.4);
    for (const bed of beds) {
      const level = this.levels.get(bed);
      if (level) ease(level.gain, mix[bed] * (moving ? 1 : 0.36), t, 0.4);
    }
    this.road.update(
      traffic,
      focus,
      camera,
      this.buffers.get('car'),
      this.buffers.get('tyres')
    );
    const perspective =
      bus &&
      vehiclePerspective(
        bus.position.x - focus.x,
        bus.position.z - focus.y,
        camera.zoom,
        camera.matrixWorld.elements[0],
        camera.matrixWorld.elements[2]
      );
    ease(
      this.busVolume.gain,
      moving && perspective ? perspective.gain : 0,
      t,
      0.06
    );
    if (!moving || bus?.id !== this.previousBus) this.resetBus();
    if (bus && perspective) {
      ease(this.busPan.pan, perspective.pan, t);
      const phase = bus.doorPhase;
      const level = this.levels.get('engine');
      if (level) ease(level.gain, phase === 'moving' ? 0.67 : 0.42, t);
      if (
        moving &&
        perspective.gain > 0.025 &&
        this.previousBus === bus.id &&
        phase !== this.previousPhase
      ) {
        const cues = {
          moving: 'departure',
          closing: 'doorClose',
          open: 'door',
        } as const;
        this.busCue(cues[phase]);
      }
      this.previousPhase = phase;
    }
    this.previousBus = bus?.id;
    if (moving && soundSettings.read().music > 0 && t >= this.nextPhrase) {
      // A short electric-piano voicing with long stretches of city sound between phrases.
      const notes = [
        [50, 57, 64, 66],
        [47, 54, 61, 62],
        [43, 54, 57, 62],
        [45, 52, 59, 61],
      ];
      notes[this.phraseIndex++ % notes.length].forEach((note, i) =>
        this.note(
          'music',
          440 * 2 ** ((note - 69) / 12),
          t + i * 0.36,
          2.8,
          0.11
        )
      );
      this.nextPhrase = t + 23;
    }
  }

  silenceTraffic() {
    this.road.silence();
    this.resetBus();
  }

  resetBus() {
    this.previousBus = undefined;
    for (const cue of this.playingCues) cue.stop();
    this.playingCues.clear();
  }

  private busCue(name: 'door' | 'doorClose' | 'departure') {
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const source = this.context.createBufferSource(),
      level = this.context.createGain();
    source.buffer = buffer;
    level.gain.value = name === 'departure' ? 0.72 : 0.95;
    source.connect(level);
    level.connect(this.busVolume);
    this.playingCues.add(source);
    source.onended = () => {
      this.playingCues.delete(source);
      source.disconnect();
      level.disconnect();
    };
    source.start();
  }

  feedback(channel: 'interface' | 'effects') {
    const t = this.context.currentTime;
    if (channel === 'effects' && t - this.lastEffect < 0.15) return;
    if (channel === 'effects') this.lastEffect = t;
    this.note(
      channel,
      channel === 'interface' ? 710 : 165,
      t,
      channel === 'interface' ? 0.045 : 0.13,
      0.14
    );
  }

  private note(
    channel: Channel,
    hz: number,
    at: number,
    duration: number,
    amplitude: number
  ) {
    const osc = this.context.createOscillator(),
      env = this.context.createGain();
    osc.type = channel === 'music' ? 'sine' : 'triangle';
    osc.frequency.value = hz;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(amplitude, at + 0.009);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env);
    env.connect(this.groups.get(channel)!);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
    osc.start(at);
    osc.stop(at + duration);
  }

  dispose() {
    this.requests.abort();
    void this.context.close();
  }
}

export class CitySound {
  private mixer?: Mixer;
  private unsubscribe: () => void;
  private suspendTimer?: number;
  private lastUpdate = -Infinity;
  private disposed = false;

  constructor() {
    this.unsubscribe = soundSettings.subscribe(this.sync);
    document.addEventListener('visibilitychange', this.sync);
    document.addEventListener('pointerup', this.unlock);
    document.addEventListener('keydown', this.unlock);
    document.addEventListener('click', this.onClick);
  }

  private unlock = () => {
    if (
      document.hidden ||
      !soundSettings.read().enabled ||
      typeof AudioContext === 'undefined'
    )
      return;
    this.mixer ??= new Mixer();
    if (this.mixer.context.state !== 'running')
      void this.mixer.context.resume().catch(() => {});
    this.mixer.settings(true);
  };

  private sync = () => {
    window.clearTimeout(this.suspendTimer);
    if (!document.hidden && soundSettings.read().enabled) {
      this.unlock();
      return;
    }
    const mixer = this.mixer;
    if (!mixer) return;
    mixer.silenceTraffic();
    mixer.settings(false);
    this.suspendTimer = window.setTimeout(() => {
      if (document.hidden || !soundSettings.read().enabled)
        void mixer.context.suspend().catch(() => {});
    }, 180);
  };

  private onClick = (event: MouseEvent) => {
    if (
      event.target instanceof Element &&
      event.target.closest('#ui-root button')
    )
      this.feedback('interface');
  };

  feedback(channel: 'interface' | 'effects') {
    if (!document.hidden && soundSettings.read().enabled)
      this.mixer?.feedback(channel);
  }

  update(
    time: number,
    city: ICity,
    view: ICameraManager,
    dark: number,
    moving: boolean,
    line: BusLine,
    traffic: readonly Vehicle[]
  ) {
    if (
      this.disposed ||
      !this.mixer ||
      document.hidden ||
      !soundSettings.read().enabled ||
      time - this.lastUpdate < 65
    )
      return;
    this.lastUpdate = time;
    this.mixer.update(
      city,
      view.getFocus(),
      view.camera,
      dark,
      moving,
      line.soundSource,
      moving ? traffic : []
    );
  }

  dispose() {
    this.disposed = true;
    window.clearTimeout(this.suspendTimer);
    this.unsubscribe();
    document.removeEventListener('visibilitychange', this.sync);
    document.removeEventListener('pointerup', this.unlock);
    document.removeEventListener('keydown', this.unlock);
    document.removeEventListener('click', this.onClick);
    this.mixer?.dispose();
  }
}
