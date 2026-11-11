import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withWarmupHint } from '../api';

describe('withWarmupHint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves the work result', async () => {
    const promise = withWarmupHint(() => Promise.resolve('ok'));
    await expect(promise).resolves.toBe('ok');
  });

  it('calls onSlow after the delay while still pending', async () => {
    const onSlow = vi.fn();
    let resolveWork!: (value: string) => void;
    const work = () => new Promise<string>((resolve) => {
      resolveWork = resolve;
    });

    const pending = withWarmupHint(work, onSlow, 2500);
    expect(onSlow).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2500);
    expect(onSlow).toHaveBeenCalledTimes(1);

    resolveWork('done');
    await expect(pending).resolves.toBe('done');
  });
});
