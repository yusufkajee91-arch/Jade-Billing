-- AlterTable
ALTER TABLE "gl_accounts" ALTER COLUMN "is_system" SET DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "monthly_target_cents" INTEGER;
