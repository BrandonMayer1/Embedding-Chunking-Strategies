import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpModule } from '@nestjs/axios';
import { FileUploadService } from './file-upload.service';
import { ConfigModule } from '@nestjs/config';
import { GitModule } from './GithubController/git.module';
import { EmbeddingModule } from './Embedding/embedding.module';

@Module({
  imports: [HttpModule, ConfigModule.forRoot(), GitModule, EmbeddingModule],
  controllers: [AppController],
  providers: [AppService, FileUploadService],
})
export class AppModule {}
