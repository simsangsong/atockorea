-- Update Jeju tour price: original_price 80000, price 70000
UPDATE tours 
SET 
  price = 70000.00,
  original_price = 80000.00,
  updated_at = NOW()
WHERE slug = 'jeju-southern-top-unesco-spots-bus-tour';

-- Verify the update
SELECT 
  id,
  title,
  slug,
  price,
  original_price,
  CASE 
    WHEN original_price IS NOT NULL AND original_price > price 
    THEN ROUND(((original_price - price) / original_price) * 100)
    ELSE 0
  END as discount_percent
FROM tours
WHERE slug = 'jeju-southern-top-unesco-spots-bus-tour';




