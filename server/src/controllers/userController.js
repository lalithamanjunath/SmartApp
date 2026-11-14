import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { safeUser } from '../utils/serialize.js';

export async function updateProfile(req, res) {
  const duplicate = await User.exists({ email: req.body.email, _id: { $ne: req.user._id } });
  if (duplicate) throw new ApiError(409, 'An account with that email already exists.');
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { name: req.body.name, email: req.body.email } }, { new: true, runValidators: true }).select('name email role isActive createdAt');
  res.json({ success: true, data: { user: safeUser(user) } });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is incorrect.');
  user.password = req.body.newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated successfully.' });
}
