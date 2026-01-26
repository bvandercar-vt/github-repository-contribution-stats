import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type { Config } from 'jest';
import { createDefaultPreset } from 'ts-jest';
import { pathsToModuleNameMapper } from 'ts-jest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsconfig = JSON.parse(readFileSync(join(__dirname, 'tsconfig.json'), 'utf-8'));

const tsJestTransformCfg = createDefaultPreset().transform;

const jestConfig: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    ...tsJestTransformCfg,
  },
  modulePaths: [tsconfig.compilerOptions.baseUrl],
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
};

export default jestConfig;
