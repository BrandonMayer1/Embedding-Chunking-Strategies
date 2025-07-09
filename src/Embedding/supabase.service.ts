import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
    private supabase: SupabaseClient;
    private configService: ConfigService;
    
    constructor(configService: ConfigService) {
        this.configService = configService;
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        const supabaseKey = this.configService.get<string>('SUPABASE_KEY');
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase URL or Key is not defined in configuration');
        }
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async uploadFile(bucket: string, file: Express.Multer.File) {
        const newName = file.originalname + Date.now();
        const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(`uploads/${newName}`, file.buffer, {
            contentType: file.mimetype,
        });

        if (error) throw new Error(error.message);
        console.log("UPLOADED: " + file.originalname +" TO SUPABASE.");
        return data;
    }
}