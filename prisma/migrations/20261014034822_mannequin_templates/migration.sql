-- CreateTable
CREATE TABLE "mannequin_templates" (
    "id" UUID NOT NULL,
    "size_key" VARCHAR(16) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "min_height_cm" INTEGER NOT NULL,
    "max_height_cm" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mannequin_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mannequin_templates_size_key_key" ON "mannequin_templates"("size_key");

-- CreateIndex
CREATE INDEX "mannequin_templates_active_min_height_cm_idx" ON "mannequin_templates"("active", "min_height_cm");
