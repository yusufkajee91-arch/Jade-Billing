-- CreateTable
CREATE TABLE "fee_schedule_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_schedule_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_schedule_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "official_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "professional_fee_cents" INTEGER NOT NULL,
    "vat_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_schedule_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fee_schedule_items" ADD CONSTRAINT "fee_schedule_items_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "fee_schedule_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: South Africa Trade Marks tariff
DO $$
DECLARE cat TEXT := 'fsc-za-trademarks-2024';
BEGIN
  INSERT INTO "fee_schedule_categories" ("id", "name", "jurisdiction", "currency")
  VALUES (cat, 'Trade Marks', 'South Africa', 'ZAR')
  ON CONFLICT ("id") DO NOTHING;

  INSERT INTO "fee_schedule_items" ("id", "category_id", "section", "description", "official_fee_cents", "professional_fee_cents", "sort_order")
  VALUES
    -- SEARCHES
    (gen_random_uuid()::text, cat, 'SEARCHES', 'Availability search for one trade mark', 120, 300000, 10),
    (gen_random_uuid()::text, cat, 'SEARCHES', 'Identical / Exact search', 20, 50000, 20),
    (gen_random_uuid()::text, cat, 'SEARCHES', 'Proprietor search', 20, 30000, 30),

    -- APPLICATIONS
    (gen_random_uuid()::text, cat, 'APPLICATIONS', 'Filing one application in one class', 590, 300000, 40),
    (gen_random_uuid()::text, cat, 'APPLICATIONS', 'Each additional class same trade mark', 590, 270000, 50),
    (gen_random_uuid()::text, cat, 'APPLICATIONS', 'Claiming convention priority', 0, 60000, 60),

    -- PROSECUTION / OFFICIAL ACTION
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Receiving Official Action', 0, 210000, 70),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'First association endorsement', 5, 90000, 80),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Each additional association endorsement', 5, 50000, 90),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'First other endorsement (disclaimer etc)', 0, 90000, 100),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Each additional other endorsement', 0, 50000, 110),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Written opinion on prospects', 0, 58500, 120),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Preparing written submissions (minimum)', 0, 210000, 130),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Attending informal hearing', 0, 102500, 140),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Obtaining grounds of Registrar decision', 363, 112500, 150),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'First extension application', 0, 60000, 160),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Each additional extension simultaneously', 0, 35000, 170),
    (gen_random_uuid()::text, cat, 'PROSECUTION / OFFICIAL ACTION', 'Serving notice of acceptance on proprietor', 0, 87000, 180),

    -- REGISTRATION
    (gen_random_uuid()::text, cat, 'REGISTRATION', 'First certificate', 14, 180000, 190),
    (gen_random_uuid()::text, cat, 'REGISTRATION', 'Each additional certificate simultaneously', 14, 100000, 200),

    -- ASSIGNMENT & SUBSTITUTION
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'First application/registration', 150, 330000, 210),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Each additional up to 10th', 26, 109200, 220),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', '11th and each additional', 26, 27500, 230),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Preparing assignment agreement', 0, 190000, 240),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Late recordal penalty first 12 months', 48, 25000, 250),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Late recordal penalty each additional period', 48, 25000, 260),
    (gen_random_uuid()::text, cat, 'ASSIGNMENT & SUBSTITUTION', 'Preparation of assignment certificate', 0, 15000, 270),

    -- REGISTERED USERS
    (gen_random_uuid()::text, cat, 'REGISTERED USERS', 'First registration', 150, 330000, 280),
    (gen_random_uuid()::text, cat, 'REGISTERED USERS', 'Each additional up to 10th', 26, 109200, 290);
END $$;
