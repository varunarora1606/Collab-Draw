/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Room` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Room" DROP COLUMN "updatedAt",
ADD COLUMN     "lastEdited" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
