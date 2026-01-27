import { matchWildcard } from '../utils';

describe('matchWildcard', () => {
  it('matches strings against patterns with wildcards', () => {
    expect(matchWildcard('repository-name', 'repo*name')).toBe(true);
    expect(matchWildcard('repository-name', '*name')).toBe(true);
    expect(matchWildcard('repository-name', 'repo*')).toBe(true);
    expect(matchWildcard('repository-name', '*posi*')).toBe(true);
    expect(matchWildcard('repository-name', 'repo-name')).toBe(false);
    expect(matchWildcard('repository-name', 'repo*xyz')).toBe(false);
    expect(matchWildcard('repository-name', 'xyz*name')).toBe(false);
    expect(matchWildcard('repository-name', '*xyz*')).toBe(false);
  });
});
