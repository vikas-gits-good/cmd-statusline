import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../lib';

describe('debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('collapses multiple calls within the window into one', () => {
		const fn = vi.fn();
		const d = debounce(fn, 300);
		d();
		d();
		d();
		vi.advanceTimersByTime(299);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('fires once after the delay for a single call', () => {
		const fn = vi.fn();
		debounce(fn, 300)();
		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('resets the timer on each call', () => {
		const fn = vi.fn();
		const d = debounce(fn, 300);
		d();
		vi.advanceTimersByTime(200);
		d();
		vi.advanceTimersByTime(200);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('cancel() prevents the pending call from firing', () => {
		const fn = vi.fn();
		const d = debounce(fn, 300);
		d();
		d.cancel();
		vi.advanceTimersByTime(500);
		expect(fn).not.toHaveBeenCalled();
	});
});
