-- M12: Barcode registration — add 'app_barcode' to meal_source enum.
-- This enables meals created via barcode scan (OpenFoodFacts lookup).
ALTER TYPE meal_source ADD VALUE IF NOT EXISTS 'app_barcode';
