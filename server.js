const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const fssync = require('fs');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_PASSWORD = 'admin';

const ROOT_DIR = __dirname;
const fallbackBaseDir = path.join(os.tmpdir(), 'livro-de-historias');
const storageBaseDir = process.env.STORAGE_DIR || ROOT_DIR;
const DATA_DIR = path.join(storageBaseDir, 'data');
const UPLOAD_DIR = path.join(storageBaseDir, 'uploads');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');

function ensureStorage(baseDir) {
  const dataDir = path.join(baseDir, 'data');
  const uploadDir = path.join(baseDir, 'uploads');
  const storiesFile = path.join(dataDir, 'stories.json');

  if (!fssync.existsSync(dataDir)) {
    fssync.mkdirSync(dataDir, { recursive: true });
  }

  if (!fssync.existsSync(uploadDir)) {
    fssync.mkdirSync(uploadDir, { recursive: true });
  }

  if (!fssync.existsSync(storiesFile)) {
    fssync.writeFileSync(storiesFile, '[]\n');
  }

  return { dataDir, uploadDir, storiesFile };
}

let activeStorage = { dataDir: DATA_DIR, uploadDir: UPLOAD_DIR, storiesFile: STORIES_FILE };
try {
  activeStorage = ensureStorage(storageBaseDir);
} catch (_err) {
  // Em hosts gerenciados com pasta de app read-only, usa temp dir.
  activeStorage = ensureStorage(fallbackBaseDir);
}

const ACTIVE_DATA_DIR = activeStorage.dataDir;
const ACTIVE_UPLOAD_DIR = activeStorage.uploadDir;
const ACTIVE_STORIES_FILE = activeStorage.storiesFile;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ACTIVE_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 40);
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${baseName || 'foto'}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    files: 6,
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const isImage = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype);
    if (!isImage) {
      return cb(new Error('Apenas imagens sao permitidas (JPG, PNG, WEBP, GIF).'));
    }
    cb(null, true);
  }
});

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(ACTIVE_UPLOAD_DIR));
app.use(express.static(path.join(ROOT_DIR, 'public')));

async function readStories() {
  try {
    const content = await fs.readFile(ACTIVE_STORIES_FILE, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

async function writeStories(stories) {
  await fs.writeFile(ACTIVE_STORIES_FILE, JSON.stringify(stories, null, 2), 'utf8');
}

function extractAdminPassword(req) {
  const bodyPassword = typeof req.body?.adminPassword === 'string' ? req.body.adminPassword : '';
  const headerPassword = typeof req.headers['x-admin-password'] === 'string' ? req.headers['x-admin-password'] : '';
  return (bodyPassword || headerPassword).trim();
}

function isAdminPasswordConfigured() {
  return ADMIN_PASSWORD.length > 0;
}

function hasAdminAccess(req) {
  if (!isAdminPasswordConfigured()) {
    return false;
  }

  const provided = extractAdminPassword(req);
  if (!provided || provided.length !== ADMIN_PASSWORD.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(ADMIN_PASSWORD));
}

function requireAdmin(req, res) {
  if (!isAdminPasswordConfigured()) {
    res.status(503).json({
      message: 'A senha admin ainda nao foi configurada no servidor.'
    });
    return false;
  }

  if (!hasAdminAccess(req)) {
    res.status(403).json({
      message: 'Segredo admin invalido.'
    });
    return false;
  }

  return true;
}

function parseRemovePhotosField(removePhotosField) {
  if (Array.isArray(removePhotosField)) {
    return removePhotosField.filter(Boolean);
  }

  if (typeof removePhotosField === 'string' && removePhotosField.trim()) {
    return [removePhotosField.trim()];
  }

  return [];
}

async function deletePhotoFiles(photos = []) {
  const removals = photos.map(async (photoPath) => {
    const fileName = path.basename(photoPath || '');
    if (!fileName) {
      return;
    }
    const absolutePath = path.join(ACTIVE_UPLOAD_DIR, fileName);
    try {
      await fs.unlink(absolutePath);
    } catch (_err) {
      // Ignora arquivo ausente para nao quebrar o fluxo da API.
    }
  });

  await Promise.all(removals);
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    runtime: 'node',
    storageDir: path.dirname(ACTIVE_DATA_DIR),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stories', async (_req, res) => {
  const stories = await readStories();
  stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(stories);
});

app.post('/api/admin/verify', (req, res) => {
  if (!isAdminPasswordConfigured()) {
    return res.status(503).json({
      message: 'A senha admin ainda nao foi configurada no servidor.'
    });
  }

  if (!hasAdminAccess(req)) {
    return res.status(403).json({
      message: 'Segredo admin invalido.'
    });
  }

  res.json({ ok: true });
});

app.post('/api/stories', upload.array('photos', 6), async (req, res) => {
  try {
    const title = (req.body.title || '').trim();
    const author = (req.body.author || '').trim();
    const content = (req.body.content || '').trim();

    if (!title || !content) {
      return res.status(400).json({
        message: 'Titulo e historia sao obrigatorios.'
      });
    }

    const stories = await readStories();
    const photos = (req.files || []).map((file) => `/uploads/${file.filename}`);

    const story = {
      id: crypto.randomUUID(),
      title,
      author: author || 'Autor(a) anonimo(a)',
      content,
      photos,
      createdAt: new Date().toISOString()
    };

    stories.push(story);
    await writeStories(stories);

    res.status(201).json(story);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Erro ao salvar historia.'
    });
  }
});

app.put('/api/stories/:id', upload.array('photos', 6), async (req, res) => {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const title = (req.body.title || '').trim();
    const author = (req.body.author || '').trim();
    const content = (req.body.content || '').trim();

    if (!title || !content) {
      return res.status(400).json({
        message: 'Titulo e historia sao obrigatorios.'
      });
    }

    const stories = await readStories();
    const storyIndex = stories.findIndex((story) => story.id === req.params.id);
    if (storyIndex === -1) {
      return res.status(404).json({
        message: 'Historia nao encontrada.'
      });
    }

    const currentStory = stories[storyIndex];
    const currentPhotos = Array.isArray(currentStory.photos) ? currentStory.photos : [];
    const removePhotos = parseRemovePhotosField(req.body.removePhotos);
    const removeSet = new Set(removePhotos);
    const keptPhotos = currentPhotos.filter((photoPath) => !removeSet.has(photoPath));
    const newPhotos = (req.files || []).map((file) => `/uploads/${file.filename}`);
    const nextPhotos = [...keptPhotos, ...newPhotos].slice(0, 6);

    if (removePhotos.length > 0) {
      const existingToRemove = currentPhotos.filter((photoPath) => removeSet.has(photoPath));
      await deletePhotoFiles(existingToRemove);
    }

    const updatedStory = {
      ...currentStory,
      title,
      author: author || 'Autor(a) anonimo(a)',
      content,
      photos: nextPhotos,
      updatedAt: new Date().toISOString()
    };

    stories[storyIndex] = updatedStory;
    await writeStories(stories);

    res.json(updatedStory);
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Erro ao editar historia.'
    });
  }
});

app.delete('/api/stories/:id', async (req, res) => {
  try {
    if (!requireAdmin(req, res)) {
      return;
    }

    const stories = await readStories();
    const storyIndex = stories.findIndex((story) => story.id === req.params.id);

    if (storyIndex === -1) {
      return res.status(404).json({
        message: 'Historia nao encontrada.'
      });
    }

    const [removedStory] = stories.splice(storyIndex, 1);
    await writeStories(stories);
    await deletePhotoFiles(removedStory.photos || []);

    res.json({
      message: 'Historia excluida com sucesso.'
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Erro ao excluir historia.'
    });
  }
});

app.use((err, _req, res, _next) => {
  const status = err.message && err.message.includes('Apenas imagens') ? 400 : 500;
  res.status(status).json({
    message: err.message || 'Erro interno do servidor.'
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Livro de Historias no ar: http://${HOST}:${PORT}`);
  console.log(`Storage ativo: ${path.dirname(ACTIVE_DATA_DIR)}`);
});
