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

    const payload = {
      model: "deepseek-v2:latest",
      messages: [...this.chatHistory, 
      {role: 'System',
        content: `You are an AI assistant engaging in a conversation with a user. Your task is to respond to the user's message appropriately, using the provided context if relevant.

        You have been provided with some additional context in the form of RAG (Retrieval-Augmented Generation) documents. This information may or may not be relevant to the user's message. Here is the context:
        <context>
        ${context}
        </context>

        The user's most recent message is:
        <user_message>
        ${message}
        </user_message>

        Please respond to the user's message, keeping the following guidelines in mind:
        1. If the provided context is relevant to the user's message, use it to inform your response. However, do not explicitly mention or refer to the RAG documents or the fact that you're using additional context.
        2. If the context is not relevant to the user's message, simply respond based on your general knowledge and the conversation history.
        3. Maintain a helpful and friendly tone throughout your response.
        4. Ensure your response is coherent with the previous conversation history.
        5. If the user asks about something that isn't covered in the context or your general knowledge, it's okay to say you're not sure or don't have that information.

        Format your response as follows:
        <response>
        [Your response to the user's message goes here]
        </response>

        Remember, your goal is to provide a natural, helpful response to the user without drawing attention to the behind-the-scenes context retrieval process.`
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
          You are tasked with extracting the most searchable keywords and phrases from a given message. This task is critical for optimizing vector database queries. Your output will be used directly in these queries, so precision and relevance are paramount.

          Your task is to extract only the most relevant keywords and phrases from this message that would work best in a vector database query. Follow these rules strictly:

          1. Return ONLY optimized query terms - no full sentences, no explanations, no filler text.
          2. Focus on:
            - Technical terms
            - Proper nouns
            - Numbers/measurements
            - Domain-specific jargon
            - Action verbs
          3. DO NOT include:
            - Explanations
            - Your own thoughts
            - Reworded versions of the task
            - Any output that isn't directly usable as a search query

          Examples of good outputs:
          - For "Can you help me find documentation about NestJS authentication?":
            NestJS authentication documentation
          - For "I'm having trouble with Python pandas merge operations on large datasets":
            Python pandas merge operations large datasets
          - For "What's the best way to implement OAuth 2.0 in a Spring Boot application?":
            implement OAuth 2.0 Spring Boot application

          FINAL WARNINGS:
          - DO NOT WRITE ANYTHING EXCEPT THE OPTIMIZED QUERY.
          - If the input message is unclear or vague, return it AS IS - NO commentary, NO substitutions, NO paraphrasing.
          - ONLY return raw query terms. NO CHAT. NO EXTRA TEXT.

          Provide your output as a single line of text with no additional formatting or tags.`
      },
      {
        role: 'user',
        content: "HERE IS THE MESSAGE TO PROCESS: " + message
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
