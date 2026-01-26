import { mockYamlParse } from '../__helpers__/mock_yaml_parse';
import { parseInputs } from '../src';

// const fixturesFolder = `${__dirname}/../__fixtures__`;

describe('parseInputs', () =>
  it('example-workflow.yml', () => {
    mockYamlParse(`${__dirname}/../example-workflow.yml`);
    expect(parseInputs()).toEqual({
      output_file: 'github-contributor-stats.svg',
      combine_all_yearly_contributions: true,
      columns: ['star_rank', 'contribution_rank'],
      order_by: 'stars',
      username: 'Atry',
      hide_border: false,
      hide_title: false,
      hide: [],
      theme: 'default',
      limit: -1,
    });
  }));
