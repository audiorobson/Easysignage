-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "alert_webhook_url" TEXT,
ADD COLUMN     "alert_webhook_secret" TEXT,
ADD COLUMN     "alert_notify_emails" TEXT;
