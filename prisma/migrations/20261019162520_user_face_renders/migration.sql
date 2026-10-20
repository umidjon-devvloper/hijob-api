-- Face swap now runs ONCE at onboarding and pre-renders a face-swapped
-- mannequin per variant. These tables carry the queue + results so the
-- Primerka tab reads a cached URL instead of hitting /tryon/faceswap on
-- every product selection.

-- CreateEnum
CREATE TYPE "UserFaceRenderStatus" AS ENUM ('pending', 'running', 'done', 'failed');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "selfie_key" TEXT,
  ADD COLUMN "tryon_body_type" VARCHAR(10),
  ADD COLUMN "tryon_height_cm" SMALLINT;

-- CreateTable
CREATE TABLE "user_face_renders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_face_renders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_face_renders_user_id_idx" ON "user_face_renders"("user_id");
CREATE UNIQUE INDEX "user_face_renders_user_id_variant_id_key" ON "user_face_renders"("user_id", "variant_id");

-- CreateTable
CREATE TABLE "user_face_render_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "status" "UserFaceRenderStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "user_face_render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_face_render_jobs_status_created_at_idx" ON "user_face_render_jobs"("status", "created_at");
CREATE UNIQUE INDEX "user_face_render_jobs_user_id_variant_id_key" ON "user_face_render_jobs"("user_id", "variant_id");

-- AddForeignKey
ALTER TABLE "user_face_renders"
  ADD CONSTRAINT "user_face_renders_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_face_renders"
  ADD CONSTRAINT "user_face_renders_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_face_render_jobs"
  ADD CONSTRAINT "user_face_render_jobs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_face_render_jobs"
  ADD CONSTRAINT "user_face_render_jobs_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
