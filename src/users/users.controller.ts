import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ResolveUserDto } from './resolve-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('resolve')
  @HttpCode(200)
  async resolve(@Body() body: ResolveUserDto): Promise<{ userID: string }> {
    return { userID: await this.users.resolve(body.id1, body.id2) };
  }
}
