-- CreateEnum
CREATE TYPE "StyleJobStatus" AS ENUM ('pending', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "product_style_jobs" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "StyleJobStatus" NOT NULL DEFAULT 'pending',
    "mannequin_url" TEXT NOT NULL,
    "hijab_url" TEXT NOT NULL,
    "tying_style" VARCHAR(20) NOT NULL DEFAULT 'classical',
    "color_hex" VARCHAR(9) NOT NULL DEFAULT '#8A8D5B',
    "result_url" TEXT,
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "product_style_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_style_jobs_status_created_at_idx" ON "product_style_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "product_style_jobs_product_id_idx" ON "product_style_jobs"("product_id");

-- AddForeignKey
ALTER TABLE "product_style_jobs" ADD CONSTRAINT "product_style_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_style_jobs" ADD CONSTRAINT "product_style_jobs_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
