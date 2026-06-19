# @obvirm/visual-hear-understanding

Model Context Protocol (MCP) Server untuk analisis tingkat lanjut terhadap media fisik (gambar, video, dan audio) menggunakan Google Gemini API.

## Persyaratan Sistem

- Node.js (versi 18 atau lebih tinggi)
- FFmpeg (opsional, namun diwajibkan untuk mendukung fungsi kompresi gambar/video, pemotongan segmen, dan ekstraksi audio)
- Kunci API Google Gemini

## Konfigurasi Lingkungan

Konfigurasi berikut harus tersedia di dalam file `.env` direktori kerja atau diatur melalui *environment variables*:

- `GEMINI_API_KEY` (Wajib): Kunci autentikasi API dari Google AI Studio.
- `GEMINI_MODEL` (Opsional): Model bawaan yang akan digunakan jika parameter model diabaikan pada permintaan. (Default: `gemini-2.5-pro`).

## Spesifikasi Tool: `analyze_with_gemini`

Tool ini melakukan unggah media lokal ke infrastruktur Gemini untuk proses analitik, lalu menghapusnya secara otomatis dari peladen (server) Google sesaat setelah respons diterima guna menjaga batas kuota penyimpanan 20 GB.

### Parameter Input (Schema)

- **prompt** `[String] (Wajib)`
  Instruksi analitik atau pertanyaan mengenai konten media yang diunggah.
  
- **media_path** `[String] (Opsional)`
  Jalur absolut (*absolute path*) menuju satu file media di media penyimpanan lokal.
  
- **media_paths** `[Array of Strings] (Opsional)`
  Daftar jalur absolut untuk mengunggah dan memproses banyak file secara paralel (analisis perbandingan).
  
- **model** `[String] (Opsional)`
  Parameter pengganti khusus untuk memaksakan model lain pada satu instruksi tanpa merubah lingkungan global (contoh: `gemini-2.5-flash`).
  
- **start_time** `[String] (Opsional)`
  Titik durasi mulai untuk pemotongan segmen lokal. Format diterima: `HH:MM:SS` atau detik bulat (`60`). Membutuhkan instalasi FFmpeg.
  
- **end_time** `[String] (Opsional)`
  Titik durasi akhir untuk pemotongan segmen lokal. Membutuhkan instalasi FFmpeg.
  
- **json_output** `[Boolean] (Opsional)`
  Saat diset `true`, instruksi dipaksa mengembalikan nilai murni terstruktur dalam format JSON dengan mengaktifkan *responseMimeType*.
  
- **audio_only** `[Boolean] (Opsional)`
  Saat diset `true`, membuang jalur visual dari video dan hanya mengekstrak audio (`.mp3`) secara lokal. Secara drastis menghemat waktu unggah untuk keperluan transkripsi. Membutuhkan FFmpeg.
  
- **auto_compress** `[Boolean] (Opsional)`
  Saat diset `true`, mengubah skala resolusi asli pada gambar atau video menjadi lebar maksimum 1920 piksel. Mengoptimalkan batas token pada API tanpa banyak mengorbankan kualitas analitik. Membutuhkan FFmpeg.
  
- **system_instruction** `[String] (Opsional)`
  Memberikan *persona* absolut atau instruksi dasar berskala sistem terhadap AI untuk membatasi ruang lingkup jawaban.
  
- **temperature** `[Number] (Opsional)`
  Skala desimal pengontrol determinisme keluaran (0.0 hingga 2.0).

### Mekanisme Kestabilan (Resilience Features)

- **Blokir Batas Ukuran**: Skrip melakukan validasi sinkron untuk menolak file di atas limit keras 2 GB secara seketika guna mencegah hambatan proses *I/O*.
- **Anti-Rate Limit (Auto-Retry)**: Menangkap respons error `429` pada panggilan kejut dan memberlakukan waktu tunggu (*backoff delay*) 25 detik hingga maksimum tiga kali percobaan sebelum memancarkan error sesungguhnya ke klien.
- **Deteksi Kondisional FFmpeg**: Pengecekan biner `ffmpeg` dilakukan di awal. Fitur manipulasi dimatikan secara mulus dengan peringatan klien tanpa memberhentikan siklus pemrosesan jika modul tidak tersedia.
