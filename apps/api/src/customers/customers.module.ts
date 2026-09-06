import { Module } from '@nestjs/common';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { ViesService } from './vies.service';

@Module({
  imports: [GoogleDriveModule],
  controllers: [CustomersController],
  providers: [CustomersService, ViesService],
  exports: [CustomersService, ViesService],
})
export class CustomersModule {}
