const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== HELPER ==========
const fixTikwmUrl = (u) => {
    if (!u) return null;
    return u.startsWith('http') ? u : `https://www.tikwm.com${u}`;
};

// ========== TIKTOK ==========
app.post('/api/tiktok', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL TikTok wajib diisi!' });
        if (!url.includes('tiktok.com') && !url.includes('vt.tiktok.com')) {
            return res.status(400).json({ error: 'URL bukan dari TikTok!' });
        }

        const response = await axios.get('https://www.tikwm.com/api/', {
            params: { url }, timeout: 15000
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
            author_nickname: data.author?.nickname || 'Unknown',
            thumbnail: fixTikwmUrl(data.cover),
            duration: data.duration,
            video_no_watermark: fixTikwmUrl(data.play),
            video_hd: fixTikwmUrl(data.hd),
            music: fixTikwmUrl(data.music),
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

// ========== INSTAGRAM (pake API publik) ==========
app.post('/api/instagram', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL Instagram wajib diisi!' });
        if (!url.includes('instagram.com')) {
            return res.status(400).json({ error: 'URL bukan dari Instagram!' });
        }

        const response = await axios.get('https://www.instagram.com/api/v1/media/info/', {
            params: { url },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Instagram error:', error.message);
        res.status(500).json({ error: 'Gagal download Instagram. Coba lagi!' });
    }
});

// ========== TWITTER/X ==========
app.post('/api/twitter', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL Twitter/X wajib diisi!' });
        if (!url.includes('twitter.com') && !url.includes('x.com')) {
            return res.status(400).json({ error: 'URL bukan dari Twitter/X!' });
        }

        const response = await axios.get('https://api.vxtwitter.com/Twitter/status/' + url.split('/status/')[1], {
            timeout: 15000
        });

        res.json({
            success: true,
            platform: 'twitter',
            title: response.data.text || 'Twitter Video',
            author: response.data.user_screen_name || 'Unknown',
            thumbnail: response.data.mediaURLs?.[0] || '',
            video: response.data.mediaURLs?.filter(u => u.includes('.mp4')) || []
        });
    } catch (error) {
        console.error('Twitter error:', error.message);
        res.status(500).json({ error: 'Gagal download Twitter/X. Coba lagi!' });
    }
});

// ========== TRENDING TIKTOK ==========
app.get('/api/trending', async (req, res) => {
    try {
        const response = await axios.get('https://www.tikwm.com/api/feed/list', {
            params: { region: 'ID', count: 12 },
            timeout: 15000
        });

        if (response.data.code !== 0) {
            return res.status(400).json({ error: 'Gagal ambil trending' });
        }

        const videos = response.data.data.map(v => ({
            id: v.video_id,
            title: v.title,
            author: v.author?.unique_id,
            thumbnail: fixTikwmUrl(v.cover),
            video_url: fixTikwmUrl(v.play),
            stats: {
                plays: v.play_count || 0,
                likes: v.digg_count || 0
            }
        }));

        res.json({ success: true, videos });
    } catch (error) {
        console.error('Trending error:', error.message);
        res.status(500).json({ error: 'Gagal ambil trending' });
    }
});

// ========== BATCH DOWNLOAD ==========
app.post('/api/batch', async (req, res) => {
    try {
        const { urls } = req.body;
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: 'URLs harus array!' });
        }

        const results = [];
        for (const url of urls.slice(0, 10)) {
            try {
                const response = await axios.get('https://www.tikwm.com/api/', {
                    params: { url }, timeout: 15000
                });

                if (response.data.code === 0) {
                    const data = response.data.data;
                    results.push({
                        success: true,
                        url,
                        title: data.title,
                        author: data.author?.unique_id,
                        thumbnail: fixTikwmUrl(data.cover),
                        video_no_watermark: fixTikwmUrl(data.play),
                        video_hd: fixTikwmUrl(data.hd),
                        music: fixTikwmUrl(data.music)
                    });
                } else {
                    results.push({ success: false, url, error: 'Gagal ambil video' });
                }
            } catch (e) {
                results.push({ success: false, url, error: e.message });
            }
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error('Batch error:', error.message);
        res.status(500).json({ error: 'Gagal batch download' });
    }
});

// ========== GROQ AI CHAT ==========
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Pesan wajib diisi!' });
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'API key Groq belum diset!' });
        }

        const messages = [
            { role: 'system', content: 'Kamu adalah Zerozx AI, asisten yang ramah dan suka membantu. Jawab dengan bahasa Indonesia gaul.' },
            ...(history || []),
            { role: 'user', content: message }
        ];

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            { model: 'openai/gpt-oss-20b', messages, temperature: 0.7, max_tokens: 2000 },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                timeout: 30000
            }
        );

        res.json({ success: true, reply: response.data.choices[0].message.content });
    } catch (error) {
        console.error('Groq error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Gagal konek ke AI. Coba lagi!' });
    }
});

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => console.log(`\nZEROZX ALL-IN-ONE\nhttp://localhost:${PORT}\n`));
}
