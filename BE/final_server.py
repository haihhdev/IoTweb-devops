#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FULL Smart Home Flask server (multi MQTT broker, hoàn chỉnh)
"""

import os
import traceback
import logging
import threading
import time
import requests
from flask import Flask, request, jsonify
from deepface import DeepFace
import joblib
import paho.mqtt.client as mqtt
import ssl
import wikipedia
import feedparser
import re
from datetime import datetime, timedelta
import pytz
from sympy import sympify
import dateparser
import cv2
import numpy as np
import mediapipe as mp

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
wikipedia.set_lang("vi")

app = Flask(__name__)

# === Firebase config ===
FIREBASE_DB_URL = "https://iot-frontend-web-default-rtdb.firebaseio.com"
POLL_INTERVAL   = 5  # giây

# === Telegram config ===
TELEGRAM_TOKEN = "7695652236:AAG35BaannGuCSzrqLGjMp6Nt6EBgBI5g3g"
TELEGRAM_CHAT_ID = "5788605495"

# Global device state
light1State = False
light2State = False
doorState   = False
fanState    = False

# ========== MQTT topic mapping ==========
WEMOS1_TOPIC = "home/cuaquat"  # Cửa, quạt
WEMOS2_TOPIC = "home/den"      # Đèn, cảm biến, cháy

# ======= MQTT MULTI-CLIENT CONFIG =======
# Broker 1: cửa, quạt
mqtt_broker1 = "3663b8f8294b4aa8acb3475e026adf3b.s1.eu.hivemq.cloud"
mqtt_port1   = 8883
mqtt_user1   = "iot_home"
mqtt_pass1   = "Tngan1724"

# Broker 2: đèn
mqtt_broker2 = "2571594adf7e48da9ee3958d605824ec.s1.eu.hivemq.cloud"
mqtt_port2   = 8883
mqtt_user2   = "haichu"
mqtt_pass2   = "H@ichu321"

mqtt_client1 = mqtt.Client()
mqtt_client1.username_pw_set(mqtt_user1, mqtt_pass1)
mqtt_client1.tls_set(cert_reqs=ssl.CERT_REQUIRED)
mqtt_client1.connect(mqtt_broker1, mqtt_port1)
mqtt_client1.loop_start()

mqtt_client2 = mqtt.Client()
mqtt_client2.username_pw_set(mqtt_user2, mqtt_pass2)
mqtt_client2.tls_set(cert_reqs=ssl.CERT_REQUIRED)
mqtt_client2.connect(mqtt_broker2, mqtt_port2)
mqtt_client2.loop_start()

def get_mqtt_client_for_command(cmd):
    if cmd in ["Mo_cua", "Dong_cua", "Bat_quat", "Tat_quat"]:
        return mqtt_client1, WEMOS1_TOPIC
    else:
        return mqtt_client2, WEMOS2_TOPIC

def fetch_firebase_state(key: str):
    try:
        r = requests.get(f"{FIREBASE_DB_URL}/{key}.json", timeout=5)
        if r.ok:
            return r.json()
    except Exception as e:
        logging.error(f"Firebase fetch {key} error: {e}")
    return None

def update_firebase_state(key: str, value):
    try:
        r = requests.put(f"{FIREBASE_DB_URL}/{key}.json", json=value, timeout=5)
        if not r.ok:
            logging.error(f"Failed to update Firebase {key}: {r.text}")
    except Exception as e:
        logging.error(f"Firebase update {key} error: {e}")

state_to_mcmd = {
    'doorState':   ('Mo_cua',    'Dong_cua'),
    'light1State': ('Bat_den_pk','Tat_den_pk'),
    'light2State': ('Bat_den_nb','Tat_den_nb'),
    'fanState':    ('Bat_quat',  'Tat_quat'),
}

def firebase_listener():
    global light1State, light2State, doorState, fanState
    prev = {}
    keys = ['light1State','light2State','doorState','fanState']
    for k in keys:
        v = fetch_firebase_state(k)
        if v is None: v = False
        prev[k] = v
        if k == 'light1State':   light1State = v
        if k == 'light2State':   light2State = v
        if k == 'doorState':     doorState   = v
        if k == 'fanState':      fanState    = v
        logging.info(f"Initial {k}: {v}")
    while True:
        for k in keys:
            v = fetch_firebase_state(k)
            if v is None: v = False
            if v != prev[k]:
                logging.info(f"{k} changed: {prev[k]} -> {v}")
                prev[k] = v
                if k == 'light1State': light1State = v
                if k == 'light2State': light2State = v
                if k == 'doorState':   doorState   = v
                if k == 'fanState':    fanState    = v
                if k in state_to_mcmd:
                    mtrue, mfalse = state_to_mcmd[k]
                    cmd = mtrue if v else mfalse
                    client, topic = get_mqtt_client_for_command(cmd)
                    for i in range(2):
                        client.publish(topic, cmd)
                        time.sleep(0.1)
                    logging.info(f"Auto-published → {topic} ({client._client_id.decode()}): {cmd}")
        time.sleep(POLL_INTERVAL)

threading.Thread(target=firebase_listener, daemon=True).start()

# === Face Recognition ===
DB_PATH    = "database"
MODEL_NAME = "Facenet512"

AUTHEN_TIMEOUT = 12
_authenticated = {"person": None, "last_frame": 0}

def set_authenticated(person):
    _authenticated["person"] = person
    _authenticated["last_frame"] = time.time()

def clear_authenticated():
    _authenticated["person"] = None
    _authenticated["last_frame"] = 0

def get_authenticated():
    if _authenticated["person"]:
        return _authenticated["person"]
    return None

@app.route('/recognize', methods=['POST'])
def recognize():
    try:
        if 'file' not in request.files:
            return jsonify({"error":"No file provided"}), 400
        f = request.files['file']
        tmp = "input.jpg"
        f.save(tmp)
        df = DeepFace.find(img_path=tmp, db_path=DB_PATH,
                           model_name=MODEL_NAME, enforce_detection=True)
        os.remove(tmp)
        if df and not df[0].empty:
            ident = df[0].iloc[0]["identity"]
            name = os.path.basename(os.path.dirname(ident))
            set_authenticated(name)
            return jsonify({"person": name}), 200
        else:
            return jsonify({"person":"Unknown"}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error":str(e)}), 500

# ======== MQTT cảm biến, lưu Firebase, gửi Telegram ========
def send_telegram_alert(message):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    data = {"chat_id": TELEGRAM_CHAT_ID, "text": message}
    try:
        requests.post(url, data=data)
    except Exception as e:
        print(f"Telegram error: {e}")

def round_time_to_nearest_slot(dt):
    minute = dt.minute
    if minute < 15:
        new_minute = 0
    elif minute < 45:
        new_minute = 30
    else:
        dt = dt + timedelta(hours=1)
        new_minute = 0
    return dt.replace(minute=new_minute, second=0, microsecond=0)

def find_next_available_slot(values_dict, dt):
    for _ in range(48):
        label = dt.strftime("%H:%M")
        if not values_dict or label not in values_dict:
            return label
        dt += timedelta(minutes=30)
    return dt.strftime("%H:%M")

def on_mqtt_message(client, userdata, msg):
    payload = msg.payload.decode()
    logging.info(f"[MQTT RECEIVED] topic={msg.topic}: {payload}")
    now = datetime.now(pytz.timezone('Asia/Ho_Chi_Minh'))
    time_slot = round_time_to_nearest_slot(now)
    label = time_slot.strftime("%H:%M")
    if payload.startswith("data_"):
        try:
            data = payload.replace("data_", "")
            temp_str, humi_str = data.split("/")
            temp = float(temp_str)
            humi = float(humi_str)
            requests.put(f"{FIREBASE_DB_URL}/temperature/{label}.json", json=int(temp))
            requests.put(f"{FIREBASE_DB_URL}/humidity/{label}.json", json=int(humi))
            logging.info(f"Đã lưu {temp}°C {humi}% vào {label}")
        except Exception as e:
            logging.error(f"Lỗi xử lý data_: {e}")
    elif payload == "Chay":
        send_telegram_alert("🔥 CẢNH BÁO CHÁY! Hệ thống phát hiện cháy lúc " + now.strftime("%H:%M:%S %d/%m/%Y"))

mqtt_client1.on_message = on_mqtt_message
mqtt_client2.on_message = on_mqtt_message
mqtt_client1.subscribe(WEMOS1_TOPIC)
mqtt_client2.subscribe(WEMOS2_TOPIC)

# === NLP model load ===
clf        = joblib.load('intent_model.pkl')
vectorizer = joblib.load('vectorizer.pkl')

# === HAND GESTURE FSM ===
FSM = {
    "command_mode": False,
    "voice_mode": False,
    "gesture_counter": {
        "Fist": 0, "One": 0, "Two": 0, "Three": 0, "Four": 0, "Five": 0
    },
    "idle_frame": 0,
}
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=True, max_num_hands=1, min_detection_confidence=0.7)

@app.route('/hand', methods=['POST'])
def detect_hand():
    global FSM, doorState, light1State, light2State, fanState
    person = get_authenticated()
    if not person:
        FSM["command_mode"] = False
        FSM["voice_mode"] = False
        for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
        FSM["idle_frame"] = 0
    else:
        set_authenticated(person)
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        f = request.files['file']
        img_np = np.frombuffer(f.read(), np.uint8)
        img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error":"Image decode error"}), 400
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = hands.process(img_rgb)
        if not results.multi_hand_landmarks:
            for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
            if FSM["command_mode"]:
                FSM["idle_frame"] += 1
                if FSM["idle_frame"] >= 10:
                    FSM["command_mode"] = False
                    FSM["idle_frame"] = 0
                    return jsonify({"gesture": "", "command": "Thoát chế độ cử chỉ do không có thao tác", "command_mode": False, "voice_mode": FSM["voice_mode"]})
                else:
                    return jsonify({"gesture": "", "command": "", "command_mode": True, "voice_mode": FSM["voice_mode"]})
            else:
                return jsonify({"gesture": "", "command": "", "command_mode": False, "voice_mode": FSM["voice_mode"]})
        FSM["idle_frame"] = 0
        lm = results.multi_hand_landmarks[0]
        tips = [lm.landmark[i] for i in (
            mp_hands.HandLandmark.THUMB_TIP,
            mp_hands.HandLandmark.INDEX_FINGER_TIP,
            mp_hands.HandLandmark.MIDDLE_FINGER_TIP,
            mp_hands.HandLandmark.RING_FINGER_TIP,
            mp_hands.HandLandmark.PINKY_TIP)]
        pips = [lm.landmark[i] for i in (
            mp_hands.HandLandmark.THUMB_IP,
            mp_hands.HandLandmark.INDEX_FINGER_PIP,
            mp_hands.HandLandmark.MIDDLE_FINGER_PIP,
            mp_hands.HandLandmark.RING_FINGER_PIP,
            mp_hands.HandLandmark.PINKY_PIP)]
        count = (1 if tips[0].x < pips[0].x else 0) + \
                sum(1 for i in range(1,5) if tips[i].y < pips[i].y)
        gesture = {0:"Fist", 1:"One", 2:"Two", 3:"Three", 4:"Four", 5:"Five"}.get(count, "Unknown")
        for k in FSM["gesture_counter"]:
            if k == gesture:
                FSM["gesture_counter"][k] += 1
            else:
                FSM["gesture_counter"][k] = 0
                
        logging.info(f"Gesture detected: {gesture}, counters: {FSM['gesture_counter']}")

        command = ""
        # Đăng xuất gesture
        if person:
            if FSM["voice_mode"] and FSM["gesture_counter"]["Four"] >= 2:
                clear_authenticated()
                FSM["voice_mode"] = False
                FSM["command_mode"] = False
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "Four", "command": "Đã đăng xuất (voice mode)", "command_mode": False, "voice_mode": False})
            if not FSM["voice_mode"] and not FSM["command_mode"] and FSM["gesture_counter"]["Four"] >= 2:
                clear_authenticated()
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "Four", "command": "Đã đăng xuất (normal mode)", "command_mode": False, "voice_mode": False})
        if person and not FSM["command_mode"] and not FSM["voice_mode"]:
            if FSM["gesture_counter"]["Fist"] >= 2:
                FSM["command_mode"] = True
                FSM["voice_mode"] = False
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "Fist", "command": "Vào chế độ cử chỉ", "command_mode": True, "voice_mode": False})
            if FSM["gesture_counter"]["Five"] >=2:
                FSM["voice_mode"] = True
                FSM["command_mode"] = False
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "Two", "command": "Vào chế độ voice", "command_mode": False, "voice_mode": True})
        if person and FSM["voice_mode"]:
            if FSM["gesture_counter"]["Five"] >= 2:
                FSM["voice_mode"] = False
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "Two", "command": "Thoát chế độ voice", "command_mode": False, "voice_mode": False})
            return jsonify({"gesture": gesture, "command": "", "command_mode": False, "voice_mode": True})
        if person and FSM["command_mode"]:
            if FSM["gesture_counter"]["Five"] >= 2:
                FSM["command_mode"] = False
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "Five", "command": "Thoát chế độ cử chỉ", "command_mode": False, "voice_mode": False})
            # One: Cửa, Two: đèn pk, Three: đèn nb, Four: quạt
            if FSM["gesture_counter"]["One"] >= 2:
                if not doorState:
                    command = "Open door"
                    cmd = "Mo_cua"
                    client, topic = get_mqtt_client_for_command(cmd)
                    for i in range(2):
                        client.publish(topic, cmd)
                        time.sleep(0.1)
                    update_firebase_state("doorState", True)
                    doorState = True
                else:
                    command = "Close door"
                    cmd = "Dong_cua"
                    client, topic = get_mqtt_client_for_command(cmd)
                    for i in range(2):
                        client.publish(topic, cmd)
                        time.sleep(0.1)
                    update_firebase_state("doorState", False)
                    doorState = False
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "One", "command": command, "command_mode": True, "voice_mode": False})
            if FSM["gesture_counter"]["Two"] >= 2:
                if not light1State:
                    command = "Turn on living room light"
                    cmd = "Bat_den_pk"
                    client, topic = get_mqtt_client_for_command(cmd)
                    for i in range(2):
                        client.publish(topic, cmd)
                        time.sleep(0.1)
                    update_firebase_state("light1State", True)
                    light1State = True
                else:
                    command = "Turn off living room light"
                    cmd = "Tat_den_pk"
                    client, topic = get_mqtt_client_for_command(cmd)
                    for i in range(2):
                        client.publish(topic, cmd)
                        time.sleep(0.1)
                    update_firebase_state("light1State", False)
                    light1State = False
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "Two", "command": command, "command_mode": True, "voice_mode": False})
            if FSM["gesture_counter"]["Three"] >= 2:
                if not light2State:
                    command = "Turn on kitchen light"
                    cmd = "Bat_den_nb"
                    client, topic = get_mqtt_client_for_command(cmd)
                    for i in range(2):
                        client.publish(topic, cmd)
                        time.sleep(0.1)
                    update_firebase_state("light2State", True)
                    light2State = True
                else:
                    command = "Turn off kitchen light"
                    cmd = "Tat_den_nb"
                    client, topic = get_mqtt_client_for_command(cmd)
                    for i in range(2):
                        client.publish(topic, cmd)
                        time.sleep(0.1)
                    update_firebase_state("light2State", False)
                    light2State = False
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "Three", "command": command, "command_mode": True, "voice_mode": False})
            if FSM["gesture_counter"]["Four"] >= 2:
                if not fanState:
                    command = "Turn on fan"
                    cmd = "Bat_quat"
                    client, topic = get_mqtt_client_for_command(cmd)
                    for i in range(2):
                        client.publish(topic, cmd)
                        time.sleep(0.1)
                    update_firebase_state("fanState", True)
                    fanState = True
                else:
                    command = "Turn off fan"
                    cmd = "Tat_quat"
                    client, topic = get_mqtt_client_for_command(cmd)
                    for i in range(2):
                        client.publish(topic, cmd)
                        time.sleep(0.1)
                    update_firebase_state("fanState", False)
                    fanState = False
                for k in FSM["gesture_counter"]: FSM["gesture_counter"][k] = 0
                return jsonify({"gesture": "Four", "command": command, "command_mode": True, "voice_mode": False})
            return jsonify({"gesture": gesture, "command": "", "command_mode": True, "voice_mode": False})
        return jsonify({"gesture": gesture, "command": "", "command_mode": FSM["command_mode"], "voice_mode": FSM["voice_mode"]})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ==== Các API Assistant đầy đủ ====
def handle_ask_time():
    try:
        now = datetime.now()
        return f"Bây giờ là {now.strftime('%H:%M')}."
    except Exception as e:
        return f"Lỗi lấy thời gian: {e}"

def handle_ask_date():
    now = datetime.now()
    return f"Hôm nay là ngày {now.strftime('%d/%m/%Y')}."

def handle_ask_weekday():
    weekdays = ["Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy","Chủ Nhật"]
    return f"Hôm nay là {weekdays[datetime.now().weekday()]}."

def handle_weather(city="Ho Chi Minh"):
    API_KEY = "49edb9d063ea368d8bbe0514d50bc784"
    res = requests.get(f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&lang=vi&units=metric")
    if not res.ok:
        return "Không lấy được thông tin thời tiết."
    data = res.json()
    desc = data['weather'][0]['description']
    temp = data['main']['temp']
    humidity = data['main']['humidity']
    is_rain = "rain" in data['weather'][0]['main'].lower() or "mưa" in desc.lower()
    reply = f"{city}: {desc}, {temp}°C. "
    reply += "Có mưa. " if is_rain else "Không mưa. "
    reply += f"Độ ẩm: {humidity}%. "
    advice = []
    if temp > 35:
        advice.append("Trời nắng nóng, bạn nên mang theo nước và che chắn cẩn thận khi ra ngoài.")
    elif temp < 20:
        advice.append("Trời lạnh, bạn nhớ mặc ấm khi ra đường nhé!")
    if humidity > 85:
        advice.append("Độ ẩm cao, bạn nên chú ý phòng tránh cảm lạnh khi ra ngoài.")
    if is_rain:
        advice.append("Trời có mưa, bạn nhớ mang theo áo mưa hoặc ô.")
    lat = data['coord']['lat']
    lon = data['coord']['lon']
    try:
        res_uv = requests.get(f"https://api.openweathermap.org/data/2.5/uvi?appid={API_KEY}&lat={lat}&lon={lon}")
        if res_uv.ok:
            uv = res_uv.json()['value']
            if uv < 3:
                advice.append("Chỉ số UV thấp, an toàn khi ra ngoài.")
            elif uv < 6:
                advice.append("Chỉ số UV trung bình, bạn nên chú ý che chắn khi ra ngoài.")
            else:
                advice.append("Chỉ số UV cao, bạn nên bôi kem chống nắng và đội mũ khi ra ngoài.")
            reply += f"Chỉ số UV: {uv}. "
    except Exception:
        pass
    try:
        res_aqi = requests.get(f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={API_KEY}")
        if res_aqi.ok:
            aqi_data = res_aqi.json()['list'][0]
            pm25 = aqi_data['components']['pm2_5']
            pm10 = aqi_data['components']['pm10']
            aqi = aqi_data['main']['aqi']
            aqi_map = {1: "Tốt", 2: "Khá", 3: "Trung bình", 4: "Kém", 5: "Rất kém"}
            reply += f"PM2.5: {pm25} µg/m³, PM10: {pm10} µg/m³. Chất lượng không khí: {aqi_map.get(aqi, 'Không rõ')}. "
            if aqi >= 4:
                advice.append("Chất lượng không khí kém, bạn nên hạn chế ra ngoài hoặc đeo khẩu trang chống bụi mịn.")
            elif aqi <= 2:
                advice.append("Chất lượng không khí tốt, phù hợp cho các hoạt động ngoài trời.")
    except Exception:
        pass
    if advice:
        reply += "Lời khuyên: " + " ".join(advice)
    return reply

def handle_news():
    rss_url = "https://vnexpress.net/rss/tin-moi-nhat.rss"
    try:
        feed = feedparser.parse(rss_url)
        news_list = []
        for item in feed.entries[:5]:
            title = item.title
            summary = re.sub('<.*?>', '', getattr(item, 'summary', '')).strip()
            news_list.append(f"- {title}: {summary}")
        return "Tin nổi bật hôm nay:\n" + "\n".join(news_list)
    except Exception as e:
        return f"Lỗi lấy tin tức: {e}"

def handle_calculation(text):
    text = text.replace("cộng", "+").replace("trừ", "-").replace("nhân", "*").replace("chia", "/")
    expr = ''.join([c for c in text if c in "+-*/.0123456789"])
    return f"Kết quả: {sympify(expr).evalf()}"

def handle_definition(text):
    query = re.search(r"(.+) là gì", text)
    if query: query = query.group(1).strip()
    else: query = text
    try:
        return wikipedia.summary(query, sentences=2)
    except:
        return "Không tìm thấy định nghĩa."

def handle_reminder(text):
    with open("reminders.txt", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()}: {text}\n")
    return "Đã lưu nhắc nhở!"

def handle_alarm(text):
    with open("alarms.txt", "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()}: {text}\n")
    return "Đã ghi nhận cảnh báo!"

def handle_chitchat(intent, text):
    prompt = f"Intent={intent}\nUser:{text}\nBot:"
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": "Bearer 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",
        "Content-Type": "application/json"
    }
    data = {
        "model": "llama3-70b-8192",
        "messages": [
            {"role": "system", "content": "Bạn là một trợ lý thân thiện, nói chuyện tự nhiên và gần gũi với người Việt."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.6,
        "max_tokens": 256,
        "stream": False
    }
    try:
        resp = requests.post(url, json=data, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"Lỗi kết nối Groq: {e}"

def handle_time_until(text):
    dt = dateparser.parse(text,languages=['vi'])
    if not dt: return "Không xác định thời gian."
    diff = dt - datetime.now()
    if diff.total_seconds()<0: return "Thời điểm đã qua."
    d,h,m = diff.days, diff.seconds//3600, (diff.seconds%3600)//60
    parts = []
    if d: parts.append(f"{d} ngày")
    if h: parts.append(f"{h} giờ")
    if m: parts.append(f"{m} phút")
    return f"Còn {' '.join(parts)} đến {dt.strftime('%d/%m/%Y %H:%M')}"

def extract_datetime(text):
    m = re.search(r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", text)
    if m: return m.group()
    m = re.search(r"\d{1,2} ?(giờ|h|:)\s*\d*", text)
    if m: return m.group()
    m = re.search(r"thứ ?[2-7]|chủ nhật", text, re.IGNORECASE)
    if m: return m.group()
    return None

def time_until_event(text, default_lang='vi'):
    now = datetime.now()
    time_text = extract_datetime(text)
    if not time_text:
        return "Tôi không nhận diện được mốc thời gian trong câu hỏi của bạn."
    m = re.search(r"(\d{1,2})(?: ?(giờ|h|:)\s*(\d{1,2})?)", time_text)
    if m and not re.search(r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", time_text):
        hour = int(m.group(1))
        minute = int(m.group(3) or 0)
        target_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target_time <= now:
            target_time += timedelta(days=1)
    else:
        target_time = dateparser.parse(time_text, settings={'RELATIVE_BASE': now, 'PREFER_DATES_FROM': 'future'}, languages=[default_lang])
    if not target_time:
        return "Tôi không nhận diện được mốc thời gian trong câu hỏi của bạn."
    delta = target_time - now
    days, remainder = divmod(delta.total_seconds(), 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)
    parts = []
    if days > 0: parts.append(f"{int(days)} ngày")
    if hours > 0: parts.append(f"{int(hours)} giờ")
    if minutes > 0: parts.append(f"{int(minutes)} phút")
    if not parts: parts.append("ít hơn 1 phút")
    return f"Còn {' '.join(parts)} nữa đến {target_time.strftime('%H:%M, ngày %d/%m/%Y')}."

# Các API Assistant
@app.route('/time',     methods=['POST'])
def post_time():      return jsonify({"time": handle_ask_time()})
@app.route('/date',     methods=['POST'])
def post_date():      return jsonify({"date": handle_ask_date()})
@app.route('/weekday',  methods=['POST'])
def post_weekday():   return jsonify({"weekday": handle_ask_weekday()})
@app.route('/weather',  methods=['POST'])
def post_weather():
    city = request.json.get('city','Ho Chi Minh')
    return jsonify({"weather": handle_weather(city)})
@app.route('/news',     methods=['POST'])
def post_news():      return jsonify({"news": handle_news()})
@app.route('/calculate',methods=['POST'])
def post_calculate():
    expr = request.json.get('expr','')
    return jsonify({"result": handle_calculation(expr)})
@app.route('/define',   methods=['POST'])
def post_define():
    term = request.json.get('term','')
    return jsonify({"definition": handle_definition(term)})
@app.route('/reminder', methods=['POST'])
def post_reminder():
    text = request.json.get('text','')
    return jsonify({"reminder": handle_reminder(text)})
@app.route('/alarm',    methods=['POST'])
def post_alarm():
    text = request.json.get('text','')
    return jsonify({"alarm": handle_alarm(text)})

# COMMAND NLP + MQTT + FIREBASE SYNC
command_map = {
    "mở cửa":               "Mo_cua",
    "đóng cửa":             "Dong_cua",
    "bật đèn phòng khách":  "Bat_den_pk",
    "tắt đèn phòng khách":  "Tat_den_pk",
    "bật đèn nhà bếp":      "Bat_den_nb",
    "tắt đèn nhà bếp":      "Tat_den_nb",
    "bật đèn":              "Bat_den_all",
    "tắt đèn":              "Tat_den_all",
    "bật quạt":             "Bat_quat",
    "tắt quạt":             "Tat_quat",
    "open door":            "Mo_cua",
    "close door":           "Dong_cua",
    "turn on living room light":   "Bat_den_pk",
    "turn off living room light":  "Tat_den_pk",
    "turn on kitchen light":       "Bat_den_nb",
    "turn off kitchen light":      "Tat_den_nb",
    "turn on lights":              "Bat_den_all",
    "turn off lights":             "Tat_den_all",
    "turn on ac":                  "Bat_quat",
    "turn off ac":                 "Tat_quat",
    "turn on fan":                 "Bat_quat",
    "turn off fan":                "Tat_quat",
}
def mqtt_command(text: str):
    text_lower = text.lower()
    for k,v in command_map.items():
        if k in text_lower:
            return v
    return None

state_map = {
    "Mo_cua":      {"doorState": True},
    "Dong_cua":    {"doorState": False},
    "Bat_den_pk":  {"light1State": True},
    "Tat_den_pk":  {"light1State": False},
    "Bat_den_nb":  {"light2State": True},
    "Tat_den_nb":  {"light2State": False},
    "Bat_den_all": {"light1State": True,  "light2State": True},
    "Tat_den_all": {"light1State": False, "light2State": False},
    "Bat_quat":    {"fanState": True},
    "Tat_quat":    {"fanState": False},
}

@app.route('/predict-intent', methods=['POST'])
def post_intent():
    text = request.json.get('text','').lower()
    logging.info(f"[CLIENT GỬI LÊN]: {text}")
    mcmd = mqtt_command(text)
    if mcmd:
        client, topic = get_mqtt_client_for_command(mcmd)
        for i in range(2):
            client.publish(topic, mcmd)
            time.sleep(0.1)
        logging.info(f"Published → {topic} ({client._client_id.decode()}): {mcmd}")
        if mcmd in state_map:
            for key,val in state_map[mcmd].items():
                update_firebase_state(key, val)
                globals()[key] = val
        return jsonify({"intent":"control","reply":f"Đã gửi lệnh {mcmd}."})
    intent = clf.predict(vectorizer.transform([text]))[0]
    logging.info(f"[SERVER ĐOÁN INTENT]: {intent}")
    handlers = {
        'ask_time':         handle_ask_time,
        'ask_date':         handle_ask_date,
        'ask_weekday':      handle_ask_weekday,
        'ask_weather':      lambda: handle_weather("Ho Chi Minh"),
        'ask_news':         handle_news,
        'ask_calculation':  lambda: handle_calculation(text),
        'ask_definition':   lambda: handle_definition(text),
        'ask_reminder':     lambda: handle_reminder(text),
        'alarm_notification':lambda: handle_alarm(text),
        'chitchat':         lambda: handle_chitchat(intent,text),
        'time_until_event': lambda: handle_time_until(text),
        'ask_days_until':   lambda: handle_time_until(text),
    }
    if intent in handlers:
        return jsonify({"intent": intent,"reply": handlers[intent]()})
    return jsonify({"intent":"unknown","reply":"Xin lỗi, tôi chưa hiểu."})

@app.route('/states', methods=['GET'])
def get_states():
    return jsonify({
        "light1State": light1State,
        "light2State": light2State,
        "doorState":   doorState,
        "fanState":    fanState
    })

if __name__ == '__main__':
    try:
        logging.info("Đang build DeepFace database representations, vui lòng đợi... (Lần đầu sẽ hơi lâu)")
        first_person_dir = None
        for name in os.listdir(DB_PATH):
            if os.path.isdir(os.path.join(DB_PATH, name)):
                first_person_dir = os.path.join(DB_PATH, name)
                break
        if not first_person_dir:
            logging.error(f"Không tìm thấy thư mục ảnh người dùng trong {DB_PATH}")
            exit(1)
        first_img = None
        for fname in os.listdir(first_person_dir):
            if fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                first_img = os.path.join(first_person_dir, fname)
                break
        if not first_img:
            logging.error(f"Không tìm thấy file ảnh trong {first_person_dir}")
            exit(1)
        _ = DeepFace.find(
            img_path=first_img,
            db_path=DB_PATH,
            model_name=MODEL_NAME,
            enforce_detection=False
        )
        logging.info("Build DeepFace DB thành công! (Sẵn sàng nhận diện)")
    except Exception as e:
        logging.error(f"Lỗi build DeepFace DB: {e}")
        exit(1)

    try:
        logging.info("Đang load NLP model...")
        _ = clf, vectorizer
        logging.info("Load NLP model thành công!")
    except Exception as e:
        logging.error(f"Lỗi load NLP model/vectorizer: {e}")
        exit(1)
    logging.info("Server starting on 0.0.0.0:5000 …")
    app.run(host='0.0.0.0', port=5000)
