import { resolveSortField } from './pagination';

describe('resolveSortField', () => {
  const allowedFields = ['createdAt', 'updatedAt'] as const;

  it('keeps supported sort fields', () => {
    expect(resolveSortField('updatedAt', allowedFields, 'createdAt')).toBe('updatedAt');
  });

  it('falls back when sortBy is not allowlisted', () => {
    expect(resolveSortField('drop table users', allowedFields, 'createdAt')).toBe('createdAt');
  });

  it('falls back when sortBy is blank', () => {
    expect(resolveSortField('   ', allowedFields, 'createdAt')).toBe('createdAt');
  });
});
