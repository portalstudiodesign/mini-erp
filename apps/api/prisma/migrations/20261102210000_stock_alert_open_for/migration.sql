-- AlterTable
ALTER TABLE "StockAlert" ADD COLUMN     "openFor" INTEGER;

-- Alertele deja deschise primesc cheia înainte de crearea indexului unic.
UPDATE "StockAlert" SET "openFor" = "productId" WHERE "resolvedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_openFor_key" ON "StockAlert"("openFor");
