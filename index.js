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

// 1. Create temporary cookies file from Render environment variable on server boot
const tempCookiesPath = path.join("/tmp", "cookies.txt");

if (process.env.YOUTUBE_COOKIES) {
  try {
    fs.writeFileSync(tempCookiesPath, process.env.YOUTUBE_COOKIES.trim());
    console.log("[COOKIE SYSTEM]: YouTube cookies written to /tmp/cookies.txt successfully.");
  } catch (err) {
    console.error("[COOKIE ERROR]: Failed to write cookies file:", err.message);
  }
} else {
  console.warn("[COOKIE WARNING]: YOUTUBE_COOKIES env var is missing! YouTube may block requests.");
}

app.post("/api/process", async (req, res) => {
  const { videoUrl, startTime, endTime } = req.body;

  if (!videoUrl || !startTime || !endTime) {
    return res.status(400).json({ error: "Missing required fields: videoUrl, startTime, endTime" });
  }

  const outputFileName = `trim_${Date.now()}.mp4`;
  const outputPath = path.join("/tmp", outputFileName);

  try {
    // 2. Configure yt-dlp arguments
    const options = {
      getUrl: true,
      format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      noCheckCertificates: true,
      preferFreeFormats: true,
    };

    // Attach cookies flag if the temp file exists
    if (fs.existsSync(tempCookiesPath)) {
      options.cookies = tempCookiesPath;
    }

    // 3. Extract direct stream URL
    const streamOutput = await youtubeDl(videoUrl, options);
    const mediaUrl = String(streamOutput).trim().split("\n")[0];

    if (!mediaUrl) {
      throw new Error("Could not extract media stream URL from yt-dlp.");
    }

    // 4. Trim video using ffmpeg-static binary
    const ffmpegCmd = `"${ffmpegPath}" -ss ${startTime} -to ${endTime} -i "${mediaUrl}" -c:v libx264 -preset ultrafast -c:a aac "${outputPath}"`;
    await execAsync(ffmpegCmd);

    // 5. Stream the resulting file back and clean up /tmp
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Worker live on port ${PORT}`));