package id.go.bgn.radarmbg.data.api.models

data class AuthResponse(
    val logged_in: Boolean = false,
    val user: UserData? = null,
    val status: String? = null,
    val message: String? = null
)

data class UserData(
    val id: Int? = null,
    val username: String = "",
    val full_name: String = "",
    val role: String = "",
    val role_label: String = "",
    val sppg_name: String = "",
    val avatar: String? = null
)

data class TelemetriWrapper(
    val status: String = "",
    val data: TelemetriData = TelemetriData()
)

data class TelemetriData(
    val porsi_tersalurkan: Long = 0,
    val persen_target: Double = 0.0,
    val sppg_aktif: Int = 0,
    val sekolah_terlayani: Int = 0,
    val kepatuhan_akg: Double = 0.0,
    val suhu_rata_rata: Double = 0.0,
    val sla_distribusi: Double = 0.0,
    val pembaruan_teks: String = ""
)

data class DistribusiWrapper(
    val status: String = "",
    val data: List<ProvinsiData> = emptyList()
)

data class ProvinsiData(
    val provinsi: String = "",
    val target_porsi: Long = 0,
    val ketepatan: Double = 0.0,
    val status: String = "",
    val region_code: String = ""
)

data class MenuWrapper(
    val status: String = "",
    val date: String = "",
    val data: List<MenuData> = emptyList()
)

data class MenuData(
    val id: Int? = null,
    val sppg_name: String = "",
    val school_target: String = "",
    val city: String = "",
    val menu_title: String = "",
    val menu_date: String = "",
    val protein_g: Double? = null,
    val karbohidrat_g: Double? = null,
    val lemak_g: Double? = null,
    val kalori_kkal: Int? = null,
    val catatan: String? = null
)

data class NotifikasiData(
    val id: Int? = null,
    val badge_count: Int = 0,
    val laporan_masuk_count: Int = 0,
    val latest_reports: List<LaporanReport> = emptyList()
)

data class LaporanReport(
    val id: Int? = null,
    val ticket_code: String = "",
    val reporter_name: String = "",
    val school_target: String = "",
    val issue_category: String = "",
    val status: String = "",
    val created_at: String = ""
)

data class TiketWrapper(
    val status: String = "",
    val data: TiketData? = null,
    val message: String? = null
)

data class TiketData(
    val nomor_tiket: String = "",
    val kategori: String = "",
    val target_sekolah: String = "",
    val status: String = "",
    val priority: String = "",
    val tanggal_lapor: String = "",
    val nama_pelapor: String = "",
    val deskripsi: String = "",
    val catatan_satgas: String = ""
)

data class ChatResponse(
    val status: String = "",
    val reply: String = "",
    val session_id: String = ""
)

data class SppgData(
    val id: Long = 0,
    val nama: String = "",
    val provinsi: String = "",
    val kabupaten_kota: String? = null,
    val kecamatan: String? = null,
    val kelurahan_desa: String? = null,
    val alamat: String? = null,
    val nama_yayasan: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val status: String = "operasional",
    val data_bulan: String? = null
)

data class SppgWrapper(
    val status: String = "",
    val data: List<SppgData> = emptyList(),
    val total: Int = 0
)
