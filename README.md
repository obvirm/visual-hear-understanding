# @obvirm/visual-hear-understanding

Model Context Protocol (MCP) Server for advanced analysis of physical media (images, video, and audio) using the Google Gemini API.

## System Requirements

- Node.js (version 18 or higher)
- FFmpeg (optional, but required for image/video compression, segment cutting, and audio extraction)
- Google Gemini API Key

## Environment Configuration

Because this operates as an MCP Server, environment variables should not be managed via a local `.env` file. Instead, they must be passed directly through the MCP client's JSON configuration (e.g., Cursor, Claude Desktop).

- `GEMINI_API_KEY` (Required): Authentication key from Google AI Studio.
- `GEMINI_MODEL` (Optional): The default model to be used if the model parameter is omitted in the request. (Default: `gemini-2.5-pro`).

**Example MCP Client Configuration:**
```json
{
  "mcpServers": {
    "visual-hear-understanding": {
      "command": "npx",
      "args": ["-y", "@obvirm/visual-hear-understanding"],
      "env": {
        "GEMINI_API_KEY": "YOUR_API_KEY_HERE",
        "GEMINI_MODEL": "gemini-2.5-flash"
      }
    }
  }
}
```

## Tool Specification: `analyze_with_gemini`

This tool uploads local media to the Gemini infrastructure for analytical processing, then automatically deletes it from the Google servers immediately after a response is received to maintain the 20 GB storage quota.

### Input Parameters (Schema)

- **prompt** `[String] (Required)`
  The analytical instruction or question regarding the uploaded media content.
  
- **media_path** `[String] (Optional)`
  The absolute path to a single media file in the local storage.
  
- **media_paths** `[Array of Strings] (Optional)`
  A list of absolute paths for uploading and processing multiple files in parallel (comparative analysis).
  
- **model** `[String] (Optional)`
  An override parameter to force a different model for a single instruction without altering the global environment (e.g., `gemini-2.5-flash`).
  
- **start_time** `[String] (Optional)`
  The starting duration point for local segment cutting. Accepted formats: `HH:MM:SS` or round seconds (`60`). Requires FFmpeg installation.
  
- **end_time** `[String] (Optional)`
  The ending duration point for local segment cutting. Requires FFmpeg installation.
  
- **json_output** `[Boolean] (Optional)`
  When set to `true`, forces the instruction to return pure structured values in JSON format by activating *responseMimeType*.
  
- **audio_only** `[Boolean] (Optional)`
  When set to `true`, discards the visual track from a video and extracts only the audio (`.mp3`) locally. Drastically reduces upload times for transcription purposes. Requires FFmpeg.
  
- **auto_compress** `[Boolean] (Optional)`
  When set to `true`, alters the original resolution scale of images or videos to a maximum width of 1920 pixels. Optimizes API token limits without significantly sacrificing analytical quality. Requires FFmpeg.
  
- **system_instruction** `[String] (Optional)`
  Provides an absolute persona or foundational system-wide instruction to the AI to limit the scope of the answers.
  
- **temperature** `[Number] (Optional)`
  A decimal scale controlling the determinism of the output (0.0 to 2.0).

### Resilience Mechanisms

- **Size Limit Block**: The script performs synchronous validation to instantly reject files above the 2 GB hard limit to prevent I/O bottlenecks.
- **Anti-Rate Limit (Auto-Retry)**: Catches `429` error responses on sudden calls and enforces a 25-second backoff delay up to a maximum of three retries before emitting the actual error to the client.
- **Conditional FFmpeg Detection**: Binary check for `ffmpeg` is performed at initialization. Manipulation features are gracefully disabled with a client warning without halting the processing cycle if the module is unavailable.
