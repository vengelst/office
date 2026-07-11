import { Module } from '@nestjs/common';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [GoogleDriveModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
