import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChunkingService } from './chunking.service';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [ConfigModule],
  providers: [ChunkingService, SupabaseService],
  exports: [ChunkingService, SupabaseService],
})
export class EmbeddingModule {} 