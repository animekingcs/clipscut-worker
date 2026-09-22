// index.js (Render Worker)
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { promisify } = require("util");
const ffmpegPath = require("ffmpeg-static");
const youtubeDl = require("yt-dlp-exec");

const execAsync = promisify(exec);
const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/process", async (req, res) => {
  const { videoUrl, startTime, endTime } = req.body;

  if (!videoUrl || !startTime || !endTime) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const outputFileName = `trim_${Date.now()}.mp4`;
  const outputPath = path.join("/tmp", outputFileName);

  try {
    // 1. Fetch direct media stream URL via yt-dlp-exec
    const streamOutput = await youtubeDl(videoUrl, {
      getUrl: true,
      format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    });

    const mediaUrl = String(streamOutput).trim().split("\n")[0];

    if (!mediaUrl) {
      throw new Error("Could not extract media stream URL from yt-dlp.");
    }

    // 2. Trim video using ffmpeg-static
    const ffmpegCmd = `"${ffmpegPath}" -ss ${startTime} -to ${endTime} -i "${mediaUrl}" -c:v libx264 -preset ultrafast -c:a aac "${outputPath}"`;
    await execAsync(ffmpegCmd);

    // 3. Download output file and cleanup /tmp
    res.download(outputPath, (err) => {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    });
  } catch (error) {
    console.error("[RENDER WORKER ERROR]:", error.message);
    return res.status(500).json({
      error: "Failed to process video",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Worker live on port ${PORT}`));