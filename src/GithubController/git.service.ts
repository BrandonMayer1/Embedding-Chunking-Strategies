import { Injectable } from '@nestjs/common';
import { ChunkingService } from 'src/Embedding/chunking.service';

@Injectable()
export class GithubService {
constructor(private readonly chunkingService: ChunkingService) {}


    async getFileFromGitHub(path: string, branch: string = 'master') {
        const rawUrl = `https://raw.githubusercontent.com/BrandonMayer1/FumaDocs-RAG-Practice/${branch}/${path}`;
        const rawFile = await fetch(rawUrl);
        return await rawFile.text(); 
    }

    async handleGithubFiles(documentContents: string, path: string){
        console.log("Embedding github data")
        const documentName = path;
        const mDocs = await this.chunkingService.headerChunking(documentContents);
        for (const doc of mDocs){
          console.log(`\n--------------CHUNK---------------\n ${doc.pageContent}`);
          const vector = await this.chunkingService.toVector(doc.pageContent);
          await this.chunkingService.storeInQdrant(vector,doc.pageContent,documentName);
        }        
    }
}      