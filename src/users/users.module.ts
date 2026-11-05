import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserMapping } from './user-mapping.entity';
import { UsersController } from './users.controller';
import { UserCacheService } from './user-cache.service';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserMapping])],
  controllers: [UsersController],
  providers: [UsersService, UserCacheService],
})
export class UsersModule {}
