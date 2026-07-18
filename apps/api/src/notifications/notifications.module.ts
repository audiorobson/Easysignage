import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertNotificationsService } from './alert-notifications.service';
import { EMAIL_SENDER, buildEmailSenderFromEnv } from './email-sender';

@Module({
  imports: [PrismaModule],
  providers: [
    AlertNotificationsService,
    { provide: EMAIL_SENDER, useFactory: () => buildEmailSenderFromEnv() },
  ],
  exports: [AlertNotificationsService],
})
export class NotificationsModule {}
