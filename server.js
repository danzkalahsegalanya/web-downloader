const express = require('express');
const axios = require('axios');
const cors = require('cors');
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
            title: data.title || 'TikTok Video',
            author: data.author?.unique_id || 'Unknown',
            author_nickname: data.author?.nickname || 'Unknown',
            thumbnail: fixUrl(data.cover),
            duration: data.duration,
            video_no_watermark: fixUrl(data.play),
            video_hd: fixUrl(data.hd),
            music: fixUrl(data.music),
            stats: {
                plays: data.play_count || 0,
                likes: data.digg_count || 0,
                comments: data.comment_count || 0,
                shares: data.share_count || 0
            }
        });

    } catch (error) {
        console.error('TikTok error:', error.message);
        res.status(500).json({ error: 'Gagal download TikTok. Coba lagi!' });
    }
});

// ========== VERCEL EXPORT ==========
module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\nZEROZX TIKTOK DOWNLOADER\n`);
        console.log(`Server jalan di: http://localhost:${PORT}\n`);
    });
}
