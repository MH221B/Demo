import express from 'express';
import multer from 'multer';
import { engine } from 'express-handlebars';
import LZString from 'lz-string'
import knex from 'knex';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;
const db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.host,
        port: process.env.port,
        user: process.env.user,
        password: process.env.password,
        database: process.env.database
    },
  pool: { min: 0, max: 7 }
});

async function storeImg(img) {
    return db('IMAGE')
        .insert({ DATA: img })
        .then(() => console.log('Image stored successfully'))
        .catch(err => console.error('Error storing image:', err));
}

async function storeAudio(audio) {
    return db('AUDIO')
        .insert({ DATA: audio })
        .then(() => console.log('Audio stored successfully'))
        .catch(err => console.error('Error storing audio:', err));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Storage configuration
const storage = multer.memoryStorage();

// Image filter function
const fileFilterImg = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('File is not an image.'), false);
    }
}

// Audio filter function
const fileFilterAudio = (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('File is not an audio.'), false);
    }
}

// Multer upload configuration for images and audio
const uploadImg = multer({ storage: storage, fileFilter: fileFilterImg });
const uploadAudio = multer({ storage: storage, fileFilter: fileFilterAudio });

app.engine('handlebars', engine({
    partialsDir: path.join(__dirname, 'views', 'partials')
}));

app.set('view engine', 'handlebars');
app.set('views', './views');
app.use(express.static('public'));

// Home route
app.get('/', (req, res) => {
    res.render('home', { layout: false });
});

app.get('/storedImages', (req, res) => {
    db('IMAGE').select('*').then(data => { // Selecting all columns
        let result = [];
        for (let i = 0; i < data.length; i++) {
            // Decompress the DATA column
            let temp = LZString.decompressFromUTF16(data[i].DATA);
            console.log('ID:', data[i].ID); // Log the ID for reference
            // console.log('Length after decompressed:', data[i].DATA.length);
            console.log('Length after decompressed:', temp.length);
            // Construct the HTML for each image
            result.push('<img src="' + temp + '" alt="Image" />');
        }
        res.send(result.join(''));
    }).catch(err => {
        console.error('Error fetching images:', err);
        res.status(500).send('Error fetching images.');
    });
});


// Audio page route
app.get('/audio', (req, res) => {
    res.render('audio', { layout: false });
});

// Image upload route
app.post('/upload', uploadImg.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded or file is not an image.');
    }

    // Get the base64 encoding directly from the buffer
    const base64Image = req.file.buffer.toString('base64');
    const imgSrc = `data:${req.file.mimetype};base64,${base64Image}`;
    console.log('Original length: ', imgSrc.length);
    const compressed = LZString.compressToUTF16(imgSrc);
    console.log('Compressed length: ', compressed.length);
    try {
        await storeImg(compressed);
        res.redirect('/');
    } catch (error) {
        res.status(500).send('Error storing the image.');
    }
});


// Audio upload route
app.post('/upload-audio', uploadAudio.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded or file is not an audio.');
    }

    // Get the base64 encoding directly from the buffer
    const base64Audio = req.file.buffer.toString('base64');
    const audioSrc = `data:${req.file.mimetype};base64,${base64Audio}`;
    console.log('Original audio length: ', audioSrc.length);

    // Compress the audio data
    const compressed = LZString.compressToUTF16(audioSrc);
    console.log('Compressed audio length: ', compressed.length);

    try {
        await storeAudio(compressed);
        res.redirect('/audio');
    } catch (error) {
        console.error('Error storing audio:', error);
        res.status(500).send('Error storing the audio.');
    }
});

// Route to display stored audio
app.get('/storedAudio', (req, res) => {
    db('AUDIO').select('*').then(data => {
        let result = [];
        for (let i = 0; i < data.length; i++) {
            // Decompress the DATA column
            let temp = LZString.decompressFromUTF16(data[i].DATA);
            console.log('ID:', data[i].ID); // Log the ID for reference
            console.log('Length after decompressed:', temp.length);

            // Construct the HTML for each audio file
            result.push(`
                <audio controls>
                    <source src="${temp}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            `);
        }
        res.send(result.join(''));
    }).catch(err => {
        console.error('Error fetching audio:', err);
        res.status(500).send('Error fetching audio.');
    });
});


app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});

