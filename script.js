// script.js – lightweight vanilla JS for Radar MBG
// Dummy data schema (replace with real API later)
// Data will be loaded from the backend API (api.php)
function loadData(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `api.php?${qs}` : 'api.php';
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    })
    .then(data => {
      renderResults(data);
    })
    .catch(err => {
      console.error('Failed to fetch data:', err);
      const container = document.getElementById('results-container');
      container.innerHTML = '<p class="placeholder-text">Gagal memuat data. Silakan coba lagi.</p>';
    });
}

// Utility: format date to locale string
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function createChip(label, value) {
  const span = document.createElement('span');
  span.className = 'nutri-chip';
  span.textContent = `${label}: ${value}`;
  return span;
}

function renderCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.tabIndex = 0; // keyboard focus
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Lihat detail menu ${item.menu} di ${item.school}`);

  const img = document.createElement('img');
  img.alt = `Foto ${item.menu}`;
  if (item.photo) {
    img.dataset.src = item.photo; // lazy-load
    img.src = "data:image/svg+xml;charset=UTF-8,<svg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='180'%20viewBox='0%200%20400%20180'><rect%20width='400'%20height='180'%20fill='%23e9ecef'/><text%20x='50%25'%20y='50%25'%20dominant-baseline='middle'%20text-anchor='middle'%20fill='%236c757d'%20font-size='16'>Loading...</text></svg>";
    img.classList.add('lazy');
  } else {
    img.src = "https://via.placeholder.com/400x180?text=Tidak%20Ada%20Foto";
  }
  card.appendChild(img);

  const content = document.createElement('div');
  content.className = 'card-content';
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = `${item.school} – ${formatDate(item.date)}`;
  content.appendChild(title);
  const menu = document.createElement('p');
  menu.textContent = item.menu;
  content.appendChild(menu);
  // nutrition chips
  const nutriDiv = document.createElement('div');
  Object.entries(item.nutrition).forEach(([k, v]) => {
    nutriDiv.appendChild(createChip(k, v));
  });
  content.appendChild(nutriDiv);
  // status badge
  const badge = document.createElement('span');
  badge.className = `status-badge status-${item.status}`;
  badge.textContent = item.status === 'complete' ? 'Data lengkap' : 'Data belum lengkap';
  content.appendChild(badge);

  card.appendChild(content);

  // click opens modal
  card.addEventListener('click', () => openDetail(item));
  card.addEventListener('keypress', e => {
    if (e.key === 'Enter' || e.key === ' ') openDetail(item);
  });
  return card;
}

function renderResults(data) {
  const container = document.getElementById('results-container');
  container.innerHTML = '';
  if (data.length === 0) {
    container.innerHTML = '<p class="placeholder-text">Tidak ada data yang cocok.</p>';
    return;
  }
  data.forEach(item => container.appendChild(renderCard(item)));
  // trigger lazy load observer
  lazyLoadImages();
}

function filterData() {
  const params = {};
  const query = document.getElementById('search-input').value.trim();
  if (query) params.school = query; // API searches school and region
  const date = document.getElementById('date-filter').value;
  if (date) params.date = date;
  const level = document.getElementById('level-filter').value;
  if (level) params.level = level;
  const region = document.getElementById('region-filter').value;
  if (region) params.region = region;
  loadData(params);
}

// Simple lazy‑load using IntersectionObserver
function lazyLoadImages() {
  const lazyImages = document.querySelectorAll('img.lazy');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          obs.unobserve(img);
        }
      });
    });
    lazyImages.forEach(img => observer.observe(img));
  } else {
    // fallback: load all
    lazyImages.forEach(img => { img.src = img.dataset.src; img.classList.remove('lazy'); });
  }
}

// Modal handling
function openDetail(item) {
  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('modal-body');
  body.innerHTML = '';
  const title = document.createElement('h2');
  title.id = 'modal-title';
  title.textContent = `${item.menu} – ${item.school}`;
  body.appendChild(title);
  const img = document.createElement('img');
  img.alt = `Foto ${item.menu}`;
  img.src = item.photo || 'https://via.placeholder.com/400x200?text=Tidak+Ada+Foto';
  img.style.width = '100%';
  body.appendChild(img);
  const nutrition = document.createElement('div');
  nutrition.innerHTML = '<h3>Informasi Gizi</h3>';
  const ul = document.createElement('ul');
  Object.entries(item.nutrition).forEach(([k, v]) => {
    const li = document.createElement('li');
    li.textContent = `${k}: ${v}`;
    ul.appendChild(li);
  });
  nutrition.appendChild(ul);
  body.appendChild(nutrition);
  const sppg = document.createElement('div');
  sppg.innerHTML = `<h3>SPPG – ${item.sppg.name}</h3><p>${item.sppg.address}<br/>Kontak: ${item.sppg.contact}</p>`;
  body.appendChild(sppg);
  const updated = document.createElement('p');
  updated.textContent = `Terakhir diperbarui: ${formatDate(item.date)}`;
  body.appendChild(updated);

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  // trap focus
  document.body.style.overflow = 'hidden';
  document.querySelector('.modal-close').focus();
}

function closeModal() {
  const modal = document.getElementById('detail-modal');
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Event listeners
document.getElementById('search-btn').addEventListener('click', filterData);
document.getElementById('search-input').addEventListener('keypress', e => { if (e.key === 'Enter') filterData(); });
document.getElementById('date-filter').addEventListener('change', filterData);
document.getElementById('level-filter').addEventListener('change', filterData);
document.getElementById('region-filter').addEventListener('change', filterData);

document.querySelector('.modal-close').addEventListener('click', closeModal);
document.getElementById('detail-modal').addEventListener('click', e => {
  if (e.target.id === 'detail-modal') closeModal();
});

// Geolocation shortcut (if user permits)
if (navigator.geolocation) {
  document.getElementById('geo-btn').addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(pos => {
      // Dummy: just set region based on latitude (demo only)
      const lat = pos.coords.latitude;
      if (lat > -6 && lat < -5) document.getElementById('region-filter').value = 'jawa-bar' /* placeholder */;
      // in real implementation map lat/long to region ID
    }, err => {
      alert('Tidak dapat memperoleh lokasi Anda.');
    });
  });
}

// Initial render placeholder
loadData();

// Set current year in footer
const yearSpan = document.getElementById('year');
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}
