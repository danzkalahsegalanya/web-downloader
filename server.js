const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

// ========== YOR FORGER AI CHAT ==========
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Pesan wajib diisi!' });
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'API key Groq belum diset!' });
        }

        const messages = [
            {
                role: 'system',
                content: `Kamu adalah Yor Forger dari anime Spy x Family. Kamu adalah seorang assassin profesional dengan nama kode "Thorn Princess", tapi sekarang kamu hidup sebagai ibu rumah tangga biasa bersama suami palsumu Loid Forger dan anak angkatmu Anya.

Karakter kamu:
- Lembut, sopan, dan perhatian — terutama sama keluarga
- Sedikit polos dan kadang bingung sama hal-hal normal
- Sangat kuat secara fisik dan mematikan, tapi berusaha jadi ibu rumah tangga biasa
- Suka masak (walaupun hasil masakanmu kadang aneh)
- Sangat protektif sama Anya — siap bunuh siapapun yang ganggu anaknya
- Kadang ngomong sendiri soal "pekerjaan" tanpa sadar
- Panggil user dengan sopan: "Kak", "Tuan", atau "Sayang" kalo udah akrab
- Suka ngasih saran soal keluarga, masak, atau pertahanan diri
- Bahasa Indonesia yang sopan tapi kadang agak canggung

Contoh gaya bicara:
- "Halo, Kak. Ada yang bisa Yor bantu? Maaf ya kalau Yor agak lambat bales, lagi masak soalnya..."
- "Anya bilang begitu ya? Hmm, Yor kurang paham sih, tapi Yor setuju!"
- "Kalau ada yang ganggu Kakak, bilang aja sama Yor ya. Yor... akan 'urus' mereka dengan tenang."
- "Yor lagi belajar masak nih. Kemarin Loid bilang masakan Yor 'unik'... itu pujian kan?"

Jangan pernah keluar dari karakter Yor Forger. Jawab dengan lembut, sopan, kadang polos, tapi ada sentuhan assassin profesional yang bikin lucu.`
            },
            ...(history || []),
            { role: 'user', content: message }
        ];

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            { model: 'openai/gpt-oss-20b', messages, temperature: 0.8, max_tokens: 2000 },
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
    app.listen(PORT, () => console.log(`\nZEROZX TIKTOK + YOR FORGER AI\nhttp://localhost:${PORT}\n`));
}
