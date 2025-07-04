import { Injectable } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OllamaEmbeddings } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';


@Injectable()
export class ChunkingService {
    private qdrant: QdrantClient;
    private embeddings: OllamaEmbeddings; 


    constructor() {
        this.qdrant = new QdrantClient({ url: 'http://localhost:6333' });
        this.embeddings = new OllamaEmbeddings({
        model: "mxbai-embed-large", 
        baseUrl: "http://localhost:11434", 
        });
    }
//---------------------------------------MARDOWN METHOD------------------------------------------------
//SPLITS BASED ON MARKDOWN HEADERS BEST FOR RETRIVAL OF REFERENCES
    async headerChunking(text: string): Promise<Document[]>{
        //Based on Markdown Document Seperators
        const headerSplitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {chunkSize: 300, chunkOverlap: 0,});//Potentially Change these parameters
        return await headerSplitter.createDocuments([text]);
    }


    async toVector(message: string): Promise<number[]> {
        return this.embeddings.embedQuery(message);
    }

    async storeInQdrant(embedding: number[], text: string, documentName: string) {
        try{
            const collections = await this.qdrant.getCollections();
            const exists = collections.collections.some(c => c.name === 'markdown-store');
            if (!exists){
                await this.qdrant.createCollection('markdown-store', {
                    vectors: {
                    size: 1024, 
                    distance: 'Cosine',
                    },
                });    
            }
            await this.qdrant.upsert('markdown-store', {
                points: [{
                    id: Date.now(), 
                    vector: embedding,
                    payload: { 
                        content: text,
                        metadata: documentName, 
                    },
                    },
                ],
            });
            console.log("STORED IN QUADRANT");
        }
        catch (error){
            console.log(error);
        }
    }

    //Method that turns the message into a vector then querys vector db
    async queryWithMessage(message: string){
        console.log("QUERYING WITH MESSAGE:", message);
        //message -> vector
        const vectorMessage = await this.toVector(message);
        //query VectorDB
        const result = await this.qdrant.search('markdown-store', {
            vector: vectorMessage,
            limit: 5, 
            with_payload: true,
        });
        return result.map(hit => hit.payload?.text).filter(Boolean).join('\n\n');
    }
}
