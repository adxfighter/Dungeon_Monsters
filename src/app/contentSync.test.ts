import { describe, expect, it } from 'vitest';
import { DIFFICULTY_IDS } from '@content/difficulty';
import { SETTINGS_DIFFICULTIES } from '@platform/settings';

describe('content ↔ platform sync', () => {
  it('the settings difficulty list matches the content difficulty ids', () => {
    expect([...SETTINGS_DIFFICULTIES]).toEqual([...DIFFICULTY_IDS]);
  });
});
