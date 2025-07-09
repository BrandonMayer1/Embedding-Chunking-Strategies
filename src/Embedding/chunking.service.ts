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
            console.log("|--STORED IN QUADRANT--|");
        }
        catch (error){
            console.log(error);
        }
    }

 //--------------------------RETRIVAL-----------------------------------------
    async queryWithMessage(message: string) {
        console.log("|--QUERYING WITH MESSAGE:--|");
        console.log(message);
        console.log("|--------------------------|");

        
        // Find best document
        const bestDocName = await this.findTopDocument(message);
        console.log("|--BEST DOCUMENT: " + bestDocName + "--|");
        
        if (!bestDocName) {
            console.log("No relevant documents");
        }
        else{
            // Get the best chunks from document
            const results = await this.qdrant.search('markdown-store', {
                vector: await this.toVector(message),
                filter: {
                    must: [{ key: 'metadata', match: { value: bestDocName } }]
                },
                limit: 5,
                with_payload: true
            });
        
            return results.map(hit => hit.payload?.content).filter(Boolean).join('\n\n');
        }
        return "";
    }
    
    // Finds the best document 
    async findTopDocument(query: string) {
        const vectorQuery = await this.toVector(query);
        const results = await this.qdrant.search('markdown-store', {
            vector: vectorQuery,
            limit: 5,
            with_payload: ['metadata']
        });
        if (!results?.length) return undefined;
        return results.sort((a, b) => b.score - a.score)[0]?.payload?.metadata;
    }
}
