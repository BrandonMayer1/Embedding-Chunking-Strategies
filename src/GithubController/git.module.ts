import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GitHubController } from './git.controller';
import { GithubService } from './git.service';
import { EmbeddingModule } from '../Embedding/embedding.module';

@Module({
  imports: [EmbeddingModule],
  controllers: [GitHubController],
  providers: [GithubService],
})
export class GitModule {}
