import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [TypeOrmModule.forRootAsync({ useFactory: () => databaseConfig() })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
