// Utility to send a notification to a user (host or admin)
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Send a notification to a user
 * @param {Object} param0
 * @param {string} param0.userId - The user ID to notify
 * @param {string} param0.type - Notification type (e.g. 'service_fee_pending', 'service_fee_approved', 'service_fee_rejected')
 * @param {string} param0.title - Notification title
 * @param {string} param0.body - Notification body/message
 * @param {Object} [param0.meta] - Any extra metadata
 */
export async function sendNotification({ userId, type, title, body, meta = {} }) {
  await addDoc(collection(db, "notifications"), {
    userId,
    type,
    title,
    body,
    meta,
    read: false,
    timestamp: serverTimestamp(),
  });
}
