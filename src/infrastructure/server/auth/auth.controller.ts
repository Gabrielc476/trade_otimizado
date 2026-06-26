import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body('email') email?: string,
    @Body('id') id?: number,
    @Body('name') name?: string,
    @Body('password') password?: string,
  ) {
    const emailOrId = email || id;
    if (!emailOrId) {
      throw new BadRequestException('Email or ID is required');
    }
    return this.authService.register(emailOrId, name || 'User', password || '');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('email') email?: string,
    @Body('id') id?: number,
    @Body('password') password?: string,
  ) {
    const emailOrId = email || id;
    if (!emailOrId) {
      throw new BadRequestException('Email or ID is required');
    }
    return this.authService.login(emailOrId, password || '');
  }
}
