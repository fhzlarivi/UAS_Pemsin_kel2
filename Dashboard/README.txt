═══════════════════════════════════════════════
  ACADEMIQ — Dashboard SVM Prediksi Mahasiswa
  Kelompok 2 | Machine Learning | IT PLN
═══════════════════════════════════════════════

STRUKTUR FOLDER:
  dashboard_svm/
  ├── app.py                          ← Backend Flask (jalankan ini)
  ├── requirements.txt                ← Library yang dibutuhkan
  ├── svm_model.pkl                   ← Model SVM terlatih
  ├── scaler.pkl                      ← StandardScaler
  ├── label_encoder.pkl               ← Label Encoder
  ├── Predict_Students__Dropout...csv ← Dataset
  ├── templates/
  │   └── index.html
  └── static/
      ├── style.css
      └── script.js

LANGKAH INSTALASI & MENJALANKAN:

1. Pastikan Python 3.8+ sudah terinstall.

2. Buka terminal/cmd di dalam folder dashboard_svm/

3. (Opsional tapi disarankan) Buat virtual environment:
      python -m venv venv
      venv\Scripts\activate        (Windows)
      source venv/bin/activate     (Mac/Linux)

4. Install semua library:
      pip install -r requirements.txt

5. Jalankan server Flask:
      python app.py

6. Buka browser dan akses:
      http://127.0.0.1:5000

FITUR DASHBOARD:
  Tab 1 - Ringkasan   : KPI cards, distribusi kelas, akurasi kernel
  Tab 2 - Prediksi    : Form input 16 fitur → prediksi Graduate/Dropout
  Tab 3 - Visualisasi : Korelasi fitur, distribusi, outlier IQR, scatter plot
  Tab 4 - Evaluasi    : Confusion matrix, classification report, kernel comparison
  Tab 5 - Dataset     : Preview 10 baris pertama dataset

CATATAN:
  - File .pkl dan .csv HARUS berada di folder yang sama dengan app.py
  - Port default Flask: 5000
  - Jika port 5000 sudah dipakai, ubah di baris terakhir app.py:
      app.run(debug=True, port=5001)
