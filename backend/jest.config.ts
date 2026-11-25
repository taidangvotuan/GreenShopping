import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

// Cấu hình UNIT test (`npm run test:unit`): spec cạnh mã nguồn trong src/ và trong test/unit/.
// E2E (cần MySQL) dùng cấu hình riêng test/jest-e2e.json (`npm run test:e2e`).
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test/unit'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    // Prisma Client sinh ra (src/generated) import kèm đuôi ".js" → trỏ về file .ts khi chạy ts-jest
    '^(\\.{1,2}/.*)\\.js$': '$1',
    ...pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
