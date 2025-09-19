import joblib
import numpy as np
import pandas as pd
import firebase_admin
from firebase_admin import credentials, db
from datetime import datetime
import time

# -------------------------------
# Load Models (pipelines: scaler + classifier inside)
# -------------------------------
stress_model = joblib.load("model/stress_model.pkl")
hypox_model  = joblib.load("model/hypoxemia_model.pkl")

# Label maps (used if models output integers)
stress_map = {0: "low", 1: "moderate", 2: "high"}
hypox_map  = {0: "normal", 1: "mild", 2: "severe"}

# -------------------------------
# Connect to Firebase
# -------------------------------
cred = credentials.Certificate("hypoxemia-and-stress-monitor-firebase-adminsdk-fbsvc-7833884d8c.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': "https://hypoxemia-and-stress-monitor-default-rtdb.asia-southeast1.firebasedatabase.app"
})

# References
sensor_ref = db.reference("SensorData")        # ESP32 writes here
prediction_ref = db.reference("predictions")   # Python writes here

# -------------------------------
# Poll Loop
# -------------------------------
last_key = None
features = ['RR', 'dev60_HR', 'saturation', 'pi']

while True:
    try:
        # Get last entry from SensorData
        snapshot = sensor_ref.order_by_key().limit_to_last(1).get()

        if snapshot:
            key, data = list(snapshot.items())[0]

            # Process only new data
            if key != last_key:
                last_key = key

                # Convert features safely
                x = pd.DataFrame([{f: float(data.get(f, 0)) for f in features}])

                print(f"Raw data: {data}")
                print(f"Input for prediction:\n{x}")

                hr = x['dev60_HR'].iloc[0]
                spo2 = x['saturation'].iloc[0]

                # --------------------------
                # Handle invalid readings
                # --------------------------
                if hr == 0 or spo2 == 0:
                    stress_pred = "N/A"
                    hypox_pred = "N/A"
                else:
                    # Predictions (pipeline handles scaling)
                    stress_pred_raw = stress_model.predict(x)[0]
                    hypox_pred_raw = hypox_model.predict(x)[0]

                    # Safe mapping depending on output type
                    if isinstance(stress_pred_raw, (int, np.integer)):
                        stress_pred = stress_map.get(stress_pred_raw, stress_pred_raw)
                    else:
                        stress_pred = str(stress_pred_raw)

                    if isinstance(hypox_pred_raw, (int, np.integer)):
                        hypox_pred = hypox_map.get(hypox_pred_raw, hypox_pred_raw)
                    else:
                        hypox_pred = str(hypox_pred_raw)

                # Push prediction to Firebase
                prediction_ref.push({
                    "stress_class": stress_pred,
                    "hypoxemia_class": hypox_pred,
                    "timestamp": datetime.now().isoformat()
                })

                print(f"✅ Predicted -> Stress: {stress_pred} | Hypoxemia: {hypox_pred}")

        time.sleep(1)  # Poll interval (seconds)

    except Exception as e:
        print("❌ Error:", e)
        time.sleep(5)
