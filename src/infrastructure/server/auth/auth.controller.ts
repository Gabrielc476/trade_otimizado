import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body('name') name: string,
    @Body('password') password: string,
  ) {
    return this.authService.register(name, password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body('id') id: number,
    @Body('password') password: string,
  ) {
    return this.authService.login(id, password);
  }
}
