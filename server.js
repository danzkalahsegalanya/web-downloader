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

// ========== GROQ AI CHAT ==========
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) return res.status(400).json({ error: 'Pesan wajib diisi!' });

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'API key Groq belum diset di Vercel!' });
        }

        const messages = [
            {
                role: 'system',
                content: 'Kamu adalah Zerozx AI, asisten yang ramah, pintar, dan suka membantu. Jawab dengan bahasa Indonesia gaul yang santai dan jelas.'
            },
            ...(history || []),
            { role: 'user', content: message }
        ];

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                timeout: 30000
            }
        );

        const reply = response.data.choices[0].message.content;

        res.json({
            success: true,
            reply: reply
        });

    } catch (error) {
        console.error('Groq error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Gagal konek ke AI. Coba lagi!' });
    }
});

// ========== VERCEL EXPORT ==========
module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\nZEROZX TIKTOK + AI (Groq)\n`);
        console.log(`Server jalan di: http://localhost:${PORT}\n`);
    });
}
