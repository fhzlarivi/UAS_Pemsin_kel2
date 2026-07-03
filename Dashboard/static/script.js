/* ═══════════════════════════════════════════════════
   ACADEMIQ SVM DASHBOARD — script.js
   ═══════════════════════════════════════════════════ */

'use strict';

// ─── PALETTE ────────────────────────────────────────
const C = {
    navy:      '#0D2149',
    navyMid:   '#1A3A6E',
    navyLight: '#2C5F8A',
    gold:      '#D4A017',
    goldLight: '#F5C842',
    red:       '#C0392B',
    green:     '#1E8449',
    border:    '#D6E0F0',
    textLight: '#7A90AA',
};

// ─── STATE ──────────────────────────────────────────
let analyticsData = null;
const chartInstances = {};

// ════════════════════════════════════════════════════
// SIDEBAR NAVIGATION
// ════════════════════════════════════════════════════
const TAB_TITLES = {
    overview:      'Ringkasan Dataset',
    predict:       'Prediksi Status Mahasiswa',
    visualization: 'Visualisasi EDA',
    model:         'Evaluasi Model SVM',
    dataset:       'Preview Dataset',
};

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Switch tab content
        document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
        document.getElementById('tab-' + tab).classList.add('active');

        // Update topbar title
        document.getElementById('topbarTitle').textContent = TAB_TITLES[tab] || tab;

        // Close sidebar on mobile
        if (window.innerWidth <= 900) {
            document.getElementById('sidebar').classList.remove('open');
        }

        // Lazy render charts when tab becomes visible
        if (analyticsData) {
            if (tab === 'visualization') renderVisualizationCharts(analyticsData);
            if (tab === 'model')         renderModelCharts(analyticsData);
            if (tab === 'dataset')       renderDatasetTable();
        }
    });
});

// Sidebar toggle (mobile)
document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ════════════════════════════════════════════════════
// FETCH ANALYTICS DATA ON LOAD
// ════════════════════════════════════════════════════
async function loadAnalytics() {
    showLoading(true);
    try {
        const res  = await fetch('/api/analytics');
        analyticsData = await res.json();

        // Populate KPIs
        const d = analyticsData;
        document.getElementById('totalRows').textContent =
            (d.dataset_info.total_rows).toLocaleString('id-ID');
        document.getElementById('kpiTotal').textContent =
            d.dataset_info.total_rows.toLocaleString('id-ID');
        document.getElementById('kpiGrad').textContent =
            d.dataset_info.graduate_count.toLocaleString('id-ID');
        document.getElementById('kpiDrop').textContent =
            d.dataset_info.dropout_count.toLocaleString('id-ID');
        document.getElementById('kpiAcc').textContent =
            d.accuracy + '%';

        // Render overview charts
        renderPieChart(d);
        renderKernelOverviewChart(d);

    } catch (err) {
        console.error('Failed to load analytics:', err);
        showToast('Gagal memuat data analitik. Pastikan server Flask berjalan.', 'error');
    } finally {
        showLoading(false);
    }
}

// ════════════════════════════════════════════════════
// OVERVIEW CHARTS
// ════════════════════════════════════════════════════
function renderPieChart(d) {
    destroyChart('chartPie');
    const ctx = document.getElementById('chartPie').getContext('2d');
    const labels = Object.keys(d.target_counts);
    const values = Object.values(d.target_counts);
    chartInstances['chartPie'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: [C.red, C.navyLight],
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 10,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { size: 12, weight: '600' },
                        color: C.navy,
                        padding: 16,
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = values.reduce((a,b) => a+b, 0);
                            const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                            return ` ${ctx.label}: ${ctx.parsed.toLocaleString('id-ID')} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderKernelOverviewChart(d) {
    destroyChart('chartKernel');
    const ctx = document.getElementById('chartKernel').getContext('2d');
    chartInstances['chartKernel'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: d.kernels.map(k => k.toUpperCase()),
            datasets: [{
                label: 'Akurasi (%)',
                data: d.kernel_accs,
                backgroundColor: [C.navyLight, C.gold, C.navyMid],
                borderRadius: 7,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: Math.min(...d.kernel_accs) - 3,
                    max: 100,
                    grid: { color: '#EEF2FB' },
                    ticks: { font: { size: 11 }, color: C.textLight, callback: v => v + '%' }
                },
                x: { grid: { display: false }, ticks: { font: { size: 12, weight: '700' }, color: C.navy } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => ` Akurasi: ${ctx.parsed.y}%` }
                },
                datalabels: { display: false }
            }
        }
    });
}

// ════════════════════════════════════════════════════
// VISUALIZATION CHARTS (Tab 3)
// ════════════════════════════════════════════════════
let vizRendered = false;
function renderVisualizationCharts(d) {
    if (vizRendered) return;
    vizRendered = true;

    renderCorrChart(d);
    renderAgeDistChart(d);
    renderGradeDistChart(d);
    renderOutlierChart(d);
    renderScatterChart(d);
}

function renderCorrChart(d) {
    destroyChart('chartCorr');
    const ctx = document.getElementById('chartCorr').getContext('2d');
    const corr = d.correlation;
    const labels = Object.keys(corr);
    const values = Object.values(corr);
    const colors = values.map(v => v >= 0 ? C.navyLight : C.red);
    const bgColors = values.map(v => v >= 0
        ? `rgba(44,95,138,${Math.min(Math.abs(v)+0.2,1)})`
        : `rgba(192,57,43,${Math.min(Math.abs(v)+0.2,1)})`
    );

    chartInstances['chartCorr'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Korelasi dengan Target (Graduate)',
                data: values,
                backgroundColor: bgColors,
                borderColor: colors,
                borderWidth: 1.5,
                borderRadius: 5,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    min: -0.7, max: 0.7,
                    grid: { color: '#EEF2FB' },
                    ticks: { font: { size: 11 }, color: C.textLight },
                    title: { display: true, text: 'Nilai Korelasi', font: { size: 12 }, color: C.textLight }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 11 }, color: C.navy }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const v = ctx.parsed.x;
                            const dir = v > 0 ? 'Positif' : 'Negatif';
                            return ` Korelasi ${dir}: ${v.toFixed(3)}`;
                        }
                    }
                }
            }
        }
    });
}

// Helper: buat histogram bins dari array nilai
function makeHistogram(arr, bins = 15) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const step = (max - min) / bins;
    const labels = [];
    const counts = [];
    for (let i = 0; i < bins; i++) {
        const lo = min + i * step;
        const hi = lo + step;
        labels.push(lo.toFixed(1));
        counts.push(arr.filter(v => v >= lo && v < hi).length);
    }
    return { labels, counts };
}

function renderAgeDistChart(d) {
    destroyChart('chartAge');
    const ctx = document.getElementById('chartAge').getContext('2d');

    // Pakai data scatter_data — perlu ambil dari analytics terpisah
    // Gunakan approx distribusi dari scatter data x (approved) sebagai proxy
    // Sebenarnya kita butuh age data — embed langsung dari server di /api/analytics
    // Untuk ini kita gunakan binning dari data yang ada
    // Karena age tidak ada di scatter_data, kita tampilkan distribusi MK approved sem2
    const scGrad = d.scatter_data.Graduate;
    const scDrop = d.scatter_data.Dropout;

    const binGrad = makeHistogram(scGrad.x, 10);
    const binDrop = makeHistogram(scDrop.x, 10);

    chartInstances['chartAge'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binGrad.labels,
            datasets: [
                {
                    label: 'Graduate',
                    data: binGrad.counts,
                    backgroundColor: 'rgba(44,95,138,0.75)',
                    borderColor: C.navyLight,
                    borderWidth: 1.5,
                    borderRadius: 4,
                },
                {
                    label: 'Dropout',
                    data: binDrop.counts,
                    backgroundColor: 'rgba(192,57,43,0.65)',
                    borderColor: C.red,
                    borderWidth: 1.5,
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 }, color: C.textLight } },
                y: { grid: { color: '#EEF2FB' }, ticks: { font: { size: 11 }, color: C.textLight } }
            },
            plugins: {
                legend: { labels: { font: { size: 11, weight: '600' }, color: C.navy } },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}

function renderGradeDistChart(d) {
    destroyChart('chartGrade');
    const ctx = document.getElementById('chartGrade').getContext('2d');

    const gradVals = d.scatter_data.Graduate.y;
    const dropVals = d.scatter_data.Dropout.y;

    const binGrad = makeHistogram(gradVals, 12);
    const binDrop = makeHistogram(dropVals, 12);

    chartInstances['chartGrade'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binGrad.labels,
            datasets: [
                {
                    label: 'Graduate',
                    data: binGrad.counts,
                    backgroundColor: 'rgba(30,132,73,0.7)',
                    borderColor: C.green,
                    borderWidth: 1.5,
                    borderRadius: 4,
                },
                {
                    label: 'Dropout',
                    data: binDrop.counts,
                    backgroundColor: 'rgba(192,57,43,0.6)',
                    borderColor: C.red,
                    borderWidth: 1.5,
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 }, color: C.textLight } },
                y: { grid: { color: '#EEF2FB' }, ticks: { font: { size: 11 }, color: C.textLight } }
            },
            plugins: {
                legend: { labels: { font: { size: 11, weight: '600' }, color: C.navy } },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}

function renderOutlierChart(d) {
    destroyChart('chartOutlier');
    const ctx = document.getElementById('chartOutlier').getContext('2d');
    const labels = Object.keys(d.outlier_counts);
    const values = Object.values(d.outlier_counts);

    chartInstances['chartOutlier'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Jumlah Outlier (IQR)',
                data: values,
                backgroundColor: values.map(v =>
                    v > 100 ? 'rgba(192,57,43,0.75)'
                  : v > 50  ? 'rgba(212,160,23,0.75)'
                  :           'rgba(44,95,138,0.75)'
                ),
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 12 }, color: C.navy } },
                y: {
                    grid: { color: '#EEF2FB' },
                    ticks: { font: { size: 11 }, color: C.textLight },
                    title: { display: true, text: 'Jumlah Outlier', font: { size: 12 }, color: C.textLight }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} outlier` } }
            }
        }
    });
}

function renderScatterChart(d) {
    destroyChart('chartScatter');
    const ctx = document.getElementById('chartScatter').getContext('2d');
    const scGrad = d.scatter_data.Graduate;
    const scDrop = d.scatter_data.Dropout;

    const toPoints = (xArr, yArr) => xArr.map((x, i) => ({ x, y: yArr[i] }));

    chartInstances['chartScatter'] = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Graduate',
                    data: toPoints(scGrad.x, scGrad.y),
                    backgroundColor: 'rgba(44,95,138,0.45)',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
                {
                    label: 'Dropout',
                    data: toPoints(scDrop.x, scDrop.y),
                    backgroundColor: 'rgba(192,57,43,0.45)',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: '#EEF2FB' },
                    title: { display: true, text: 'MK Lulus Sem 2 (Approved)', font: { size: 12 }, color: C.textLight },
                    ticks: { font: { size: 11 }, color: C.textLight }
                },
                y: {
                    grid: { color: '#EEF2FB' },
                    title: { display: true, text: 'Nilai Rata-rata Sem 2 (Grade)', font: { size: 12 }, color: C.textLight },
                    ticks: { font: { size: 11 }, color: C.textLight }
                }
            },
            plugins: {
                legend: {
                    labels: { font: { size: 12, weight: '600' }, color: C.navy, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label} — Lulus: ${ctx.parsed.x}, Nilai: ${ctx.parsed.y.toFixed(2)}`
                    }
                }
            }
        }
    });
}

// ════════════════════════════════════════════════════
// MODEL EVALUATION CHARTS (Tab 4)
// ════════════════════════════════════════════════════
let modelRendered = false;
function renderModelCharts(d) {
    if (modelRendered) return;
    modelRendered = true;

    renderMetricCards(d);
    renderConfusionMatrix(d);
    renderClassReportChart(d);
    renderKernelModelChart(d);
}

function renderMetricCards(d) {
    const grid = document.getElementById('metricGrid');
    const report = d.report;
    const classes = Object.keys(report);

    // Build metric array
    const metrics = [
        { name: 'Akurasi Model', value: d.accuracy + '%', sub: 'Overall accuracy' },
        ...classes.flatMap(cls => [
            { name: `Precision (${cls})`, value: (report[cls].precision * 100).toFixed(1) + '%', sub: cls },
            { name: `Recall (${cls})`,    value: (report[cls].recall    * 100).toFixed(1) + '%', sub: cls },
            { name: `F1-Score (${cls})`,  value: (report[cls].f1        * 100).toFixed(1) + '%', sub: cls },
        ])
    ];

    grid.innerHTML = metrics.map(m => `
        <div class="metric-card">
            <div class="metric-name">${m.name}</div>
            <div class="metric-value">${m.value}</div>
            <div class="metric-sub">${m.sub}</div>
        </div>
    `).join('');
}

function renderConfusionMatrix(d) {
    const cm = d.confusion_matrix;
    // cm = [[TN, FP], [FN, TP]]  (Dropout=0, Graduate=1)
    const TN = cm[0][0], FP = cm[0][1];
    const FN = cm[1][0], TP = cm[1][1];

    const container = document.getElementById('cmContainer');
    container.innerHTML = `
        <table class="cm-table">
            <tr>
                <td class="cm-label"></td>
                <td class="cm-label">Pred: Dropout</td>
                <td class="cm-label">Pred: Graduate</td>
            </tr>
            <tr>
                <td class="cm-label">Act: Dropout</td>
                <td class="cm-tn">${TN}<span class="cm-sub">True Negative</span></td>
                <td class="cm-fp">${FP}<span class="cm-sub">False Positive</span></td>
            </tr>
            <tr>
                <td class="cm-label">Act: Graduate</td>
                <td class="cm-fn">${FN}<span class="cm-sub">False Negative</span></td>
                <td class="cm-tp">${TP}<span class="cm-sub">True Positive</span></td>
            </tr>
        </table>
        <div class="cm-legend">
            <span><i class="dot" style="background:#1E5631"></i> True Positive (Benar Graduate)</span>
            <span><i class="dot" style="background:#1A3A6E"></i> True Negative (Benar Dropout)</span>
            <span><i class="dot" style="background:#FDECEA;border:1.5px solid #f5c6c2"></i> False Positive</span>
            <span><i class="dot" style="background:#FEF9E7;border:1.5px solid #FAE48A"></i> False Negative</span>
        </div>
    `;
}

function renderClassReportChart(d) {
    destroyChart('chartReport');
    const ctx = document.getElementById('chartReport').getContext('2d');
    const report = d.report;
    const classes = Object.keys(report);
    const metrics = ['precision', 'recall', 'f1'];
    const metricLabels = ['Precision', 'Recall', 'F1-Score'];
    const clsColors = [
        { bg: 'rgba(44,95,138,0.8)',  border: C.navyLight },
        { bg: 'rgba(192,57,43,0.8)', border: C.red },
    ];

    chartInstances['chartReport'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: metricLabels,
            datasets: classes.map((cls, i) => ({
                label: cls,
                data: metrics.map(m => parseFloat((report[cls][m] * 100).toFixed(2))),
                backgroundColor: clsColors[i].bg,
                borderColor: clsColors[i].border,
                borderWidth: 1.5,
                borderRadius: 5,
                borderSkipped: false,
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 70, max: 100,
                    grid: { color: '#EEF2FB' },
                    ticks: { font: { size: 11 }, color: C.textLight, callback: v => v + '%' }
                },
                x: { grid: { display: false }, ticks: { font: { size: 12, weight: '600' }, color: C.navy } }
            },
            plugins: {
                legend: {
                    labels: { font: { size: 12, weight: '600' }, color: C.navy }
                },
                tooltip: {
                    callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` }
                }
            }
        }
    });
}

function renderKernelModelChart(d) {
    destroyChart('chartKernelModel');
    const ctx = document.getElementById('chartKernelModel').getContext('2d');
    const best = Math.max(...d.kernel_accs);

    chartInstances['chartKernelModel'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: d.kernels.map(k => k.toUpperCase()),
            datasets: [{
                label: 'Akurasi (%)',
                data: d.kernel_accs,
                backgroundColor: d.kernel_accs.map(a =>
                    a === best ? C.gold : 'rgba(44,95,138,0.7)'
                ),
                borderColor: d.kernel_accs.map(a =>
                    a === best ? '#B8860B' : C.navyMid
                ),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: Math.min(...d.kernel_accs) - 3,
                    max: 100,
                    grid: { color: '#EEF2FB' },
                    ticks: { font: { size: 12 }, color: C.textLight, callback: v => v + '%' },
                    title: { display: true, text: 'Akurasi (%)', font: { size: 12 }, color: C.textLight }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 14, weight: '700' }, color: C.navy }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const isBest = ctx.parsed.y === best;
                            return ` Akurasi: ${ctx.parsed.y}%${isBest ? '  ← Terbaik' : ''}`;
                        }
                    }
                }
            }
        }
    });
}

// ════════════════════════════════════════════════════
// DATASET TABLE (Tab 5)
// ════════════════════════════════════════════════════
let datasetRendered = false;
async function renderDatasetTable() {
    if (datasetRendered) return;
    datasetRendered = true;

    try {
        const res  = await fetch('/api/dataset-sample');
        const rows = await res.json();
        if (!rows.length) return;

        const keys = Object.keys(rows[0]);
        const thead = document.getElementById('dataTableHead');
        const tbody = document.getElementById('dataTableBody');

        thead.innerHTML = `<tr>${keys.map(k => `<th>${k}</th>`).join('')}</tr>`;
        tbody.innerHTML = rows.map(row => `
            <tr>
                ${keys.map(k => {
                    if (k === 'Target') {
                        const cls = row[k] === 'Graduate' ? 'badge-grad' : 'badge-drop';
                        return `<td><span class="${cls}">${row[k]}</span></td>`;
                    }
                    const v = typeof row[k] === 'number' ? row[k].toLocaleString('id-ID') : row[k];
                    return `<td>${v}</td>`;
                }).join('')}
            </tr>
        `).join('');

        const di = analyticsData?.dataset_info;
        if (di) {
            document.getElementById('datasetMeta').innerHTML = `
                <strong><i class="fa-solid fa-circle-info" style="color:var(--navyLight)"></i> Informasi Dataset</strong><br>
                Total baris: <strong>${di.total_rows.toLocaleString('id-ID')}</strong> &nbsp;|&nbsp;
                Total kolom: <strong>${di.total_cols}</strong> &nbsp;|&nbsp;
                Graduate: <strong>${di.graduate_count.toLocaleString('id-ID')}</strong> &nbsp;|&nbsp;
                Dropout: <strong>${di.dropout_count.toLocaleString('id-ID')}</strong><br>
                Sumber: <em>Predict Students' Dropout and Academic Success — UCI / Kaggle</em><br>
                Preprocessing: Missing value diimputasi dengan median, label <em>Enrolled</em> digabung ke <em>Dropout</em>.
                16 fitur dipilih dari total 37 kolom untuk training model SVM.
            `;
        }
    } catch (err) {
        console.error('Dataset load error:', err);
    }
}

// ════════════════════════════════════════════════════
// PREDICTION FORM
// ════════════════════════════════════════════════════
document.getElementById('predictionForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const btn = document.getElementById('btnPredict');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses...';

    const formData = new FormData(this);
    const payload  = {};
    formData.forEach((val, key) => { payload[key] = val; });

    try {
        const res    = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.status === 'success') {
            showPredictionResult(result.prediction);
        } else {
            showToast('Error: ' + result.message, 'error');
        }
    } catch (err) {
        showToast('Gagal terhubung ke server Flask!', 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Mulai Prediksi';
    }
});

function showPredictionResult(label) {
    const box   = document.getElementById('resultBox');
    const icon  = document.getElementById('resultIcon');
    const lbl   = document.getElementById('resultLabel');
    const desc  = document.getElementById('resultDesc');

    box.classList.remove('hidden');

    if (label === 'Graduate') {
        icon.innerHTML = '<i class="fa-solid fa-user-graduate" style="color:#F5C842"></i>';
        lbl.textContent = 'GRADUATE';
        desc.textContent = 'Mahasiswa ini diprediksi akan LULUS tepat waktu berdasarkan data yang dimasukkan.';
    } else {
        icon.innerHTML = '<i class="fa-solid fa-user-xmark" style="color:#E74C3C"></i>';
        lbl.textContent = 'DROPOUT';
        desc.textContent = 'Mahasiswa ini diprediksi berisiko DROPOUT. Diperlukan perhatian dan intervensi lebih lanjut.';
    }

    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('resultBox').classList.add('hidden');
});

// ════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════
function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function showLoading(show) {
    document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

function showToast(msg, type = 'info') {
    // Simple alert fallback
    alert(msg);
}

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', loadAnalytics);
