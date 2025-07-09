import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { FileUploadService } from './file-upload.service';
import { ChunkingService } from './Embedding/chunking.service';

@Injectable()


export class AppService {
  constructor(private readonly httpService: HttpService, private readonly fileUploadService: FileUploadService, private readonly chunkingService: ChunkingService) {}
  private chatHistory: Array<{role: string, content: string}> = [];

  async startChat(message: string){
    console.log("|--RECIEVED MESSAGE:--|");
    console.log(message);
    console.log("|---------------------|")

    //GET THE TOPIC
    const optimzedMessage = await this.OptimzedMessage(message);
    console.log("|--OPTIMIZED SEARCH:--|")
    console.log(optimzedMessage);
    console.log("|---------------------|")

    // Get relevant context from vector database
    const context = await this.chunkingService.queryWithMessage(optimzedMessage);
    console.log("|--RETRIEVED CONTEXT:--|");
    console.log(context);
    console.log("|----------------------|");



    const payload = {
      model: "deepseek-v2:latest",
      messages: [...this.chatHistory, 
        {role: 'System',
          content: `You are an AI assistant. Here are some RAG documents, if not related to the user message dont mention: "${context}"`
        },
      {role: 'user',
        content: message,
      }],
      stream: false,
    };
    
    this.chatHistory.push({
      role: 'user',
      content: `${message}`,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post('http://localhost:11434/api/chat', payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      const aiMessage = response.data.message;
      this.chatHistory.push(aiMessage);
      console.log("AI RESPONDED: " + aiMessage.content);
      return aiMessage.content;
    }
    catch (error){
      console.log("ERROR: " + error.message);
      throw error;
    }
  }

  async OptimzedMessage(message: string) : Promise<string> {
    //USE AI TO INFER TOPIC AND GET BUZZWORDS FOR VECTOR DB RETRIVAL
    const topicMessage = [
      ...this.chatHistory,
      {
        role: 'system',
        content: `
        # Vector DB Query Optimization Instructions
      
        ## Task
        Extract the most searchable keywords and phrases from the user's message that would work best in a vector database query.
      
        ## Rules
        - ONLY return the optimized query terms
        - NEVER add explanations or your own text
        - PRESERVE important:
          * Technical terms
          * Proper nouns
          * Numbers/measurements
          * Domain-specific jargon
          * Action verbs
      
        ## Examples
        User: "Can you help me find documentation about NestJS authentication?"
        Output: "NestJS authentication documentation"
      
        User: "I'm having trouble with Python pandas merge operations on large datasets"
        Output: "Python pandas merge operations large datasets"
      
        User: "What's the best way to implement OAuth 2.0 in a Spring Boot application?"
        Output: "implement OAuth 2.0 Spring Boot application"
        `
      },
      {
        role: 'user',
        content: message
      }
    ];
    
    const topicPayload = {
      model: "deepseek-v2:latest",
      messages: topicMessage,
      stream: false,
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post('http://localhost:11434/api/chat', topicPayload, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
      return response.data.message.content;
    }
    catch (error){
      console.log("ERROR: " + error.message);
      throw error;
    }
  }
}
