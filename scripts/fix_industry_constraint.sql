-- Fix the incorrect foreign key constraint for user_industry_categories
-- The constraint should reference industry_categories, not industry_subcategories

-- First, drop the incorrect constraint (if it exists)
ALTER TABLE user_industry_categories DROP FOREIGN KEY user_industry_categories_ibfk_12;

-- Then, add the correct constraint
ALTER TABLE user_industry_categories
ADD CONSTRAINT user_industry_categories_ibfk_12
FOREIGN KEY (industryCategoryId) REFERENCES industry_categories(id)
ON DELETE CASCADE ON UPDATE CASCADE;