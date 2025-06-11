#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

// ==== OLED SSD1306 config ====
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==== DHT11 config ====
#define DHTPIN D4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ==== LED pin ====
#define LED1 D5
#define LED2 D6

// ==== Flame sensor KY-026 + Buzzer ====
#define FLAME_SENSOR D0  // KY-026: LOW = fire detected
#define BUZZER_PIN   D7

// ==== WiFi credentials ====
const char* ssid     = "Hmee";
const char* password = "abcd1234";

// ==== MQTT HiveMQ settings ====
const char* mqtt_server = "2571594adf7e48da9ee3958d605824ec.s1.eu.hivemq.cloud";
const int   mqtt_port   = 8883;
const char* mqtt_user   = "haichu";
const char* mqtt_pass   = "H@ichu321";
const char* mqtt_topic  = "home/den";

WiFiClientSecure espClient;
PubSubClient client(espClient);

// ==== Fire icon 16×16 bitmap ====
const unsigned char fireIcon[] PROGMEM = {
  0x08,0x00,0x14,0x00,0x22,0x00,0x41,0x00,
  0x85,0x00,0x82,0x00,0x44,0x00,0x28,0x00,
  0x10,0x00,0x28,0x00,0x44,0x00,0x82,0x00,
  0x01,0x00,0x02,0x00,0x04,0x00,0x08,0x00
};

// ==== State variables ====
bool flamePreviouslyDetected = false;  // to publish "chay" only once per fire event
unsigned long lastSend = 0;

// ==== MQTT callback (handles light commands, etc.) ====
void callback(char* topic, byte* payload, unsigned int length) {
  String cmd;
  for (unsigned int i = 0; i < length; i++) {
    cmd += (char)payload[i];
  }
  Serial.print("[MQTT] Received: "); Serial.println(cmd);

  if      (cmd == "Bat_den_pk")      digitalWrite(LED1, HIGH);
  else if (cmd == "Tat_den_pk")      digitalWrite(LED1, LOW);
  else if (cmd == "Bat_den_nb")      digitalWrite(LED2, HIGH);
  else if (cmd == "Tat_den_nb")      digitalWrite(LED2, LOW);
  else if (cmd == "Bat_den_all") {
    digitalWrite(LED1, HIGH);
    digitalWrite(LED2, HIGH);
  }
  else if (cmd == "Tat_den_all") {
    digitalWrite(LED1, LOW);
    digitalWrite(LED2, LOW);
  }
  else if (cmd == "chay") {
    // manual MQTT-triggered fire alarm
    digitalWrite(BUZZER_PIN, HIGH);
    delay(2000);
    display.println("WARNING:");
    display.setCursor(20, 24);
    display.println("BURNING !!!");
    digitalWrite(BUZZER_PIN, LOW);
  }
}

// ==== Reconnect to MQTT broker ====
void reconnect() {
  while (!client.connected()) {
    Serial.print("[MQTT] Connecting...");
    if (client.connect("esp8266Client", mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      client.subscribe(mqtt_topic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 3 seconds");
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(9600);
  dht.begin();

  // pins
  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);
  pinMode(FLAME_SENSOR, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected, IP: " + WiFi.localIP().toString());

  // MQTT
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  // OLED init
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
    while (true);
  }
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Dang khoi dong...");
  display.display();
  delay(2000);
}

void loop() {
  // ensure MQTT connection
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // read sensors
  int  flame = digitalRead(FLAME_SENSOR);  // LOW = fire
  float temp  = dht.readTemperature();
  float humi  = dht.readHumidity();

  // publish DHT data every 60s
  if (millis() - lastSend > 60000) {
    if (!isnan(temp) && !isnan(humi)) {
      char buf[50];
      snprintf(buf, sizeof(buf), "data_%.1f/%.1f", temp, humi);
      client.publish(mqtt_topic, buf);
      Serial.println(buf);
    }
    lastSend = millis();
  }

  display.clearDisplay();

  if (flame == LOW) {
    // --- Fire detected ---
    // publish "chay" only once per event
    if (!flamePreviouslyDetected) {
      client.publish(mqtt_topic, "chay");
      flamePreviouslyDetected = true;
    }
    // buzzer on
    digitalWrite(BUZZER_PIN, HIGH);

    // OLED warning
    display.drawBitmap(0, 0, fireIcon, 16, 16, SSD1306_WHITE);
    display.setTextSize(2);
    display.setCursor(20, 0);
    display.println("WARNING:");
    display.setCursor(20, 24);
    display.println("BURNING !!!");
  }
  else {
    // --- No fire ---
    flamePreviouslyDetected = false;
    digitalWrite(BUZZER_PIN, LOW);

    // display temperature (top half)
    display.setTextSize(3);
    display.setCursor(0, 0);
    if (!isnan(temp)) {
      display.print(temp, 1);
      display.print("C");
    } else {
      display.print("--C");
    }

    // display humidity (bottom half)
    display.setCursor(0, 32);
    if (!isnan(humi)) {
      display.print(humi, 1);
      display.print("%");
    } else {
      display.print("--%");
    }
  }

  display.display();
  delay(100);
}