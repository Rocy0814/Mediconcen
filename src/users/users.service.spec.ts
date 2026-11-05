import { QueryFailedError, Repository } from 'typeorm';
import { UserCacheService } from './user-cache.service';
import { UserMapping } from './user-mapping.entity';
import { UsersService } from './users.service';

const duplicate = new QueryFailedError(
  'INSERT',
  [],
  Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' }),
);

describe('UsersService', () => {
  const mappings = { findOneBy: jest.fn(), insert: jest.fn() };
  const cache = { get: jest.fn(), set: jest.fn() };
  const service = new UsersService(
    mappings as unknown as Repository<UserMapping>,
    cache as unknown as UserCacheService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('returns a cache hit without querying MySQL', async () => {
    cache.get.mockResolvedValue('cached-id');
    await expect(service.resolve('A', 'B')).resolves.toBe('cached-id');
    expect(mappings.findOneBy).not.toHaveBeenCalled();
    expect(mappings.insert).not.toHaveBeenCalled();
  });

  it('returns the existing ID without inserting', async () => {
    mappings.findOneBy.mockResolvedValue({ userID: 'existing-id' });
    await expect(service.resolve('A', 'B')).resolves.toBe('existing-id');
    expect(mappings.insert).not.toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith('A', 'B', 'existing-id');
  });

  it('inserts a UUID v4 for a new pair', async () => {
    mappings.findOneBy.mockResolvedValue(null);
    const userID = await service.resolve('A', 'B');
    expect(userID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(mappings.insert).toHaveBeenCalledWith({
      id1: 'A',
      id2: 'B',
      userID,
    });
  });

  it('returns the winning ID after a concurrent insert', async () => {
    mappings.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userID: 'winner-id' });
    mappings.insert.mockRejectedValue(duplicate);
    await expect(service.resolve('A', 'B')).resolves.toBe('winner-id');
  });

  it('does not hide a duplicate error if the pair is absent', async () => {
    mappings.findOneBy.mockResolvedValue(null);
    mappings.insert.mockRejectedValue(duplicate);
    await expect(service.resolve('A', 'B')).rejects.toBe(duplicate);
  });

  it('propagates unexpected insert failures', async () => {
    const error = new Error('database unavailable');
    mappings.findOneBy.mockResolvedValue(null);
    mappings.insert.mockRejectedValue(error);
    await expect(service.resolve('A', 'B')).rejects.toBe(error);
    expect(mappings.findOneBy).toHaveBeenCalledTimes(1);
    expect(cache.set).not.toHaveBeenCalled();
  });
});
