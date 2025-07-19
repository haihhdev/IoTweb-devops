#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Thin Client: Only send frame to server, display status/command results
(NO mediapipe, NO gesture/face/voice local processing)
"""
import os
import cv2
import requests
import time
import sys
import threading
import speech_recognition as sr
import queue
from gtts import gTTS
import glob
import subprocess

# === SERVER ENDPOINTS ===
SERVER_FACE    = "http://192.168.1.23:5000/recognize"
SERVER_HAND    = "http://192.168.1.23:5000/hand"
SERVER_INTENT  = "http://192.168.1.23:5000/predict-intent"
# Thay IP cho đúng mạng LAN của bạn!

# === TTS (Text to Speech) với gTTS ===
tts_queue = queue.Queue()
tts_playing = threading.Event()   # Đánh dấu đang nói để không bị nghe trùng

def tts_worker():
    while True:
        text = tts_queue.get()
        if text is None:
            break
        try:
            tts_playing.set()  # Đang nói
            tts = gTTS(text=text, lang='vi')
            tts.save('temp.mp3')
            os.system('mpg123 temp.mp3 > /dev/null 2>&1')
            os.remove('temp.mp3')
        except Exception as e:
            print("Lỗi đọc TTS:", e)
        finally:
            tts_playing.clear()  # Đã nói xong
        tts_queue.task_done()

threading.Thread(target=tts_worker, daemon=True).start()

def speak(text):
    tts_queue.put(text)

def show_result(result):
    print("[DEBUG] Sắp nói:", result)
    speak(result)

# === Speech Recognition setup ===
recognizer = sr.Recognizer()
mic_index = 4  # Đổi lại index này cho đúng micro của bạn (dùng list_microphone_names để dò)

def listen_from_selected_mic():
    global mic_index
    if mic_index is None:
        print("No mic selected")
        return ""
    with sr.Microphone(device_index=mic_index) as source:
        try:
            recognizer.adjust_for_ambient_noise(source, duration=1)
            print(f"Đang nghe từ mic index {mic_index}...")
            audio = recognizer.listen(source, timeout=5)
            text = recognizer.recognize_google(audio, language="vi-VN")
            print("Nghe được:", text)
            return text
        except Exception as e:
            print("Lỗi nhận dạng giọng nói:", e)
            return ""

# === Music playing (phát nhạc từ folder nhac) ===
music_process = None
music_folder = "nhac"     # Đặt đúng tên/thư mục nhạc của bạn
current_song = None

def find_song(song_name):
    song_name_cmp = song_name.lower().replace(" ", "")
    for filepath in glob.glob(os.path.join(music_folder, "*.mp3")):
        filename = os.path.splitext(os.path.basename(filepath))[0].lower().replace(" ", "")
        if song_name_cmp in filename:
            return filepath
    return None

def play_song(song_path):
    global music_process
    if music_process and music_process.poll() is None:
        music_process.terminate()
    # Phát bằng mpg123 (nếu Windows dùng playsound hoặc vlc ...)
    music_process = subprocess.Popen(["mpg123", song_path])

# === Global states for voice mode và xác thực ===
voice_mode = False
command_mode = False
auth_name = None
last_command = None
last_gesture = None

voice_mode_lock = threading.Lock()

# Voice recognition thread: chỉ chạy khi voice_mode=True
def voice_listener():
    global voice_mode, current_song, music_process
    while True:
        with voice_mode_lock:
            is_voice = voice_mode
        if is_voice:
            # Nếu đang phát nhạc thì không nghe mic
            if music_process and music_process.poll() is None:
                time.sleep(0.3)
                continue
            # Nếu bot đang nói, không lắng nghe!
            if tts_playing.is_set():
                time.sleep(0.2)
                continue
            cmd = listen_from_selected_mic()
            with voice_mode_lock:
                if not voice_mode:
                    continue
            if cmd:
                lower_cmd = cmd.lower()
                # Các từ khoá trigger phát nhạc
                music_triggers = ["bật nhạc", "phát nhạc", "mở bài", "bật bài", "nghe bài"]
                if any(kw in lower_cmd for kw in music_triggers):
                    # Tìm tên bài hát
                    song_name = None
                    for kw in music_triggers:
                        if kw in lower_cmd:
                            song_name = lower_cmd.split(kw)[-1].strip()
                            break
                    if not song_name:
                        speak("Bạn muốn phát bài gì?")
                    else:
                        song_path = find_song(song_name)
                        if song_path:
                            speak(f"Đang phát bài {song_name}")
                            play_song(song_path)
                            current_song = song_path
                        else:
                            speak(f"Không tìm thấy bài {song_name} trong thư mục nhạc!")
                    continue  # Không gửi intent lên server nữa
                # Không phải lệnh phát nhạc thì xử lý như cũ
                print("Gửi lệnh giọng nói lên server:", cmd)
                try:
                    resp = requests.post(SERVER_INTENT, json={"text": cmd}, timeout=5)
                    reply = resp.json().get("reply", "")
                    if reply:
                        show_result(reply)
                except Exception as e:
                    print("Lỗi gửi intent:", e)
        else:
            time.sleep(1)
threading.Thread(target=voice_listener, daemon=True).start()

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
if not cap.isOpened():
    print("Cannot open camera"); sys.exit()

hand_busy = False

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            continue
        display_frame = frame.copy()

        # --- GỬI FRAME LÊN SERVER ĐỂ XÁC THỰC KHUÔN MẶT ---
        try:
            _, img_buf = cv2.imencode('.jpg', frame)
            resp = requests.post(
                SERVER_FACE,
                files={'file': ('capture.jpg', img_buf.tobytes(), 'image/jpeg')},
                timeout=5
            )
            data = resp.json() if resp.status_code == 200 else {}
            person = data.get("person", "")
            if person and person not in ("Unknown", "Error", "Not authorized"):
                if auth_name != person:
                    show_result(f"Xin chào {person}")
                    auth_name = person
            # KHÔNG reset trạng thái nếu không nhận diện ra mặt!
        except Exception as e:
            pass

        # --- GỬI FRAME LÊN SERVER ĐỂ NHẬN DIỆN GESTURE (CỬ CHỈ) ---
        if auth_name and not hand_busy:
            hand_busy = True
            try:
                _, img_buf = cv2.imencode('.jpg', frame)
                resp = requests.post(
                    SERVER_HAND,
                    files={'file': ('hand.jpg', img_buf.tobytes(), 'image/jpeg')},
                    timeout=5
                )
                data = resp.json() if resp.status_code == 200 else {}
                gesture = data.get("gesture", "")
                command = data.get("command", "")
                cmode = data.get("command_mode", False)
                vmode = data.get("voice_mode", False)

                # Cập nhật trạng thái mode dựa vào server trả về
                command_mode = cmode
                with voice_mode_lock:
                    voice_mode = vmode

                # --- DỪNG NHẠC nếu giơ 4 ngón 3 frame liên tiếp ---
                if gesture == "Four":
                    if not hasattr(show_result, 'four_count'):
                        show_result.four_count = 0
                    show_result.four_count += 1
                    if show_result.four_count >= 3 and music_process and music_process.poll() is None:
                        music_process.terminate()
                        speak("Đã dừng phát nhạc.")
                        show_result.four_count = 0
                else:
                    if hasattr(show_result, 'four_count'):
                        show_result.four_count = 0

                if command and command != last_command:
                    last_command = command

                    # Nếu là vào hoặc thoát các chế độ thì đọc lên và không gửi intent
                    if "vào chế độ" in command.lower() or "thoát" in command.lower() or command.lower() == "exit command mode":
                        show_result(command)
                        time.sleep(1.5)
                        continue

                    # Nếu là đăng xuất thì feedback và reset biến trạng thái
                    if "đăng xuất" in command.lower():
                        show_result(command)
                        auth_name = None
                        command_mode = False
                        with voice_mode_lock:
                            voice_mode = False
                        last_command = None
                        last_gesture = None
                        time.sleep(1.5)
                        continue

                    # Còn lại là các lệnh control, gửi lên assistant rồi đọc reply
                    show_result(f"Phát hiện lệnh: {command}")
                    try:
                        intent_resp = requests.post(SERVER_INTENT, json={"text": command}, timeout=5)
                        reply = intent_resp.json().get("reply", "")
                        show_result(reply)
                    except Exception as ex:
                        print("Intent error:", ex)
            except Exception as e:
                print("Hand error:", e)
            finally:
                hand_busy = False

        time.sleep(1)
except KeyboardInterrupt:
    print("Đã dừng chương trình (Ctrl+C)")
finally:
    cap.release()
    cv2.destroyAllWindows()
