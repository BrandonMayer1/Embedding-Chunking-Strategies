import { Injectable } from '@nestjs/common';
import { ChunkingService } from './Embedding/chunking.service';


@Injectable()
export class FileUploadService {
  constructor(private readonly chunkingService: ChunkingService) {}

  async handleFileUpload(file: Express.Multer.File){      
    try {
        if (!file || !file.buffer) {
          throw new Error('No file or file buffer received');
        }
        const content = file.buffer.toString('utf-8');
        const documentName = file.originalname;
        const mDocs = await this.chunkingService.headerChunking(content);
        for (const doc of mDocs){
          const vector = await this.chunkingService.toVector(doc.pageContent);
          await this.chunkingService.storeInQdrant(vector,doc.pageContent,documentName);
        }
    } catch (error) {
        throw new Error(`Error reading file: ${error.message}`);
    }
  }
}