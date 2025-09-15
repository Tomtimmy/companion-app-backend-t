// utils.js
function formatUserData(user) {
  if (!user) {
    return null;
  }
  return {
    displayName: `${user.firstName} ${user.lastName}`,
    email: user.email.toLowerCase(),
    isActive: user.status === 'active',
    createdAt: new Date(user.joinedDate).toISOString(),
  };
}

module.exports = { formatUserData };
