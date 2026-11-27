import {
  assertTestDatabase,
  databaseNameOf,
  testDatabaseProblems,
} from '../test-database-guard';

const TEST_APP = 'mysql://green_test_app:green_test_app_pw@127.0.0.1:3308/greenshopping_test';
const TEST_MIGRATE =
  'mysql://green_test_migrate:green_test_migrate_pw@127.0.0.1:3308/greenshopping_test';
const DEV_APP = 'mysql://green_app:dev_secret_pw@localhost:3307/green_shopping';

describe('test-database-guard — E2E chỉ chạy trên MySQL test (QA-01, QA-03)', () => {
  it('đọc đúng tên database, bỏ qua query string; URL hỏng hoặc thiếu tên → null', () => {
    expect(databaseNameOf(`${TEST_APP}?connection_limit=5`)).toBe('greenshopping_test');
    expect(databaseNameOf('mysql://u:p@localhost:3307/')).toBeNull();
    expect(databaseNameOf('không phải URL')).toBeNull();
  });

  it('cho qua khi DATABASE_URL (và MIGRATION_DATABASE_URL nếu có) trỏ tới DB test', () => {
    expect(testDatabaseProblems({ DATABASE_URL: TEST_APP })).toEqual([]);
    expect(
      testDatabaseProblems({ DATABASE_URL: TEST_APP, MIGRATION_DATABASE_URL: TEST_MIGRATE }),
    ).toEqual([]);
  });

  const blocked: [string, NodeJS.ProcessEnv, string][] = [
    ['thiếu DATABASE_URL (ConfigModule sẽ nạp DB dev từ backend/.env)', {}, 'DATABASE_URL chưa được đặt'],
    ['DATABASE_URL trỏ DB dev', { DATABASE_URL: DEV_APP }, '"green_shopping"'],
    [
      'MIGRATION_DATABASE_URL trỏ DB dev',
      { DATABASE_URL: TEST_APP, MIGRATION_DATABASE_URL: DEV_APP },
      'MIGRATION_DATABASE_URL trỏ tới database "green_shopping"',
    ],
    ['DATABASE_URL không phải URL', { DATABASE_URL: 'greenshopping_test' }, '(không đọc được)'],
  ];

  it.each(blocked)('chặn: %s', (_label, env, fragment) => {
    const problems = testDatabaseProblems(env);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(fragment);
  });

  it('assertTestDatabase ném lỗi có hướng dẫn và không làm lộ mật khẩu', () => {
    let message = '';
    try {
      assertTestDatabase({ DATABASE_URL: DEV_APP });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^Từ chối chạy E2E ngoài DB test/);
    expect(message).toContain('npm run test:e2e:db');
    expect(message).not.toContain('dev_secret_pw');
  });

  it('assertTestDatabase không ném lỗi khi trỏ đúng DB test', () => {
    expect(() => assertTestDatabase({ DATABASE_URL: TEST_APP })).not.toThrow();
  });
});
