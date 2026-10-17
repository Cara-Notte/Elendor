# 🎮 Elendor - Game Sejarah Indonesia

Selamat datang di Elendor, sebuah game RPG edukasi yang mengajak pemain menjelajahi sejarah kerajaan-kerajaan di Indonesia melalui petualangan yang menarik!

## 📋 Daftar Isi
- Tentang Game
- Cara Menjalankan Game
- Tutorial
- Kontrol Game
- Fitur Game
- Sistem Quest
- Save & Load
- Cheat Code

## 🎯 Tentang Game
Elendor adalah game RPG berbasis web yang menggabungkan unsur pembelajaran sejarah Indonesia dengan gameplay yang menarik. Pemain akan menjelajahi 8 lokasi berbeda yang masing-masing mewakili kerajaan bersejarah di Indonesia.

### Kerajaan yang Dapat Dijelajahi:
1. Majapahit
2. Kutai
3. Sriwijaya
4. Mataram Kuno
5. Samudra Pasai
6. Demak
7. Mataram Islam
8. Gowa-Tallo

## 💻 Cara Menjalankan Game

### Persyaratan Sistem
- Node.js (versi 14.0.0 atau lebih baru)
- NPM (Node Package Manager)
- Browser modern (Chrome, Firefox, Edge, dll)

### Langkah Instalasi
1. Clone repository ini:
   ```bash
   git clone [URL_REPOSITORY]
   ```

2. Masuk ke direktori game:
   ```bash
   cd Elendor-v1.0.0
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Jalankan game dalam mode development:
   ```bash
   npm run dev
   ```

5. Buka browser dan akses:
   ```
   http://localhost:3000
   ```

## 📖 Tutorial

### Memulai Game
1. Pilih karakter di menu utama
2. Baca introduction story
3. Mulai petualangan di dunia Elendor

### Basic Rules
- Setiap lokasi memiliki 5 wave quest
- Jawab pertanyaan dengan benar untuk mendapatkan gold dan relic
- Jaga HP agar tidak habis
- Kumpulkan 8 relic untuk menyelesaikan game

## 🎮 Kontrol Game

### Keyboard
- WASD / Arrow Keys: Gerakan karakter
- E: Interaksi
- I: Buka/tutup inventory
- T: Buka/tutup stats
- M: Buka/tutup map
- R: Toggle run
- P: Pause game
- ESC: Pause/Resume game

### Mouse/Touch
- Klik pada tombol di interface
- D-Pad virtual untuk movement di perangkat mobile
- Tap untuk interaksi di perangkat mobile

## 🌟 Fitur Game

### Karakter
- HP dan MP system
- Inventory management
- Equipment system
- Stats dan level up

### World
- 8 lokasi unik
- Day/Night cycle
- NPC interaktif
- Quest system

### Quest & Rewards
- Gold rewards: 100-300 per quest
- Damage penalty: 5-25 HP untuk jawaban salah
- Relic reward setelah menyelesaikan 5 wave
- Special interaction di Elven Kingdom

## 📜 Sistem Quest
- Setiap lokasi memiliki 5 wave quest
- Pertanyaan seputar sejarah kerajaan
- Tingkat kesulitan meningkat setiap wave
- Reward meningkat sesuai kesulitan

## 💾 Save & Load
1. Tekan ESC untuk membuka menu pause
2. Pilih "Save/Load Game"
3. Pilih opsi:
   - Save Game: Simpan progress
   - Load Game: Muat save terakhir
   - Delete Save: Hapus save file

## 🎯 Cheat Code
- Tekan 'P' untuk mendapatkan semua relic secara instan
- Gunakan dengan bijak karena akan mengurangi pengalaman bermain

## 🏆 Game Completion
- Kumpulkan 8 relic dari semua kerajaan
- Selesaikan semua quest di setiap lokasi
- Buka special ending di Elven Kingdom
- Lihat statistik perjalanan di completion screen

## 🛠️ Troubleshooting
Jika mengalami masalah:
1. Pastikan semua dependencies terinstall
2. Clear browser cache
3. Restart game
4. Periksa console untuk error message

## 📝 Catatan
- Game ini dibuat untuk tujuan edukasi
- Semua konten sejarah berdasarkan fakta
- Feedback dan saran sangat diapresiasi

Selamat bermain dan belajar sejarah Indonesia! 🎮📚

## ⚔️ Pertempuran Turn-Based

Klik **Battle** di bagian atas layar, atau **Battle nearby enemies** saat mengunjungi lokasi. Pilih Roadside Raider, Ruin Sentinel, atau boss Ashen Warlord. Pertempuran memakai sprite dan latar asli game; eksplorasi berhenti selama bertarung.

- **Strike** memakai damage karakter dan senjata. Defense mengurangi damage sebagai persentase (maksimal 80%). Speed menentukan siapa yang mendapat giliran pertama.
- **Skill** memakai 20 stamina: Mage menembus defense dengan Arcane Burst, Mercenary memakai Cleave, Ranger memakai Twin Shot, dan Soldier memakai Shield Bash sambil berlindung.
- **Guard** mengurangi serangan berikutnya menjadi separuh dan memulihkan 15 stamina. Perhatikan isyarat **Heavy strike** setiap serangan musuh ketiga.
- **Recover** memakai 12 stamina untuk memulihkan 22% HP maksimal. **Retreat** menerima satu serangan terakhir sebelum melarikan diri.
- Menang memberi gold dan XP. Setiap 100 XP meningkatkan battle rank dan kekuatan encounter, hingga rank 10. Kekalahan memulihkan 30% HP dan mengurangi 10% gold yang dibawa; tidak ada hadiah saat kabur atau kalah.
- HP, stamina, equipment, gold, XP, dan jumlah kemenangan disimpan melalui **Pause → Save/Load Game → Save Game**. Save lama tetap dapat dimuat. Bonus makanan sementara berakhir saat memuat save. Istirahat di lodge memulihkan HP dan stamina sebelum pertarungan berikutnya.

Verifikasi combat: `npm run test:battle` dan `npm run test:battle:browser`. Browser test memakai Chromium Playwright; jika memakai Chromium sistem, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Pengujian browser mencakup pertarungan, hasil, save/load, dan layout layar kecil.

Group members: <br/>
• Pierre E.S Moningka - 00000128411  <br/>
• Tito Shafy - 00000127746 <br/>
• Muhamad Altha Rasjid - 00000136220 <br/>
• Dylan Wilson - 00000134282 <br/>
• Andy Edlynson Kadiran - 00000115200 <br/>

https://github.com/totibakar/elendor
