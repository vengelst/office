import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { ProjectsModule } from './projects/projects.module';
import { WorkersModule } from './workers/workers.module';
import { SubcontractorsModule } from './subcontractors/subcontractors.module';
import { TeamsModule } from './teams/teams.module';
import { DocumentsModule } from './documents/documents.module';
import { GeocodeModule } from './geocode/geocode.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ProjectsModule,
    WorkersModule,
    SubcontractorsModule,
    TeamsModule,
    DocumentsModule,
    GeocodeModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    // Globaler JWT-Guard (Routes mit @Public() ausgenommen)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Globaler Audit-Log-Interceptor für verändernde Requests
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
