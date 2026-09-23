import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ONBOARDING_SEQUENCE,
  getOnboardingResumeSlug,
  getOnboardingStepIndex,
} from '../../modules/onboarding/sequence.ts';

test('every persisted onboarding index resumes its corresponding stage', () => {
  // Explicit persisted positions protect existing in-progress accounts when
  // changing the flow, especially the five stages after trips.
  const expected = [
    'name', 'birthday', 'nationality', 'gender', 'interests', 'pause',
    'picture', 'languages', 'bio', 'preferences', 'gender-preference',
    'trips', 'location-intro', 'location', 'notifications', 'rating', 'take-a-bow',
  ];
  assert.equal(ONBOARDING_SEQUENCE.length, expected.length);
  expected.forEach((slug, index) => {
    assert.equal(getOnboardingResumeSlug(index), slug, `persisted step ${index}`);
    assert.equal(getOnboardingStepIndex(slug), index);
  });
});

test('out-of-range or invalid persisted progress always resolves to a real stage', () => {
  assert.equal(getOnboardingResumeSlug(-1), 'name');
  assert.equal(getOnboardingResumeSlug(17), 'take-a-bow');
  assert.equal(getOnboardingResumeSlug(100), 'take-a-bow');
  assert.equal(getOnboardingResumeSlug(13.5), 'location');
  assert.equal(getOnboardingResumeSlug(NaN), 'name');
  assert.equal(getOnboardingResumeSlug(Infinity), 'name');
});

test('unknown deep-link slugs never resolve as onboarding stages', () => {
  for (const slug of ['', 'missing-step', 'toString', 'constructor', '__proto__']) {
    assert.equal(getOnboardingStepIndex(slug), undefined);
  }
});
