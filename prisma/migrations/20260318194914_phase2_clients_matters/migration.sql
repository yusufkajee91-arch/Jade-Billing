-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('individual_sa', 'company_pty', 'company_ltd', 'close_corporation', 'trust', 'partnership', 'foreign_company', 'other');

-- CreateEnum
CREATE TYPE "FicaStatus" AS ENUM ('not_compliant', 'partially_compliant', 'compliant');

-- CreateEnum
CREATE TYPE "MatterStatus" AS ENUM ('open', 'closed', 'suspended');

-- CreateEnum
CREATE TYPE "NoteSource" AS ENUM ('manual', 'from_fee_entry');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "client_code" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "email_general" TEXT,
    "email_invoices" TEXT,
    "email_statements" TEXT,
    "tel" TEXT,
    "mobile" TEXT,
    "physical_address_line_1" TEXT,
    "physical_address_line_2" TEXT,
    "physical_city" TEXT,
    "physical_province" TEXT,
    "physical_postal_code" TEXT,
    "postal_address_line_1" TEXT,
    "postal_address_line_2" TEXT,
    "postal_city" TEXT,
    "postal_province" TEXT,
    "postal_postal_code" TEXT,
    "vat_number" TEXT,
    "fica_status" "FicaStatus" NOT NULL DEFAULT 'not_compliant',
    "fica_notes" TEXT,
    "fica_last_updated_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fica_documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "mime_type" TEXT,
    "notes" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fica_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matter_code_sequences" (
    "fee_earner_initials" TEXT NOT NULL,
    "client_code" TEXT NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "matter_code_sequences_pkey" PRIMARY KEY ("fee_earner_initials","client_code")
);

-- CreateTable
CREATE TABLE "matters" (
    "id" TEXT NOT NULL,
    "matter_code" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "matter_type_id" TEXT,
    "department_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "status" "MatterStatus" NOT NULL DEFAULT 'open',
    "date_opened" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_closed" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matter_users" (
    "matter_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "granted_by" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matter_users_pkey" PRIMARY KEY ("matter_id","user_id")
);

-- CreateTable
CREATE TABLE "matter_associations" (
    "matter_id" TEXT NOT NULL,
    "associated_matter_id" TEXT NOT NULL,
    "relationship_note" TEXT,

    CONSTRAINT "matter_associations_pkey" PRIMARY KEY ("matter_id","associated_matter_id")
);

-- CreateTable
CREATE TABLE "matter_attachments" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "mime_type" TEXT,
    "description" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matter_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matter_notes" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" "NoteSource" NOT NULL DEFAULT 'manual',
    "fee_entry_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matter_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL,
    "matter_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entry_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL,
    "assigned_to" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_client_code_key" ON "clients"("client_code");

-- CreateIndex
CREATE UNIQUE INDEX "matters_matter_code_key" ON "matters"("matter_code");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fica_documents" ADD CONSTRAINT "fica_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fica_documents" ADD CONSTRAINT "fica_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_matter_type_id_fkey" FOREIGN KEY ("matter_type_id") REFERENCES "matter_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matters" ADD CONSTRAINT "matters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_users" ADD CONSTRAINT "matter_users_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_users" ADD CONSTRAINT "matter_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_users" ADD CONSTRAINT "matter_users_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_associations" ADD CONSTRAINT "matter_associations_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_associations" ADD CONSTRAINT "matter_associations_associated_matter_id_fkey" FOREIGN KEY ("associated_matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_attachments" ADD CONSTRAINT "matter_attachments_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_attachments" ADD CONSTRAINT "matter_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_notes" ADD CONSTRAINT "matter_notes_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matter_notes" ADD CONSTRAINT "matter_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
