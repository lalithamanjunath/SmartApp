import {
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService.js';
import { ApiError } from '../utils/ApiError.js';

export async function notifications(req, res) {
  const result = await listNotifications(req.user._id, req.validatedQuery);
  res.json({ success: true, data: result });
}

export async function unreadCount(req, res) {
  const count = await getUnreadNotificationCount(req.user._id);
  res.json({ success: true, data: { count } });
}

export async function markRead(req, res) {
  const notification = await markNotificationRead(req.user._id, req.params.id);
  if (!notification) throw new ApiError(404, 'Notification not found.');
  res.json({ success: true, data: { notification } });
}

export async function markReadAll(req, res) {
  const updated = await markAllNotificationsRead(req.user._id);
  res.json({ success: true, data: { updated } });
}

export async function removeNotification(req, res) {
  const notification = await deleteNotification(req.user._id, req.params.id);
  if (!notification) throw new ApiError(404, 'Notification not found.');
  res.json({ success: true, message: 'Notification deleted.' });
}
