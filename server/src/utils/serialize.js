export function safeUser(user) {
  if (!user) return null;
  const record = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    id: String(record._id ?? record.id),
    name: record.name,
    email: record.email,
    role: record.role,
    isActive: record.isActive,
    createdAt: record.createdAt,
  };
}
