// Check registry.
import { firstImpressionChecks } from './firstImpression.js';
import { quickstartChecks } from './quickstart.js';
import { trustChecks } from './trust.js';
import { communityChecks } from './community.js';
import { discoverabilityChecks } from './discoverability.js';
import { momentumChecks } from './momentum.js';

export function runChecks(facts) {
  return [
    ...firstImpressionChecks(facts),
    ...quickstartChecks(facts),
    ...trustChecks(facts),
    ...communityChecks(facts),
    ...discoverabilityChecks(facts),
    ...momentumChecks(facts),
  ];
}

export { PILLARS } from '../pillars.js';
