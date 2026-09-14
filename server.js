const express = require('express');
const axios = require('axios');
const cors = require('cors');
const playdl = require('play-dl');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== TIKTOK DOWNLOADER ==========
app.post('/api/tiktok', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) return res.status(400).json({ error: 'URL TikTok wajib diisi!' });
        if (!url.includes('tiktok.com') && !url.includes('vt.tiktok.com')) {
            return res.status(400).json({ error: 'URL bukan dari TikTok!' });
        }

        const response = await axios.get('https://www.tikwm.com/api/', {
            params: { url: url },
            timeout: 10000
        });

        if (response.data.code !== 0) {
            return res.status(400).json({ error: 'Gagal ambil video TikTok' });
        }

        const data = response.data.data;

        const fixUrl = (u) => {
            if (!u) return null;
            return u.startsWith('http') ? u : `https://www.tikwm.com${u}`;
        };

        res.json({
            success: true,
            platform: 'tiktok',
            title: data.title || 'TikTok Video',
            author: data.author?.unique_id || 'Unknown',
            thumbnail: fixUrl(data.cover),
            duration: data.duration,
            video_no_watermark: fixUrl(data.play),
            video_hd: fixUrl(data.hd),
            music: fixUrl(data.music)
        });

    } catch (error) {
        console.error('TikTok error:', error.message);
        res.status(500).json({ error: 'Gagal download TikTok. Coba lagi!' });
    }
});

// ========== YOUTUBE DOWNLOADER (PAKE PLAY-DL) ==========
app.post('/api/youtube', async (req, res) => {
    try {
        let { url } = req.body;

        if (!url) return res.status(400).json({ error: 'URL YouTube wajib diisi!' });

        // Normalize youtu.be short link
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1].split('?')[0];
            url = `https://www.youtube.com/watch?v=${videoId}`;
        }

        // Normalize youtube shorts
        if (url.includes('/shorts/')) {
            const videoId = url.split('/shorts/')[1].split('?')[0];
            url = `https://www.youtube.com/watch?v=${videoId}`;
        }

        // Validasi URL
        const urlType = playdl.yt_validate(url);
        if (urlType !== 'video') {
            return res.status(400).json({ error: 'URL YouTube tidak valid!' });
        }

        // Ambil info video
        const videoInfo = await playdl.video_info(url);
        const details = videoInfo.video_details;

        // Filter format video (mp4)
        const videoFormats = videoInfo.format
            .filter(f => f.mimeType && f.mimeType.includes('video'))
            .map(f => ({
                quality: f.qualityLabel || 'Unknown',
                container: f.mimeType.includes('mp4') ? 'mp4' : 'webm',
                size: f.contentLength ? (parseInt(f.contentLength) / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown',
                url: f.url
            }))
            .slice(0, 5);

        // Format audio (m4a/webm)
        const audioFormats = videoInfo.format
            .filter(f => f.mimeType && f.mimeType.includes('audio') && !f.mimeType.includes('video'))
            .map(f => ({
                quality: f.audioBitrate ? f.audioBitrate + 'kbps' : 'Unknown',
                container: f.mimeType.includes('mp4') ? 'm4a' : 'webm',
                url: f.url
            }))
            .slice(0, 3);

        res.json({
            success: true,
            platform: 'youtube',
            title: details.title,
            author: details.channel?.name || 'Unknown',
            thumbnail: details.thumbnails?.[0]?.url || '',
            duration: details.durationInSec || 0,
            views: details.views || 0,
            video: videoFormats,
            audio: audioFormats
        });

    } catch (error) {
        console.error('YouTube error:', error.message);
        res.status(500).json({ error: 'Gagal download YouTube. Coba lagi!' });
    }
});

// ========== PROXY (FALLBACK) ==========
app.get('/api/proxy', async (req, res) => {
    try {
        const { url, filename } = req.query;
        if (!url) return res.status(400).json({ error: 'URL wajib diisi!' });

        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000
        });

        res.setHeader('Content-Disposition', `attachment; filename="${filename || 'video.mp4'}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        response.data.pipe(res);

    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ error: 'Gagal download file' });
    }
});

// ========== VERCEL EXPORT ==========
module.exports = app;

// ========== LOCAL DEV ==========
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\nZEROZX VIDEO DOWNLOADER\n`);
        console.log(`Server jalan di: http://localhost:${PORT}\n`);
    });
}
