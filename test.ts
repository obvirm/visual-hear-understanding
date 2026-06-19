import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import 'dotenv/config';

async function run() {
    const transport = new StdioClientTransport({
        command: "node",
        args: ["build/index.js"],
        env: process.env as any
    });

    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    console.log("Mengirim video ke Gemini untuk dianalisis...");
    
    const result = await client.callTool({
        name: "analyze_with_gemini",
        arguments: {
            prompt: "Jelaskan dengan detail apa isi dan kejadian di dalam video ini. Apa pelajaran hidupnya?",
            media_path: "E:\\project\\videounderstanding\\Pelajaran Hidup dari Pemakaman Palsu 😭❤️.mp4"
        }
    });

    console.log("\n=== HASIL ===");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}

run().catch(console.error);
