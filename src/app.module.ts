import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpModule } from '@nestjs/axios';
import { FileUploadService } from './file-upload.service';
import { ChunkingService } from './Embedding/chunking.service';

@Module({
  imports: [HttpModule],
  controllers: [AppController],
  providers: [AppService, FileUploadService, ChunkingService],
})
export class AppModule {}
