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
        let chunkSize = 250;
        if (len > 2500){
            chunkSize = 250 + Math.floor((len - 2500) / 2500) * 200;
        }
        if (chunkSize > 1000){
            chunkSize = 1000;
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
                ids: [documentName],
                embeddings: [embedding],
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
        const bestDocIds = await this.findTopDocument(vectorQuery);
        console.log("|--BEST DOCUMENT: " + bestDocIds + "--|");
        
        if (!bestDocIds || !bestDocIds[0]) {
            console.log("No relevant documents");
            return "";
        }
        // Get the best chunks from document
        const results = await collection.query({
            queryEmbeddings: [vectorQuery],
            ids: bestDocIds,
            nResults: 5,
            include: ["documents"]
        });

        const ids = results.ids?.[0] || [];
        const docs = results.documents?.[0] || [];
        
        let output = "";
        for (let i = 0; i < ids.length; i++) {
            output += `DOCUMENT NAME: ${ids[i]}\nDOCUMENT CONTENT: \n ${docs[i]}>\n----------------------------------------\n`;
        }
        console.log("|------------RAG DOCUMENTS -------------|")
        console.log(output);
        console.log("|------------RAG DOCUMENTS -------------|")
        return output;
    }
    


    // Finds the best document from 10 chunks
    // Weighs them based on Average Similarity
    // Returns the best one or multiple if there are more than 1 with a close .1 similarity

    async findTopDocument(query: number[]) {
        const collection = await this.client.getOrCreateCollection({ name: 'markdown-store' });
        const results = await collection.query({
            queryEmbeddings: [query],
            nResults: 10,
        });
        
        const ids = results.ids?.[0];
        const distances = results.distances?.[0];
    
        if (!ids || !distances) {
            return [];
        }
    
        const docDistanceSum: Record<string, number> = {};
        const docCount: Record<string, number> = {};
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const distance = distances[i];
            if (id != null && distance != null) {
                docDistanceSum[id] = (docDistanceSum[id] || 0) + distance;
                docCount[id] = (docCount[id] || 0) + 1;
            }
        }
    
        let topDoc: string | undefined = undefined;
        let lowestAvgDistance = 10000000;
        let lowAverageDocs: string[] = [];
        for (const doc in docDistanceSum) {
            const avgDistance = docDistanceSum[doc] / docCount[doc];
            if (avgDistance < lowestAvgDistance) {
                lowestAvgDistance = avgDistance;
                topDoc = doc;
            }
        }
        //LOOKS FOR DOCS THAT HAVE A CLOSE AVERGAE TO THE CLOSEST ONE AND ADDS IT
        for (const doc in docDistanceSum) {
            const avgDistance = docDistanceSum[doc] / docCount[doc];
            if (Math.abs(avgDistance - lowestAvgDistance) <= .1) {
                lowAverageDocs.push(doc);
                console.log(`Added to nearTopDocs: ${doc}`);
            }
        }

        
        if (lowAverageDocs.length > 1) {
            console.log('Returning lowAverageDocs:', lowAverageDocs);
            return lowAverageDocs;
        }
        console.log('Returning topDoc:', topDoc);
        return [topDoc!];
    }
    
    
}

