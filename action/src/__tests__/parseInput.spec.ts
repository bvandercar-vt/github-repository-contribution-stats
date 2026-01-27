import { mockYamlParse } from '../__helpers__/mock_yaml_parse';
import { parseInputs, type ValidatedInputs } from '../parseInputs';

const fixturesFolder = `${__dirname}/../__fixtures__`;

const base = {
  output_file: 'github-contributor-stats.svg',
  combine_all_yearly_contributions: true,
  order_by: 'stars',
  username: 'Atry',
  hide_border: false,
  hide_title: false,
  theme: 'default',
  limit: -1,
  exclude: [],
} satisfies Partial<ValidatedInputs>;

const originalEnv = process.env;

describe('parseInputs', () => {
  beforeEach(() => {
    jest.resetModules();
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('INPUT_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('example-workflow.yml', () => {
    mockYamlParse(`${__dirname}/../../example-workflow.yml`);
    expect(parseInputs()).toEqual({
      ...base,
      columns: [
        { name: 'star_rank', hide: [] },
        { name: 'contribution_rank', hide: [] },
      ],
    });
  });

  it('columns-object.yml', () => {
    mockYamlParse(`${fixturesFolder}/columns-object.yml`);
    expect(parseInputs()).toEqual({
      ...base,
      columns: [
        { name: 'star_rank', hide: [] },
        { name: 'contribution_rank', hide: ['B'] },
        { name: 'commits', minimum: 2 },
      ],
    });
  });
});
