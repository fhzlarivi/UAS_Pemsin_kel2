from flask import Flask, request, jsonify, render_template
import joblib
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
import warnings
import os

warnings.filterwarnings('ignore')

app = Flask(__name__)

# ─── Load model artifacts ───────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model  = joblib.load(os.path.join(BASE_DIR, 'svm_model.pkl'))
scaler = joblib.load(os.path.join(BASE_DIR, 'scaler.pkl'))
le     = joblib.load(os.path.join(BASE_DIR, 'label_encoder.pkl'))

# ─── 16 fitur yang digunakan model ──────────────────────────────────────────
FEATURE_NAMES = [
    'Marital status', 'Age at enrollment', 'Gender',
    'Admission grade', 'Scholarship holder', 'Debtor',
    'Tuition fees up to date',
    'Curricular units 1st sem (enrolled)',
    'Curricular units 1st sem (approved)',
    'Curricular units 1st sem (grade)',
    'Curricular units 2nd sem (enrolled)',
    'Curricular units 2nd sem (approved)',
    'Curricular units 2nd sem (grade)',
    'Unemployment rate', 'Inflation rate', 'GDP'
]

# ─── Load & preprocess dataset sekali saat startup ─────────────────────────
def load_dataset():
    csv_path = os.path.join(BASE_DIR, 'Predict_Students__Dropout_and_Academic_Success.csv')
    df = pd.read_csv(csv_path, sep=';')

    # Inject & impute missing values (replikasi notebook)
    np.random.seed(99)
    kolom_inject = {
        'Admission grade': 80, 'Age at enrollment': 60,
        'Curricular units 1st sem (grade)': 70,
        'Curricular units 2nd sem (grade)': 65,
        'Unemployment rate': 50, 'GDP': 45,
    }
    for col, n in kolom_inject.items():
        idx = np.random.choice(df.index, size=n, replace=False)
        df.loc[idx, col] = np.nan
    for col in kolom_inject.keys():
        df[col] = df[col].fillna(df[col].median())

    # Gabung Enrolled → Dropout (2 kelas)
    df['Target'] = df['Target'].replace({'Enrolled': 'Dropout'})
    return df

df_global = load_dataset()

# ─── Hitung statistik untuk visualisasi ────────────────────────────────────
def compute_analytics():
    df = df_global.copy()

    # 1. Distribusi kelas
    target_counts = df['Target'].value_counts().to_dict()

    # 2. Correlation dengan Target
    df_corr = df.copy()
    df_corr['Target_encoded'] = (df_corr['Target'] == 'Graduate').astype(int)
    corr = df_corr[FEATURE_NAMES + ['Target_encoded']].corr()['Target_encoded'].drop('Target_encoded')
    correlation = corr.round(3).to_dict()

    # 3. Statistik deskriptif dataset
    desc = df[FEATURE_NAMES].describe().round(2).to_dict()

    # 4. Perbandingan distribusi fitur numerik per kelas
    age_grad = df[df['Target'] == 'Graduate']['Age at enrollment'].tolist()
    age_drop = df[df['Target'] == 'Dropout']['Age at enrollment'].tolist()
    grade_grad = df[df['Target'] == 'Graduate']['Curricular units 2nd sem (grade)'].tolist()
    grade_drop = df[df['Target'] == 'Dropout']['Curricular units 2nd sem (grade)'].tolist()

    # 5. Model performance (dari pkl)
    X = df[FEATURE_NAMES]
    y_raw = df['Target']
    le_local = LabelEncoder()
    y = le_local.fit_transform(y_raw)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)
    sc_local = StandardScaler()
    X_train_s = sc_local.fit_transform(X_train)
    X_test_s  = sc_local.transform(X_test)

    # Default model (rbf)
    m_rbf = SVC(kernel='rbf', random_state=0)
    m_rbf.fit(X_train_s, y_train)
    pred_rbf = m_rbf.predict(X_test_s)

    cm = confusion_matrix(y_test, pred_rbf).tolist()
    acc = round(accuracy_score(y_test, pred_rbf) * 100, 2)
    report = classification_report(y_test, pred_rbf, target_names=le_local.classes_, output_dict=True)

    # 6. Kernel comparison
    kernels = ['linear', 'rbf', 'poly']
    kernel_accs = []
    for k in kernels:
        m = SVC(kernel=k, random_state=0)
        m.fit(X_train_s, y_train)
        a = round(accuracy_score(y_test, m.predict(X_test_s)) * 100, 2)
        kernel_accs.append(a)

    # 7. Outlier counts (IQR)
    outlier_cols = [
        'Admission grade', 'Age at enrollment',
        'Curricular units 1st sem (grade)',
        'Curricular units 2nd sem (grade)',
        'Unemployment rate', 'GDP'
    ]
    outlier_counts = {}
    for col in outlier_cols:
        Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        IQR = Q3 - Q1
        n = int(((df[col] < Q1 - 1.5*IQR) | (df[col] > Q3 + 1.5*IQR)).sum())
        outlier_counts[col] = n

    # 8. Boxplot data per fitur
    boxplot_data = {}
    for col in outlier_cols:
        vals = df[col].dropna().tolist()
        Q1, Q3 = float(np.percentile(vals, 25)), float(np.percentile(vals, 75))
        med    = float(np.median(vals))
        IQR    = Q3 - Q1
        w_low  = float(max(min(vals), Q1 - 1.5*IQR))
        w_high = float(min(max(vals), Q3 + 1.5*IQR))
        outliers = [v for v in vals if v < w_low or v > w_high]
        boxplot_data[col] = {
            'q1': Q1, 'median': med, 'q3': Q3,
            'whisker_low': w_low, 'whisker_high': w_high,
            'outliers': outliers[:50]  # Batasi 50 outlier untuk performa
        }

    # 9. Scatter: 2nd sem grade vs approved (per kelas)
    scatter_data = {
        'Graduate': {
            'x': df[df['Target']=='Graduate']['Curricular units 2nd sem (approved)'].tolist()[:300],
            'y': df[df['Target']=='Graduate']['Curricular units 2nd sem (grade)'].tolist()[:300],
        },
        'Dropout': {
            'x': df[df['Target']=='Dropout']['Curricular units 2nd sem (approved)'].tolist()[:300],
            'y': df[df['Target']=='Dropout']['Curricular units 2nd sem (grade)'].tolist()[:300],
        }
    }

    # 10. Ringkasan dataset
    dataset_info = {
        'total_rows': int(df.shape[0]),
        'total_cols': int(df.shape[1]),
        'graduate_count': int(target_counts.get('Graduate', 0)),
        'dropout_count': int(target_counts.get('Dropout', 0)),
    }

    # Ringkasan classification report
    report_summary = {
        cls: {
            'precision': round(report[cls]['precision'], 4),
            'recall':    round(report[cls]['recall'], 4),
            'f1':        round(report[cls]['f1-score'], 4),
            'support':   int(report[cls]['support'])
        }
        for cls in le_local.classes_
    }

    return {
        'target_counts': target_counts,
        'correlation': correlation,
        'accuracy': acc,
        'confusion_matrix': cm,
        'report': report_summary,
        'kernel_accs': kernel_accs,
        'kernels': kernels,
        'outlier_counts': outlier_counts,
        'boxplot_data': boxplot_data,
        'scatter_data': scatter_data,
        'dataset_info': dataset_info,
    }

# Pre-compute sekali
analytics_cache = compute_analytics()

# ─── Routes ─────────────────────────────────────────────────────────────────

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/analytics')
def get_analytics():
    return jsonify(analytics_cache)

@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        input_data = [float(data.get(f, 0)) for f in FEATURE_NAMES]
        input_df   = pd.DataFrame([input_data], columns=FEATURE_NAMES)
        scaled     = scaler.transform(input_df)
        prediction = model.predict(scaled)
        label      = le.inverse_transform(prediction)[0]
        return jsonify({'status': 'success', 'prediction': label})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/dataset-sample')
def dataset_sample():
    """Return sample rows dari dataset"""
    sample = df_global[FEATURE_NAMES + ['Target']].head(10).to_dict(orient='records')
    return jsonify(sample)

if __name__ == '__main__':
    app.run(debug=True)
