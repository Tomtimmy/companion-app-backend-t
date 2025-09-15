// __tests__/utils.test.js
const { formatUserData } = require('../utils');

describe('User Data Formatting', () => {
  test('should format user data correctly', () => {
    const mockUser = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'JOHN.DOE@EXAMPLE.COM',
      status: 'active',
      joinedDate: '2023-01-15T10:00:00Z',
    };

    const expectedFormattedUser = {
      displayName: 'John Doe',
      email: 'john.doe@example.com',
      isActive: true,
      createdAt: '2023-01-15T10:00:00.000Z',
    };

    expect(formatUserData(mockUser)).toEqual(expectedFormattedUser);
  });

  test('should return null if user data is null or undefined', () => {
    expect(formatUserData(null)).toBeNull();
    expect(formatUserData(undefined)).toBeNull();
  });

  test('should set isActive to false if status is not active', () => {
    const mockUser = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      status: 'inactive',
      joinedDate: '2023-02-20T12:30:00Z',
    };

    const formattedUser = formatUserData(mockUser);
    expect(formattedUser.isActive).toBe(false);
  });
});
