import { Global, Module } from '@nestjs/common';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';

@Global()
@Module({
  controllers: [LicenseController],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenseModule {}
