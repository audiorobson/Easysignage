import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LayoutTemplatesController } from './layout-templates.controller';
import { LayoutTemplatesService } from './layout-templates.service';

@Module({
  imports: [AuthModule],
  controllers: [LayoutTemplatesController],
  providers: [LayoutTemplatesService],
  exports: [LayoutTemplatesService],
})
export class LayoutTemplatesModule {}
