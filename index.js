// index.js
const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/process", (req, res) => {
  const { videoUrl, startTime, endTime } = req.body;

  if (!videoUrl || !startTime || !endTime) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const outputFileName = `trim_${Date.now()}.mp4`;
  const outputPath = path.join("/tmp", outputFileName);

  // Uses yt-dlp to grab stream URLs and passes them straight to FFmpeg
  const command = `ffmpeg -ss ${startTime} -to ${endTime} -i "$(yt-dlp -g -f 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best' "${videoUrl}" | head -n 1)" -c:v libx264 -preset ultrafast -c:a aac "${outputPath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("FFmpeg Error:", stderr);
      return res.status(500).json({ error: "Failed to process video" });
    }

    res.download(outputPath, () => {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath); // Clean up temp file
      }
    });
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Worker live on port ${PORT}`));