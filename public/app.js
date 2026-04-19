const storyForm = document.getElementById('storyForm');
const storiesContainer = document.getElementById('storiesContainer');
const formMessage = document.getElementById('formMessage');
const refreshBtn = document.getElementById('refreshBtn');
const storyTemplate = document.getElementById('storyTemplate');
const photosInput = document.getElementById('photos');
const photosInfo = document.getElementById('photosInfo');
const themeToggle = document.getElementById('themeToggle');
const adminAccessBtn = document.getElementById('adminAccessBtn');

const readerModal = document.getElementById('readerModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTitle = document.getElementById('modalTitle');
const modalMeta = document.getElementById('modalMeta');
const modalContent = document.getElementById('modalContent');
const modalGallery = document.getElementById('modalGallery');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const decreaseFontBtn = document.getElementById('decreaseFontBtn');
const increaseFontBtn = document.getElementById('increaseFontBtn');
const fontSizeLabel = document.getElementById('fontSizeLabel');

const editForm = document.getElementById('editForm');
const editTitle = document.getElementById('editTitle');
const editAuthor = document.getElementById('editAuthor');
const editContent = document.getElementById('editContent');
const editPhotos = document.getElementById('editPhotos');
const editPhotosInfo = document.getElementById('editPhotosInfo');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let storiesState = [];
let selectedStoryId = null;
let isAdminMode = false;
let adminSecret = '';
let readerFontScale = 1;
const MIN_FONT_SCALE = 0.85;
const MAX_FONT_SCALE = 1.6;
const FONT_STEP = 0.1;

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch (_err) {
    return 'Data desconhecida';
  }
}

function getStoryById(storyId) {
  return storiesState.find((story) => story.id === storyId) || null;
}

function setMessage(message, type = '') {
  formMessage.textContent = message;
  formMessage.className = type;
}

function updateAdminButtonLabel() {
  adminAccessBtn.textContent = isAdminMode ? 'Sair admin' : 'Entrar admin';
}

function setAdminMode(enabled, secret = '') {
  isAdminMode = enabled;
  adminSecret = enabled ? secret : '';
  updateAdminButtonLabel();
  renderStories();
  updateModalAdminVisibility();
}

async function verifyAdminSecret(secret) {
  const response = await fetch('/api/admin/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': secret
    },
    body: JSON.stringify({ adminPassword: secret })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || 'Nao foi possivel validar acesso admin.');
  }
}

async function handleAdminAccess() {
  if (isAdminMode) {
    setAdminMode(false);
    setMessage('Modo admin encerrado.', 'success');
    return;
  }

  const typedSecret = window.prompt('Digite o segredo admin:');
  if (!typedSecret || !typedSecret.trim()) {
    return;
  }

  try {
    await verifyAdminSecret(typedSecret.trim());
    setAdminMode(true, typedSecret.trim());
    setMessage('Modo admin ativado.', 'success');
  } catch (error) {
    setAdminMode(false);
    setMessage(error.message, 'error');
  }
}

function applyReaderFontScale() {
  modalContent.style.fontSize = `${(1.2 * readerFontScale).toFixed(2)}rem`;
  fontSizeLabel.textContent = `${Math.round(readerFontScale * 100)}%`;
}

function changeReaderFont(delta) {
  const nextScale = Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, readerFontScale + delta));
  readerFontScale = Number(nextScale.toFixed(2));
  sessionStorage.setItem('reader-font-scale', String(readerFontScale));
  applyReaderFontScale();
}

function initReaderFontScale() {
  const saved = Number(sessionStorage.getItem('reader-font-scale'));
  if (!Number.isNaN(saved) && saved >= MIN_FONT_SCALE && saved <= MAX_FONT_SCALE) {
    readerFontScale = saved;
  }
  applyReaderFontScale();
}

function applyTheme(theme) {
  const darkEnabled = theme === 'dark';
  document.body.classList.toggle('dark-mode', darkEnabled);
  themeToggle.textContent = darkEnabled ? 'Usar tema claro' : 'Ativar modo escuro';
}

function initTheme() {
  const stored = localStorage.getItem('book-theme') || 'light';
  applyTheme(stored);
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  localStorage.setItem('book-theme', nextTheme);
  applyTheme(nextTheme);
}

function setFileInfo(input, infoNode, emptyText) {
  const count = input.files?.length || 0;
  infoNode.textContent = count > 0 ? `${count} arquivo(s) selecionado(s)` : emptyText;
}

function createPreview(content) {
  if (content.length <= 95) {
    return content;
  }
  return `${content.slice(0, 95)}...`;
}

function buildStoryCard(story) {
  const clone = storyTemplate.content.cloneNode(true);
  const cardEl = clone.querySelector('.story-card');
  const titleEl = clone.querySelector('.story-title');
  const metaEl = clone.querySelector('.story-meta');
  const previewEl = clone.querySelector('.story-preview');
  const adminButtons = clone.querySelectorAll('.admin-only');

  cardEl.dataset.storyId = story.id;
  titleEl.textContent = story.title;
  metaEl.textContent = `Por ${story.author} • ${formatDate(story.createdAt)}`;
  previewEl.textContent = `Clique em "Ler historia" para abrir a pagina completa. Trecho: ${createPreview(story.content)}`;

  adminButtons.forEach((button) => {
    button.style.display = isAdminMode ? 'inline-flex' : 'none';
  });

  return clone;
}

function renderStories() {
  storiesContainer.innerHTML = '';

  if (!storiesState.length) {
    storiesContainer.innerHTML = '<p>Nenhuma historinha ainda. Seja a primeira pessoa a publicar.</p>';
    return;
  }

  storiesState.forEach((story) => {
    storiesContainer.appendChild(buildStoryCard(story));
  });
}

async function loadStories() {
  storiesContainer.innerHTML = '<p>Carregando historinhas...</p>';

  try {
    const response = await fetch('/api/stories');
    if (!response.ok) {
      throw new Error('Nao foi possivel carregar as historias.');
    }

    storiesState = await response.json();
    renderStories();
  } catch (error) {
    storiesContainer.innerHTML = `<p>${error.message}</p>`;
  }
}

function fillModal(story) {
  modalTitle.textContent = story.title;
  modalMeta.textContent = `Por ${story.author} • ${formatDate(story.createdAt)}`;
  modalContent.textContent = story.content;

  modalGallery.innerHTML = '';
  if (Array.isArray(story.photos) && story.photos.length > 0) {
    story.photos.forEach((photoPath, index) => {
      const img = document.createElement('img');
      img.src = photoPath;
      img.alt = `Foto ${index + 1} da historia ${story.title}`;
      img.loading = 'lazy';
      modalGallery.appendChild(img);
    });
  }
}

function updateModalAdminVisibility() {
  const display = isAdminMode ? 'inline-flex' : 'none';
  modalEditBtn.style.display = display;
  modalDeleteBtn.style.display = display;
}

function openReader(storyId) {
  const story = getStoryById(storyId);
  if (!story) {
    return;
  }

  selectedStoryId = story.id;
  editForm.classList.add('hidden');
  fillModal(story);
  updateModalAdminVisibility();
  readerModal.showModal();
}

function closeReader() {
  if (readerModal.open) {
    readerModal.close();
  }
  selectedStoryId = null;
  editForm.classList.add('hidden');
  editPhotos.value = '';
  editPhotosInfo.textContent = 'Sem novas fotos';
}

function openEditForm(storyId) {
  const story = getStoryById(storyId);
  if (!story || !isAdminMode) {
    return;
  }

  selectedStoryId = story.id;
  fillModal(story);
  editTitle.value = story.title;
  editAuthor.value = story.author;
  editContent.value = story.content;
  editForm.classList.remove('hidden');

  if (!readerModal.open) {
    updateModalAdminVisibility();
    readerModal.showModal();
  }
}

async function deleteStory(storyId) {
  if (!isAdminMode || !adminSecret) {
    return;
  }

  const confirmed = window.confirm('Tem certeza que deseja excluir esta historinha?');
  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/api/stories/${storyId}`, {
      method: 'DELETE',
      headers: {
        'x-admin-password': adminSecret
      }
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Nao foi possivel excluir.');
    }

    setMessage('Historia excluida com sucesso.', 'success');
    closeReader();
    await loadStories();
  } catch (error) {
    setMessage(error.message, 'error');
  }
}

storiesContainer.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) {
    return;
  }

  const card = actionButton.closest('.story-card');
  const storyId = card?.dataset.storyId;
  if (!storyId) {
    return;
  }

  const action = actionButton.dataset.action;
  if (action === 'read') {
    openReader(storyId);
    return;
  }

  if (action === 'edit') {
    openEditForm(storyId);
    return;
  }

  if (action === 'delete') {
    deleteStory(storyId);
  }
});

storyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('Publicando sua historinha...');

  const formData = new FormData(storyForm);

  try {
    const response = await fetch('/api/stories', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Falha ao publicar historia.');
    }

    storyForm.reset();
    photosInfo.textContent = 'Nenhuma foto selecionada';
    setMessage('Historia publicada com sucesso.', 'success');
    await loadStories();
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!selectedStoryId || !isAdminMode || !adminSecret) {
    return;
  }

  const formData = new FormData(editForm);
  formData.append('adminPassword', adminSecret);

  try {
    const response = await fetch(`/api/stories/${selectedStoryId}`, {
      method: 'PUT',
      body: formData
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Falha ao editar historia.');
    }

    setMessage('Historia editada com sucesso.', 'success');
    await loadStories();
    openReader(selectedStoryId);
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

modalEditBtn.addEventListener('click', () => {
  if (selectedStoryId) {
    openEditForm(selectedStoryId);
  }
});

modalDeleteBtn.addEventListener('click', () => {
  if (selectedStoryId) {
    deleteStory(selectedStoryId);
  }
});

closeModalBtn.addEventListener('click', closeReader);
readerModal.addEventListener('cancel', closeReader);
readerModal.addEventListener('click', (event) => {
  const isBackdrop = event.target === readerModal;
  if (isBackdrop) {
    closeReader();
  }
});

cancelEditBtn.addEventListener('click', () => {
  editForm.classList.add('hidden');
});

refreshBtn.addEventListener('click', () => {
  loadStories();
});

photosInput.addEventListener('change', () => {
  setFileInfo(photosInput, photosInfo, 'Nenhuma foto selecionada');
});
editPhotos.addEventListener('change', () => {
  setFileInfo(editPhotos, editPhotosInfo, 'Sem novas fotos');
});
themeToggle.addEventListener('click', toggleTheme);
adminAccessBtn.addEventListener('click', () => {
  handleAdminAccess();
});
decreaseFontBtn.addEventListener('click', () => {
  changeReaderFont(-FONT_STEP);
});
increaseFontBtn.addEventListener('click', () => {
  changeReaderFont(FONT_STEP);
});

initTheme();
initReaderFontScale();
updateAdminButtonLabel();
loadStories();
