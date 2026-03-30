-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('not_yet_billed', 'awaiting_payment', 'paid');

-- AlterTable
ALTER TABLE "matters" ADD COLUMN     "allocation" TEXT,
ADD COLUMN     "billing_status" "BillingStatus" NOT NULL DEFAULT 'not_yet_billed',
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "loe_fica_done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matter_status_note" TEXT,
ADD COLUMN     "to_do" JSONB;
