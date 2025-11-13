import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Tier thresholds (cumulative points)
export const TIERS = [
  { id: 'bronze', name: 'Bronze', min: 0, multiplier: 1, color: '#CD7F32' },
  { id: 'silver', name: 'Silver', min: 500, multiplier: 1.05, color: '#C0C0C0' },
  { id: 'gold', name: 'Gold', min: 1500, multiplier: 1.1, color: '#D4AF37' },
  { id: 'platinum', name: 'Platinum', min: 4000, multiplier: 1.15, color: '#E5E4E2' },
];

export function getTierByPoints(total) {
  let current = TIERS[0];
  for (const t of TIERS) {
    if (total >= t.min) current = t;
  }
  return current;
}

export function getNextTier(total) {
  const current = getTierByPoints(total);
  const idx = TIERS.findIndex(t => t.id === current.id);
  return TIERS[idx + 1] || null;
}

export async function getUserPoints(userId) {
  const ref = doc(db, 'userPoints', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const init = { total: 0, userId, updatedAt: serverTimestamp(), tier: 'bronze' };
    await setDoc(ref, init);
    return init;
  }
  return snap.data();
}

export async function addPoints(userId, amount, source, meta = {}) {
  if (amount === 0) return;
  const ref = doc(db, 'userPoints', userId);
  const data = await getUserPoints(userId);
  const newTotal = Math.max(0, data.total + amount); // Ensure total doesn't go below 0
  const tier = getTierByPoints(newTotal).id;
  await updateDoc(ref, { total: newTotal, tier, updatedAt: serverTimestamp() });
  await addDoc(collection(db, 'pointTransactions'), {
    userId,
    amount,
    source, // e.g. 'booking', 'review', 'review_received', 'review_deleted'
    meta,
    totalAfter: newTotal,
    tierAfter: tier,
    createdAt: serverTimestamp(),
  });
  return newTotal;
}

export const REWARD_CATALOG = [
  { id: 'coupon-fixed-5', label: '₱5 Off Coupon', cost: 100, type: 'coupon', discountType: 'fixed', value: 5 },
  { id: 'coupon-fixed-25', label: '₱25 Off Coupon', cost: 350, type: 'coupon', discountType: 'fixed', value: 25 },
  { id: 'coupon-percent-10', label: '10% Off Coupon', cost: 500, type: 'coupon', discountType: 'percentage', value: 10 },
  { id: 'coupon-fixed-50', label: '₱50 Off Coupon', cost: 600, type: 'coupon', discountType: 'fixed', value: 50 },
  { id: 'coupon-percent-15', label: '15% Off Coupon', cost: 800, type: 'coupon', discountType: 'percentage', value: 15 },
  { id: 'priority-support', label: 'Priority Support Badge', cost: 900, type: 'badge' },
];

function generateCouponCode(value) {
  return 'HZ-' + value + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function redeemReward(userId, reward) {
  const state = await getUserPoints(userId);
  if (state.total < reward.cost) {
    throw new Error('Not enough points');
  }
  const newTotal = state.total - reward.cost;
  await updateDoc(doc(db, 'userPoints', userId), { total: newTotal, tier: getTierByPoints(newTotal).id, updatedAt: serverTimestamp() });
  let coupon = null;
  if (reward.type === 'coupon') {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days from now
    
    coupon = {
      code: generateCouponCode(reward.value),
      discountType: reward.discountType || 'fixed',
      discountValue: reward.value,
      hostId: userId,
      userId,
      // single-use by default
      maxUses: 1,
      usedCount: 0,
      expiresAt: expiryDate,
      status: 'active',
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, 'coupons'), coupon);
  }
  await addDoc(collection(db, 'rewardRedemptions'), {
    userId,
    rewardId: reward.id,
    label: reward.label,
    cost: reward.cost,
    newTotal,
    couponCode: coupon?.code || null,
    createdAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'pointTransactions'), {
    userId,
    amount: -reward.cost,
    source: 'redeem',
    meta: { rewardId: reward.id, coupon: coupon?.code || null },
    totalAfter: newTotal,
    tierAfter: getTierByPoints(newTotal).id,
    createdAt: serverTimestamp(),
  });
  return { newTotal, coupon };
}
