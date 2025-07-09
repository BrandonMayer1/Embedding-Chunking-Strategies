import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpModule } from '@nestjs/axios';
import { FileUploadService } from './file-upload.service';
import { ChunkingService } from './Embedding/chunking.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './Embedding/supabase.service';

@Module({
  imports: [HttpModule, ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [AppService, FileUploadService, ChunkingService, SupabaseService],
})
export class AppModule {}
