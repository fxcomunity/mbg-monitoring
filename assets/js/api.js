/**
 * api.js — BGN Radar MBG API Client Module
 * Mengambil data riil dari database Neon PostgreSQL melalui endpoint API
 */
const BGNApi = (function() {
  'use strict';

  // Base API endpoint URL
  const BASE_URL = window.location.pathname.includes('/features/') 
    ? '../../api.php' 
    : 'api.php';

  /**
   * Mengambil daftar menu hari ini langsung dari database
   */
  async function getMenuHariIni(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const endpoint = query ? `${BASE_URL}?${query}` : BASE_URL;
      const response = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[BGN-API] Gagal memuat data menu:', error);
      return { status: 'error', count: 0, data: [], message: error.message };
    }
  }

  /**
   * Mengambil detail laporan aduan berdasarkan nomor tiket
   */
  async function cekTiketAduan(nomorTiket) {
    try {
      const endpoint = `${BASE_URL}?action=cek_tiket&tiket=${encodeURIComponent(nomorTiket)}`;
      const response = await fetch(endpoint);
      return await response.json();
    } catch (error) {
      console.error('[BGN-API] Gagal melacak tiket aduan:', error);
      return { status: 'error', message: 'Koneksi ke server gagal' };
    }
  }

  return {
    getMenuHariIni,
    cekTiketAduan
  };
})();

window.BGNApi = BGNApi;
