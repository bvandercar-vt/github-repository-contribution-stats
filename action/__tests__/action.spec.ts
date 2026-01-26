import { mockYamlParse } from '../__helpers__/mock_yaml_parse';
import type { ValidatedActionInputs } from '../src';
import { parseActionInputs } from '../src';

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
} satisfies Partial<ValidatedActionInputs>;

describe('parseActionInputs', () => {
  it('example-workflow.yml', () => {
    mockYamlParse(`${__dirname}/../example-workflow.yml`);
    expect(parseActionInputs()).toEqual({
      ...base,
      columns: [
        { name: 'star_rank', hide: [] },
        { name: 'contribution_rank', hide: [] },
      ],
    });
  });

  it('columns-object.yml', () => {
    mockYamlParse(`${fixturesFolder}/columns-object.yml`);
    expect(parseActionInputs()).toEqual({
      ...base,
      columns: [
        { name: 'star_rank', hide: [] },
        { name: 'contribution_rank', hide: ['B'] },
        { name: 'commits', minimum: 2 },
      ],
    });
  });
});
