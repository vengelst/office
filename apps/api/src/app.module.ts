import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { DocumentFoldersModule } from './document-folders/document-folders.module';
import { GeocodeModule } from './geocode/geocode.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WorkerAuthModule } from './worker-auth/worker-auth.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { BreakRulesModule } from './break-rules/break-rules.module';
import { InvoicesModule } from './invoices/invoices.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { EmailModule } from './email/email.module';
import { GoogleDriveModule } from './google-drive/google-drive.module';
import { OcrModule } from './ocr/ocr.module';
import { ResearchModule } from './research/research.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ProjectsModule,
    WorkersModule,
    SubcontractorsModule,
    TeamsModule,
    DocumentsModule,
    DocumentFoldersModule,
    GeocodeModule,
    DashboardModule,
    WorkerAuthModule,
    TimeEntriesModule,
    TimesheetsModule,
    BreakRulesModule,
    InvoicesModule,
    VehiclesModule,
    AppSettingsModule,
    EmailModule,
    GoogleDriveModule,
    OcrModule,
    ResearchModule,
    SubmissionsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
