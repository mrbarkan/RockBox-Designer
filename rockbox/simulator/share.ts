import { isSimulatorScenarioId } from './scenarios';
import type { SimulatorScenarioId } from './types';

export const scenarioFromSearch = (search: string): SimulatorScenarioId | null => {
  const value = new URLSearchParams(search).get('play');
  return isSimulatorScenarioId(value) ? value : null;
};

export const scenarioShareUrl = (baseUrl: string, scenario: SimulatorScenarioId) => {
  const url = new URL(baseUrl);
  url.searchParams.set('play', scenario);
  return url.toString();
};
