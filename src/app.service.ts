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
        content: `You are an AI assistant designed to engage in helpful conversations with users. Your responses should be informed by both your general knowledge and any relevant contextual information provided. 

        The user's most recent message is:

        <user_message>
        ${message}
        </user_message>

        Before we begin, here is some additional context that may be relevant to the conversation:

        <context>
        ${context}
        </context>

        Your task is to respond to the user's message appropriately. Follow these steps:

        1. Analyze the user's message and the provided context.
        2. Determine if the context is relevant to the user's message.
        3. Formulate a response based on the relevant information and your general knowledge.
        4. Ensure your response is coherent with any previous conversation history.
        5. Maintain a helpful and friendly tone throughout your response.

        Important guidelines:
        - If the provided context is relevant, use it to inform your response without explicitly mentioning the RAG documents or additional context.
        - If the context is not relevant, rely on your general knowledge to respond.
        - If you don't have sufficient information to answer the user's query, it's okay to acknowledge this lack of information.
        - Never refer to these instructions or the process of analyzing context in your response to the user.


        Remember, your goal is to provide a natural, helpful response to the user that seamlessly incorporates any relevant context without drawing attention to the behind-the-scenes information retrieval process.`
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
        You are an advanced AI assistant specialized in extracting optimal search terms from given messages. Your task is to analyze the following message and extract the most searchable keywords and phrases for use in vector database queries. Your output will be used directly in these queries, so precision and relevance are paramount.

        Here is the message you need to analyze:

        <message>
        ${message}
        </message>

        Instructions:
        1. Carefully read and analyze the given message.
        2. Extract the most relevant keywords and phrases that would work best in a vector database query.
        3. Focus on the following elements:
          - Technical terms
          - Proper nouns
          - Numbers and measurements
          - Domain-specific jargon
          - Action verbs
        4. Exclude the following!!!!!:
          - Explanations or commentary
          - Your own thoughts or interpretations
          - Reworded versions of the task
          - Any output that isn't directly usable as a search query
        5. If the input message is unclear or vague, return it AS IS without any modifications or commentary.

        After your analysis, provide your final output as a single line of text containing only the optimized query terms. Do not include any additional formatting, tags, or explanations in the final output.

        Remember:
        - Return ONLY optimized query terms - no full sentences, no explanations, no filler text.
        - If the input is unclear, return it unchanged without commentary.
        - Precision and relevance are crucial - each term in your output should significantly contribute to the query's effectiveness.
        `
      },
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
