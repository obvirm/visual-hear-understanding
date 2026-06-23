#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import { execSync } from 'child_process';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const server = new Server({ name: 'visual-hear-understanding', version: '1.0.0' }, { capabilities: { tools: {} } });

const hasFfmpeg = (() => {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
})();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{
        name: 'analyze_with_gemini',
        description: 'analyze',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: { type: 'string' },
                media_path: { type: 'string' },
                media_paths: { type: 'array', items: { type: 'string' } },
                model: { type: 'string' },
                start_time: { type: 'string' },
                end_time: { type: 'string' },
                json_output: { type: 'boolean' },
                audio_only: { type: 'boolean' },
                auto_compress: { type: 'boolean' },
                system_instruction: { type: 'string' },
                temperature: { type: 'number' }
            },
            required: ['prompt']
        }
    }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { 
        prompt, media_path, media_paths = [], start_time, end_time, 
        json_output = false, audio_only = false, auto_compress = false, 
        system_instruction, temperature,
        model = process.env.GEMINI_MODEL || 'gemini-2.5-pro' 
    } = request.params.arguments as any;
    
    try {
        let filesToProcess: string[] = [];
        if (media_path) filesToProcess.push(media_path);
        if (Array.isArray(media_paths)) filesToProcess.push(...media_paths);

        let uploadResults: any[] = [];
        let contents: any[] = [];

        const useFfmpeg = hasFfmpeg && (start_time || end_time || audio_only || auto_compress);
        if (!hasFfmpeg && (start_time || end_time || audio_only || auto_compress)) {
            server.notification({ method: "window/showMessage", params: { type: 3, message: "Peringatan: FFmpeg tidak ditemukan. Fitur kompresi, potong, dan audio_only akan diabaikan." } }).catch(() => {});
        }

        for (const p of filesToProcess) {
            if (!fs.existsSync(p)) throw new Error(`File tidak ditemukan: ${p}`);

            const fileSize = fs.statSync(p).size;
            if (fileSize > 2 * 1024 * 1024 * 1024) {
                throw new Error(`Ukuran file melebihi batas 2 GB: ${p}`);
            }

            const rawMimeType = mime.lookup(p) || 'application/octet-stream';
            const mimeType = (useFfmpeg && audio_only) ? 'audio/mpeg' : rawMimeType;
            
            let ext = path.extname(p);
            if (useFfmpeg) {
                if (audio_only) ext = '.mp3';
                else if (auto_compress && rawMimeType.startsWith('image/')) ext = '.jpg';
                else if (auto_compress && rawMimeType.startsWith('video/')) ext = '.mp4';
            }

            const tempPath = path.join(path.dirname(p), `temp_upload_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
            
            if (useFfmpeg) {
                let cmd = `ffmpeg -i "${p}"`;
                if (start_time) cmd += ` -ss ${start_time}`;
                if (end_time) cmd += ` -to ${end_time}`;
                
                if (audio_only) {
                    cmd += ` -vn -c:a libmp3lame -q:a 2`;
                } else if (auto_compress) {
                    if (rawMimeType.startsWith('video/')) {
                        cmd += ` -vf "scale='min(1920,iw)':-2" -c:v libx264 -preset fast -crf 28 -c:a copy`;
                    } else if (rawMimeType.startsWith('image/')) {
                        cmd += ` -vf "scale='min(1920,iw)':-2"`;
                    } else {
                        cmd += ` -c copy`;
                    }
                } else {
                    cmd += ` -c copy`;
                }
                cmd += ` "${tempPath}" -y`;
                execSync(cmd, { stdio: 'ignore' });
            } else {
                fs.copyFileSync(p, tempPath);
            }

            try {
                const uploadResult = await ai.files.upload({ file: tempPath, config: { mimeType } });
                uploadResults.push(uploadResult);
            } finally {
                fs.unlinkSync(tempPath);
            }
        }

        for (const uploadResult of uploadResults) {
            if (uploadResult.mimeType.startsWith('video/')) {
                let fileStatus = await ai.files.get({ name: uploadResult.name! });
                while (fileStatus.state === 'PROCESSING') {
                    await new Promise(r => setTimeout(r, 2000));
                    fileStatus = await ai.files.get({ name: uploadResult.name! });
                }
                if (fileStatus.state === 'FAILED') throw new Error(`Pemrosesan video gagal di Gemini: ${uploadResult.name}`);
            }
            contents.push({ fileData: { fileUri: uploadResult.uri, mimeType: uploadResult.mimeType } });
        }

        contents.push(prompt);

        const configObj: any = {};
        if (json_output) configObj.responseMimeType = 'application/json';
        if (system_instruction) configObj.systemInstruction = system_instruction;
        if (temperature !== undefined) configObj.temperature = Number(temperature);

        let response: any;
        let retries = 3;
        while (retries > 0) {
            try {
                response = await ai.models.generateContent({ 
                    model, 
                    contents,
                    config: Object.keys(configObj).length > 0 ? configObj : undefined
                });
                break;
            } catch (err: any) {
                if (err.message && err.message.includes('429') && retries > 1) {
                    retries--;
                    await new Promise(r => setTimeout(r, 25000));
                } else {
                    throw err;
                }
            }
        }
        
        for (const uploadResult of uploadResults) {
            await ai.files.delete({ name: uploadResult.name! }).catch(() => {});
        }

        return { content: [{ type: 'text', text: response.text || "" }] };
    } catch (e: any) {
        return { content: [{ type: 'text', text: e.message }], isError: true };
    }
});

server.connect(new StdioServerTransport());
