import { describe, it, expect } from 'vitest';
import { classifyConfigChange } from '../lib';

describe('classifyConfigChange (model + effort reactivity)', () => {
	it('classifies a model change', () => {
		expect(classifyConfigChange('model', 'deepseek/deepseek-v4-pro')).toBe('model');
	});

	it('classifies an effort change', () => {
		expect(classifyConfigChange('effort', 'high')).toBe('effort');
	});

	it('returns null for an unrelated setting', () => {
		expect(classifyConfigChange('theme', 'dark')).toBeNull();
	});

	it('returns null for a non-string model value', () => {
		expect(classifyConfigChange('model', 42)).toBeNull();
	});

	it('returns null for an empty model value', () => {
		expect(classifyConfigChange('model', '')).toBeNull();
	});

	it('returns null for an empty effort value', () => {
		expect(classifyConfigChange('effort', '')).toBeNull();
	});
});
