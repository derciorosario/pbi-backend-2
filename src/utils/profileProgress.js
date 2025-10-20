// src/utils/profileProgress.js
function isFilled(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function computeProfileProgress_old({ user, profile, counts }) {
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
  slots.push((counts.identities || 0) >= 1);         // at least 1 identity
  slots.push((counts.categories || 0) >= 1);         // at least 1 category
  slots.push((counts.subcategories || 0) >= 1);     // at least 1 subcategories

  slots.push((counts.wantIdentities || 0) >= 1);         // at least 1 identity
  slots.push((counts.wantCategories || 0) >= 1);         // at least 1 category
  slots.push((counts.wantSubcategories || 0) >= 1);     // at least 1 subcategories*/


  slots.push(isFilled(profile?.experienceLevel));
  slots.push((profile?.skills || []).length >= 1);

  // Languages
  slots.push((profile?.languages || []).length >= 1);

  // Industries
  slots.push((counts.industryCategories || 0) >= 1); // at least 1 industry category


  const filled = slots.filter(Boolean).length;
  const percent = Math.round((filled / slots.length) * 100);
    console.log({slots,percent,filled, t:slots.length})

  return { percent, filled, total: slots.length };
}


function computeProfileProgress({ user, profile, counts }) {
  const slots = [];
  
  // Personal Information (User + Profile)
  slots.push(isFilled(user?.name));          // User name
  slots.push(isFilled(user?.email));         // User email
  slots.push(isFilled(user?.phone));         // User phone
  slots.push(isFilled(user?.country));       // User country
  slots.push(isFilled(user?.city));          // User city
  slots.push(isFilled(user?.address));       // User address (from User model)
  slots.push(isFilled(user?.countryOfResidence)); // User country of residence
  
  // Profile-specific personal info
  slots.push(isFilled(profile?.professionalTitle)); // Profile professional title
  slots.push(isFilled(profile?.about));      // Profile about/bio
  
  // Gender (from User model)
  slots.push(isFilled(user?.gender));
  
  // Company-specific fields (if user is a company)
  if (user?.accountType === "company") {
    slots.push(isFilled(profile?.birthDate));  // Profile birth date
   // slots.push(isFilled(user?.webpage));     // Company website
    //slots.push((user?.otherCountries || []).length >= 1); // At least one other country of operation
  }

  // Avatar and Cover Image
  slots.push(isFilled(user?.avatarUrl));     // User avatar
  slots.push(isFilled(user?.coverImage));    // User cover image

  // Professional Information - What I DO (Identities & Categories)
  slots.push((counts.identities || 0) >= 1);         // at least 1 identity
  slots.push((counts.categories || 0) >= 1);         // at least 1 category
  slots.push((counts.subcategories || 0) >= 1);      // at least 1 subcategory
  //slots.push((counts.subsubs || 0) >= 1);            // at least 1 subsubcategory

  // Professional Information - What I'm LOOKING FOR (Interests)
  slots.push((counts.wantIdentities || 0) >= 1);     // at least 1 interest identity
  slots.push((counts.wantCategories || 0) >= 1);     // at least 1 interest category
  slots.push((counts.wantSubcategories || 0) >= 1);  // at least 1 interest subcategory
  //slots.push((counts.wantSubsubs || 0) >= 1);        // at least 1 interest subsubcategory

  // Professional Skills & Experience
  slots.push(isFilled(profile?.experienceLevel));
  slots.push((profile?.skills || []).length >= 1);
  slots.push((profile?.languages || []).length >= 1);

  // Industries
  slots.push((counts.industryCategories || 0) >= 1); // at least 1 industry category
  slots.push((counts.industrySubcategories || 0) >= 1); // at least 1 industry subcategory
  //slots.push((counts.industrySubsubCategories || 0) >= 1); // at least 1 industry subsubcategory

  // Portfolio & Work Samples
  slots.push((profile?.cvBase64 || []).length >= 1); // At least one CV uploaded
  slots.push((counts.workSamples || 0) >= 1);        // At least one work sample

  // Gallery
  slots.push((counts.galleryItems || 0) >= 1);       // At least one gallery item

 
  // Company Staff & Representatives (for companies)
  if (user?.accountType === "company") {
    slots.push((counts.representatives || 0) >= 1);  // At least one representative
    slots.push((counts.staffMembers || 0) >= 1);     // At least one staff member
  }



  // Location Completeness
  //const hasCompleteLocation = isFilled(user?.country) && isFilled(user?.city) && isFilled(user?.address);
  //slots.push(hasCompleteLocation);

  // Profile Description Completeness
  //const hasGoodProfileDescription = isFilled(profile?.about) && (profile?.about || '').length >= 50;
  //slots.push(hasGoodProfileDescription);

  const filled = slots.filter(Boolean).length;
  const percent = Math.round((filled / slots.length) * 100);
  
  console.log({
    slots, 
    percent, 
    filled, 
    total: slots.length,
    breakdown: {
      personal: slots.slice(0, 15).filter(Boolean).length,
      professional: slots.slice(15, 30).filter(Boolean).length,
      portfolio: slots.slice(30).filter(Boolean).length
    }
  });

  return { 
    percent, 
    filled, 
    total: slots.length,
    breakdown: {
      personal: slots.slice(0, 15).filter(Boolean).length,
      professional: slots.slice(15, 30).filter(Boolean).length,
      portfolio: slots.slice(30).filter(Boolean).length
    }
  };
}


module.exports = { computeProfileProgress };
