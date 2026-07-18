import { Module } from '@nestjs/common';
import { TenantQuotaService } from './tenant-quota.service';

@Module({
  providers: [TenantQuotaService],
  exports: [TenantQuotaService],
})
export class TenantQuotaModule {}
