-- DropForeignKey
ALTER TABLE "public"."PointLog" DROP CONSTRAINT "PointLog_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Test" DROP CONSTRAINT "Test_teacherId_fkey";

-- AlterTable
ALTER TABLE "public"."PointLog" ALTER COLUMN "teacherId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Test" ALTER COLUMN "teacherId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Test" ADD CONSTRAINT "Test_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PointLog" ADD CONSTRAINT "PointLog_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
