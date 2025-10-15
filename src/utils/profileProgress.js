// src/utils/profileProgress.js
function isFilled(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function computeProfileProgress({ user, profile, counts }) {
  const slots = [];

  // Personal (User + Profile, no duplicates)
  slots.push(isFilled(user?.name));          // User
  slots.push(isFilled(user?.email));         // User
  slots.push(isFilled(user?.phone));         // User
  slots.push(isFilled(profile?.birthDate));  // Profile
  slots.push(isFilled(user?.country));       // User
  slots.push(isFilled(user?.city));          // User
  slots.push(isFilled(profile?.professionalTitle)); // Profile
  slots.push(isFilled(profile?.about));      // Profile

  // Professional
  slots.push((counts.categories || 0) > 0);         // at least 1 category
  slots.push((counts.subcategories || 0) >= 2);     // at least 2 subcategories
  slots.push(isFilled(profile?.experienceLevel));
  slots.push((profile?.skills || []).length >= 1);

  // Languages
  slots.push((profile?.languages || []).length >= 1);

  // Interests (Goals)
  slots.push((counts.goals || 0) >= 1);

  // Industries
  slots.push((counts.industryCategories || 0) > 0); // at least 1 industry category

  const filled = slots.filter(Boolean).length;
  const percent = Math.round((filled / slots.length) * 100);
  return { percent, filled, total: slots.length };
}

module.exports = { computeProfileProgress };
