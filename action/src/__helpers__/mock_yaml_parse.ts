import fs from 'fs';
import * as path from 'path';

import yaml from 'js-yaml';

const actionYml = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../action.yml'), 'utf8'),
) as Record<string, unknown>;
const defaults = Object.fromEntries(
  Object.entries(actionYml.inputs as Record<string, { default?: unknown }>).map(
    ([key, { default: value }]) => [key, value],
  ),
);

export function mockYamlParse(file: `${string}.${'yml' | 'yaml'}`) {
  const input = yaml.load(fs.readFileSync(file, 'utf8')) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const a = input['jobs']['update-stats'].steps.find((step: { uses?: string }) =>
    step.uses?.includes('github-repository-contribution-stats'),
  )?.with;

  for (const [key, value] of Object.entries({ ...defaults, ...a })) {
    if (value === undefined) continue;
    const formattedKey = `INPUT_${key.toUpperCase()}`;
    process.env[formattedKey] = typeof value === 'string' ? value : JSON.stringify(value);
  }
}
