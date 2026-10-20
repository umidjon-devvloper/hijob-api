-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('buyer', 'seller', 'admin', 'moderator');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('uz', 'ru', 'en');

-- CreateEnum
CREATE TYPE "ClothingSize" AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL');

-- CreateEnum
CREATE TYPE "FaceTemplateStatus" AS ENUM ('processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'pending', 'published', 'archived', 'rejected');

-- CreateEnum
CREATE TYPE "CategoryId" AS ENUM ('scarves', 'dresses', 'bags', 'accessories');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('delivery', 'pickup', 'proba');

-- CreateEnum
CREATE TYPE "DeliverySpeed" AS ENUM ('today', 'tomorrow', 'scheduled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('click', 'payme', 'visa', 'mastercard', 'humo', 'uzcard');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'proba_scheduled', 'returned', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(120),
    "role" "UserRole" NOT NULL DEFAULT 'buyer',
    "password_hash" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'ru',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "onboarding_face_done" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_body_done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_body_params" (
    "user_id" UUID NOT NULL,
    "height_cm" SMALLINT NOT NULL,
    "weight_kg" SMALLINT NOT NULL,
    "age" SMALLINT NOT NULL,
    "preferred_size" "ClothingSize" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_body_params_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "face_templates" (
    "user_id" UUID NOT NULL,
    "version" VARCHAR(10) NOT NULL DEFAULT '1.0',
    "status" "FaceTemplateStatus" NOT NULL DEFAULT 'processing',
    "landmarks" JSONB,
    "skin_tone" JSONB,
    "proportions" JSONB,
    "s3_head_mask_key" TEXT,
    "s3_neck_mask_key" TEXT,
    "s3_textures_prefix" TEXT,
    "s3_encrypted_photos_prefix" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_templates_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "brand_name" VARCHAR(120) NOT NULL,
    "logo_url" TEXT,
    "description" TEXT,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "reviews_count" INTEGER NOT NULL DEFAULT 0,
    "city" TEXT,
    "address_line" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" "CategoryId" NOT NULL,
    "name_uz" VARCHAR(80) NOT NULL,
    "name_ru" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "icon_url" TEXT,
    "cover_url" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "category_id" "CategoryId" NOT NULL,
    "title_ru" VARCHAR(200) NOT NULL,
    "title_uz" VARCHAR(200),
    "title_en" VARCHAR(200),
    "description_ru" TEXT,
    "description_uz" TEXT,
    "base_price_usd" DECIMAL(10,2) NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "cover_url" TEXT NOT NULL,
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "popularity_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "color" VARCHAR(32) NOT NULL,
    "color_hex" VARCHAR(9) NOT NULL,
    "size" VARCHAR(10) NOT NULL,
    "price_usd" DECIMAL(10,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sku" VARCHAR(64) NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_templates" (
    "variant_id" UUID NOT NULL,
    "canonical_image_key" TEXT NOT NULL,
    "alpha_mask_key" TEXT NOT NULL,
    "side_image_key" TEXT,
    "back_image_key" TEXT,
    "landmarks" JSONB NOT NULL,
    "standard_pose" JSONB NOT NULL,
    "color_palette" JSONB,
    "tying_styles" JSONB,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garment_templates_pkey" PRIMARY KEY ("variant_id")
);

-- CreateTable
CREATE TABLE "tryon_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "tying_style" VARCHAR(32),
    "result_url" TEXT,
    "latency_ms" INTEGER,
    "added_to_cart" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tryon_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("user_id","product_id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" VARCHAR(60),
    "city" VARCHAR(80) NOT NULL,
    "district" VARCHAR(80) NOT NULL,
    "street" VARCHAR(160) NOT NULL,
    "building" VARCHAR(40) NOT NULL,
    "apartment" VARCHAR(40),
    "landmark" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "address_id" UUID,
    "delivery_type" "DeliveryType" NOT NULL,
    "delivery_speed" "DeliverySpeed",
    "scheduled_at" TIMESTAMP(3),
    "address_snapshot" JSONB,
    "comment" TEXT,
    "subtotal_usd" DECIMAL(10,2) NOT NULL,
    "delivery_fee_usd" DECIMAL(10,2) NOT NULL,
    "total_usd" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_tx_id" TEXT,
    "order_status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_snapshot_usd" DECIMAL(10,2) NOT NULL,
    "title_snapshot" VARCHAR(200) NOT NULL,
    "image_snapshot" TEXT NOT NULL,
    "color_snapshot" VARCHAR(32) NOT NULL,
    "size_snapshot" VARCHAR(10) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("order_id","variant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "otp_codes_phone_created_at_idx" ON "otp_codes"("phone", "created_at");

-- CreateIndex
CREATE INDEX "face_templates_expires_at_idx" ON "face_templates"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_user_id_key" ON "sellers"("user_id");

-- CreateIndex
CREATE INDEX "products_category_id_status_published_at_idx" ON "products"("category_id", "status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "products_seller_id_status_idx" ON "products"("seller_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_color_size_key" ON "product_variants"("product_id", "color", "size");

-- CreateIndex
CREATE INDEX "tryon_sessions_user_id_created_at_idx" ON "tryon_sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "cart_items_user_id_idx" ON "cart_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_user_id_variant_id_key" ON "cart_items"("user_id", "variant_id");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_body_params" ADD CONSTRAINT "user_body_params_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_templates" ADD CONSTRAINT "face_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_templates" ADD CONSTRAINT "garment_templates_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryon_sessions" ADD CONSTRAINT "tryon_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryon_sessions" ADD CONSTRAINT "tryon_sessions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
