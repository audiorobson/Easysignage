import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { TotpCodeDto } from './dto/totp-code.dto';
import { TwoFactorLoginDto } from './dto/two-factor-login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.tenantSlug, body.email, body.password);
  }

  @Post('login/2fa')
  completeTwoFactorLogin(@Body() body: TwoFactorLoginDto) {
    return this.auth.completeTwoFactorLogin(body.challengeToken, body.code);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return {
      userId: user.userId,
      email: user.email,
      tenantId: user.tenantId,
      permissions: user.permissions,
    };
  }

  @Get('2fa/status')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  twoFactorStatus(@CurrentUser() user: JwtUser) {
    return this.auth.getTotpStatus(user.userId);
  }

  @Post('2fa/setup')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  setupTwoFactor(@CurrentUser() user: JwtUser) {
    return this.auth.setupTwoFactor(user.userId);
  }

  @Post('2fa/verify')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  confirmTwoFactor(@CurrentUser() user: JwtUser, @Body() body: TotpCodeDto) {
    return this.auth.confirmTwoFactor(user.userId, body.code);
  }

  @Post('2fa/disable')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  disableTwoFactor(@CurrentUser() user: JwtUser, @Body() body: TotpCodeDto) {
    return this.auth.disableTwoFactor(user.userId, body.code);
  }
}
