import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkerAuthController } from './worker-auth.controller';
import { WorkerAuthService } from './worker-auth.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkerAuthController],
  providers: [WorkerAuthService],
})
export class WorkerAuthModule {}
