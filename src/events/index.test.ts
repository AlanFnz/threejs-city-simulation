import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '.';

interface TestEventMap {
  [key: string]: unknown;
  ping: { count: number };
  pong: { message: string };
}

describe('EventBus', () => {
  it('calls a listener with the emitted payload', () => {
    const bus = new EventBus<TestEventMap>();
    const listener = vi.fn();
    bus.on('ping', listener);

    bus.emit('ping', { count: 1 });

    expect(listener).toHaveBeenCalledWith({ count: 1 });
  });

  it('calls multiple listeners for the same event', () => {
    const bus = new EventBus<TestEventMap>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('ping', a);
    bus.on('ping', b);

    bus.emit('ping', { count: 1 });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('does not call listeners registered for a different event', () => {
    const bus = new EventBus<TestEventMap>();
    const pingListener = vi.fn();
    const pongListener = vi.fn();
    bus.on('ping', pingListener);
    bus.on('pong', pongListener);

    bus.emit('ping', { count: 1 });

    expect(pingListener).toHaveBeenCalledTimes(1);
    expect(pongListener).not.toHaveBeenCalled();
  });

  it('emitting with no listeners does not throw', () => {
    const bus = new EventBus<TestEventMap>();
    expect(() => bus.emit('ping', { count: 1 })).not.toThrow();
  });

  it('the unsubscribe function returned by on() removes only that listener', () => {
    const bus = new EventBus<TestEventMap>();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = bus.on('ping', a);
    bus.on('ping', b);

    unsubscribeA();
    bus.emit('ping', { count: 1 });

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('off() removes a specific listener', () => {
    const bus = new EventBus<TestEventMap>();
    const listener = vi.fn();
    bus.on('ping', listener);

    bus.off('ping', listener);
    bus.emit('ping', { count: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('clear() removes every listener for every event', () => {
    const bus = new EventBus<TestEventMap>();
    const pingListener = vi.fn();
    const pongListener = vi.fn();
    bus.on('ping', pingListener);
    bus.on('pong', pongListener);

    bus.clear();
    bus.emit('ping', { count: 1 });
    bus.emit('pong', { message: 'hi' });

    expect(pingListener).not.toHaveBeenCalled();
    expect(pongListener).not.toHaveBeenCalled();
  });
});
