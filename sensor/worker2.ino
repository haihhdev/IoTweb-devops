#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <Servo.h>

// ==== Cấu hình WiFi ====
const char* ssid = "Hmee";
const char* password = "abcd1234";

// ==== Cấu hình MQTT HiveMQ Cloud ====
const char* mqtt_server = "3663b8f8294b4aa8acb3475e026adf3b.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "iot_home";
const char* mqtt_pass = "Tngan1724";
const char* mqtt_topic = "home/control";

// ==== MQTT client ====
WiFiClientSecure espClient;
PubSubClient client(espClient);

// ==== Servo & Quạt ====
Servo cuaServo;
#define SERVO_PIN D5
#define QUAT_PIN D6

// ==== Callback MQTT ====
void callback(char* topic, byte* payload, unsigned int length) {
  String cmd = "";
  for (unsigned int i = 0; i < length; i++) {
    cmd += (char)payload[i];
  }

  Serial.print("[MQTT] Lệnh nhận: ");
  Serial.println(cmd);

  // Điều khiển cửa
  if (cmd == "Dong_cua") {
    cuaServo.write(0);
  } else if (cmd == "Mo_cua") {
    cuaServo.write(180); 

  }

  // Điều khiển quạt
  else if (cmd == "Bat_quat") {
    digitalWrite(QUAT_PIN, HIGH);
  } else if (cmd == "Tat_quat") {
    digitalWrite(QUAT_PIN, LOW);
  }
}

// ==== Kết nối lại MQTT ====
void reconnect() {
  while (!client.connected()) {
    Serial.println("[MQTT] Đang kết nối...");
    if (client.connect("esp8266Client", mqtt_user, mqtt_pass)) {
      Serial.println("[MQTT] Thành công!");
      client.subscribe(mqtt_topic);
    } else {
      Serial.print("[MQTT] Lỗi: ");
      Serial.println(client.state());
      delay(3000);
    }
  }
}

// ==== SETUP ====
void setup() {
  Serial.begin(9600);

  // Khởi động quạt và servo
  pinMode(QUAT_PIN, OUTPUT);
  digitalWrite(QUAT_PIN, LOW);
  cuaServo.attach(SERVO_PIN);

  // WiFi
  WiFi.begin(ssid, password);
  Serial.println("[WiFi] Đang kết nối...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Đã kết nối!");
  Serial.print("[WiFi] IP: ");
  Serial.println(WiFi.localIP());

  // MQTT
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// ==== LOOP ====
void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}
