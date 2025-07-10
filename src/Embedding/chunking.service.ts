import { Injectable } from '@nestjs/common';
import { OllamaEmbeddings } from "@langchain/ollama";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { ChromaClient } from "chromadb";



@Injectable()
export class ChunkingService {
    private embeddings: OllamaEmbeddings; 
    private client: ChromaClient;

    constructor() {
        this.client = new ChromaClient();
        this.embeddings = new OllamaEmbeddings({
        model: "mxbai-embed-large", 
        baseUrl: "http://localhost:11434", 
        });
    }
//---------------------------------------MARDOWN METHOD------------------------------------------------
//SPLITS BASED ON MARKDOWN HEADERS BEST FOR RETRIVAL OF REFERENCES
    async headerChunking(text: string): Promise<Document[]>{
        const Seperators = [
            "\n# ", "\n## ", //Major section breaks 
            "```\n", //Code blocks
            "\n- ", "\n* ", "\n1. ", "\n| ", //Lists/tables
            "\n### ", "\n#### ", // Subsections
            "\n<", "\n</", // HTML components
            "\n---\n", "\n***\n", //Horizontal rules
            "\n\n", "\n", " " // Soft breaks
        ];

        const len = text.length;
        let chunkSize = 500;
        if (len > 2500){
            chunkSize = 450 + Math.floor((len - 2500) / 2500) * 200;
        }
        if (chunkSize > 2000){
            chunkSize = 2000;
        }


        //Based on Markdown Document Seperators
        const headerSplitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
            chunkSize: chunkSize, 
            chunkOverlap: 50,
            keepSeparator: true,
            separators: Seperators,
        
        });//Potentially Change these parameters
        return await headerSplitter.createDocuments([text]);
    }


    async toVector(message: string): Promise<number[]> {
        return this.embeddings.embedQuery(message);
    }

    async storeInQdrant(embedding: number[], text: string, documentName: string) {
        try{
            const collection = await this.client.getOrCreateCollection({name: 'markdown-store'});
            await collection.upsert({
                ids: [Date.now().toString()],
                embeddings: [embedding],
                metadatas: [{name: documentName }],
                documents: [text]
            });
            console.log("|--STORED IN CHROMADB--|");
        }
        catch (error){
            console.log(error);
        }
    }

 //--------------------------RETRIVAL-----------------------------------------
    async queryWithMessage(message: string) {
        const collection = await this.client.getOrCreateCollection({name: 'markdown-store'});
        console.log("|--QUERYING WITH MESSAGE:--|");
        console.log(message);
        console.log("|--------------------------|");

        const vectorQuery = await this.toVector(message);

        // Find best document
        const bestDocName = await this.findTopDocument(vectorQuery);
        console.log("|--BEST DOCUMENT: " + bestDocName + "--|");
        
        if (!bestDocName) {
            console.log("No relevant documents");
        }
        else{
            // Get the best chunks from document
            const results = await collection.query({
                queryEmbeddings: [vectorQuery],
                nResults: 5,
                where: {name: bestDocName},
                include: ["documents"]
            });
            console.log(results);
            return results.documents?.flat().join('\n\n') || "";
        }
        return "";
    }
    
    // Finds the best document 
    async findTopDocument(query: number[]) {
        const collection = await this.client.getOrCreateCollection({name: 'markdown-store'});
        const results = await collection.query({
            queryEmbeddings: [query],
            nResults: 3,
        });
        if (!results.metadatas?.length) return undefined;
        return results.metadatas[0][0]?.name;
    }
}
