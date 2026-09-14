const express = require('express');
const axios = require('axios');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== TIKTOK DOWNLOADER (PAKE API TIKWM) ==========
app.post('/api/tiktok', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL TikTok wajib diisi!' });
        }

        // Validasi URL TikTok
        if (!url.includes('tiktok.com') && !url.includes('vt.tiktok.com')) {
            return res.status(400).json({ error: 'URL bukan dari TikTok!' });
        }

        // Panggil API tikwm
        const response = await axios.get('https://www.tikwm.com/api/', {
            params: { url: url },
            timeout: 10000
        });

        if (response.data.code !== 0) {
            return res.status(400).json({ error: 'Gagal ambil video TikTok' });
        }

        const data = response.data.data;

        res.json({
            success: true,
            platform: 'tiktok',
            title: data.title || 'TikTok Video',
            author: data.author?.unique_id || 'Unknown',
            thumbnail: data.cover,
            duration: data.duration,
            video_no_watermark: `https://www.tikwm.com${data.play}`,
            video_hd: data.hd ? `https://www.tikwm.com${data.hd}` : null,
            music: data.music ? `https://www.tikwm.com${data.music}` : null
        });

    } catch (error) {
        console.error('TikTok error:', error.message);
        res.status(500).json({ error: 'Gagal download TikTok. Coba lagi!' });
    }
});

// ========== YOUTUBE DOWNLOADER (PAKE YTDL-CORE) ==========
app.post('/api/youtube', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL YouTube wajib diisi!' });
        }

        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'URL YouTube tidak valid!' });
        }

        const info = await ytdl.getInfo(url);

        // Filter format video (mp4) dan audio (m4a/webm)
        const videoFormats = info.formats
            .filter(f => f.hasVideo && f.hasAudio)
            .map(f => ({
                quality: f.qualityLabel || 'Unknown',
                container: f.container,
                size: f.contentLength ? (parseInt(f.contentLength) / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown',
                url: f.url
            }))
            .slice(0, 5);

        const audioFormats = info.formats
            .filter(f => !f.hasVideo && f.hasAudio)
            .map(f => ({
                quality: f.audioBitrate ? f.audioBitrate + 'kbps' : 'Unknown',
                container: f.container,
                url: f.url
            }))
            .slice(0, 3);

        res.json({
            success: true,
            platform: 'youtube',
            title: info.videoDetails.title,
            author: info.videoDetails.author.name,
            thumbnail: info.videoDetails.thumbnails.slice(-1)[0].url,
            duration: parseInt(info.videoDetails.lengthSeconds),
            views: info.videoDetails.viewCount,
            video: videoFormats,
            audio: audioFormats
        });

    } catch (error) {
        console.error('YouTube error:', error.message);
        res.status(500).json({ error: 'Gagal download YouTube. Coba lagi!' });
    }
});

// ========== DOWNLOAD PROXY (BUAT BYPASS CORS) ==========
app.get('/api/proxy', async (req, res) => {
    try {
        const { url, filename } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL wajib diisi!' });
        }

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

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`\n🔥 ZEROZX VIDEO DOWNLOADER\n`);
    console.log(`   Server jalan di: http://localhost:${PORT}`);
    console.log(`   Tekan Ctrl+C buat stop\n`);
});